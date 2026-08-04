// 전신 감지 훅 — MediaPipe Tasks(WASM)를 브라우저에서 돌려
// '가이드 박스 안에 전신이 들어왔는지'를 실시간 판정한다. 스펙 4.1(촬영 표준 강제).
//
// ⚠️ 이건 촬영 보조일 뿐 분석 판정이 아니다.
//    실제 confidence 는 워커의 compute_confidence() 가 결정한다 (절대 원칙 2).
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// worker/pose.py 의 FULL_BODY_LANDMARKS 와 같은 인덱스
const NOSE = 0;
const L_SHOULDER = 11;
const R_SHOULDER = 12;
const L_HIP = 23;
const R_HIP = 24;
const L_ANKLE = 27;
const R_ANKLE = 28;
const FULL_BODY = [NOSE, L_SHOULDER, R_SHOULDER, L_HIP, R_HIP, L_ANKLE, R_ANKLE];

const VISIBILITY_MIN = 0.5;

/** MediaPipe Tasks WASM/모델은 CDN 대신 자체 호스팅한다(네트워크 정책·오프라인 대비). */
const WASM_BASE = '/ajudge/mediapipe/wasm';
const MODEL_URL = '/ajudge/mediapipe/pose_landmarker_lite.task';

export type GuideState = 'loading' | 'unavailable' | 'searching' | 'partial' | 'ready';

export interface GuideBox {
  /** 0~1 정규화. 이 안에 전신이 들어와야 한다. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export const DEFAULT_GUIDE_BOX: GuideBox = { x: 0.12, y: 0.05, w: 0.76, h: 0.9 };

export function usePoseGuide(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  enabled: boolean,
  box: GuideBox = DEFAULT_GUIDE_BOX
) {
  const [state, setState] = useState<GuideState>('loading');
  const [missing, setMissing] = useState<string[]>([]);
  const landmarkerRef = useRef<unknown>(null);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef(-1);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    (async () => {
      try {
        const vision = await import('@mediapipe/tasks-vision');
        const fileset = await vision.FilesetResolver.forVisionTasks(WASM_BASE);
        const landmarker = await vision.PoseLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
          runningMode: 'VIDEO',
          numPoses: 1,
        });
        if (cancelled) {
          landmarker.close();
          return;
        }
        landmarkerRef.current = landmarker;
        setState('searching');
      } catch {
        // 모델을 못 받으면 가이드만 못 쓸 뿐, 촬영 자체는 막지 않는다.
        if (!cancelled) setState('unavailable');
      }
    })();

    return () => {
      cancelled = true;
      const l = landmarkerRef.current as { close?: () => void } | null;
      l?.close?.();
      landmarkerRef.current = null;
    };
  }, [enabled]);

  const tick = useCallback(() => {
    const video = videoRef.current;
    const landmarker = landmarkerRef.current as {
      detectForVideo: (v: HTMLVideoElement, t: number) => { landmarks?: unknown[][] };
    } | null;

    if (!video || !landmarker || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }

    const ts = performance.now();
    if (ts - lastTsRef.current < 100) {
      // 10fps 로 충분하다. 매 프레임 추론하면 모바일에서 발열/버벅임이 심하다.
      rafRef.current = requestAnimationFrame(tick);
      return;
    }
    lastTsRef.current = ts;

    try {
      const result = landmarker.detectForVideo(video, ts);
      const person = result.landmarks?.[0] as
        | { x: number; y: number; visibility?: number }[]
        | undefined;

      if (!person) {
        setState('searching');
        setMissing([]);
      } else {
        const bad: string[] = [];
        const NAMES: Record<number, string> = {
          [NOSE]: '머리',
          [L_SHOULDER]: '어깨',
          [R_SHOULDER]: '어깨',
          [L_HIP]: '골반',
          [R_HIP]: '골반',
          [L_ANKLE]: '발',
          [R_ANKLE]: '발',
        };
        for (const i of FULL_BODY) {
          const lm = person[i];
          if (!lm) continue;
          const vis = lm.visibility ?? 1;
          const inBox =
            lm.x >= box.x && lm.x <= box.x + box.w && lm.y >= box.y && lm.y <= box.y + box.h;
          if (vis < VISIBILITY_MIN || !inBox) {
            const name = NAMES[i];
            if (name && !bad.includes(name)) bad.push(name);
          }
        }
        setMissing(bad);
        setState(bad.length === 0 ? 'ready' : 'partial');
      }
    } catch {
      /* 추론 실패는 무시하고 다음 프레임에 재시도 */
    }

    rafRef.current = requestAnimationFrame(tick);
  }, [videoRef, box]);

  useEffect(() => {
    if (!enabled || state === 'loading' || state === 'unavailable') return;
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [enabled, state, tick]);

  return { state, missing, box };
}
