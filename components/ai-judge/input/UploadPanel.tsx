// 파일 업로드 + 사전 품질 체크. 스펙 4.1
//
// 업로드 즉시 첫 프레임을 뽑아 포즈를 1회 추론하고, 화각이 나쁘면 경고한다.
// ⚠️ 경고일 뿐 업로드를 막지는 않는다 — 최종 판정은 워커의 confidence 가 한다.
'use client';

import { useRef, useState } from 'react';

const MAX_MB = Number(process.env.NEXT_PUBLIC_AI_JUDGE_MAX_MB ?? '500');
const MAX_SECONDS = 180;

type Preflight =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'ok'; durationSec: number }
  | { state: 'warn'; durationSec: number; message: string }
  | { state: 'reject'; message: string };

export function UploadPanel({
  file,
  onPick,
}: {
  file: File | null;
  onPick: (f: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pre, setPre] = useState<Preflight>({ state: 'idle' });

  async function handleFile(f: File | null) {
    if (!f) {
      onPick(null);
      setPre({ state: 'idle' });
      return;
    }

    if (f.size > MAX_MB * 1024 * 1024) {
      setPre({ state: 'reject', message: `${MAX_MB}MB 이내로 올려 주세요. (현재 ${(f.size / 1024 / 1024).toFixed(0)}MB)` });
      onPick(null);
      return;
    }

    setPre({ state: 'checking' });
    onPick(f);

    try {
      const { durationSec, framing } = await inspect(f);
      if (durationSec > MAX_SECONDS) {
        setPre({
          state: 'reject',
          message: `영상이 ${Math.round(durationSec)}초입니다. 3분 이내로 잘라서 올려 주세요.`,
        });
        onPick(null);
        return;
      }
      if (framing === 'bad') {
        setPre({
          state: 'warn',
          durationSec,
          message:
            '첫 화면에서 전신이 확인되지 않습니다. 머리부터 발끝까지 나온 영상이 아니면 분석이 어려울 수 있습니다.',
        });
        return;
      }
      setPre({ state: 'ok', durationSec });
    } catch {
      // 메타를 못 읽어도 업로드는 진행한다. 서버가 다시 검사한다.
      setPre({ state: 'idle' });
    }
  }

  return (
    <div className="jnj-stack-3">
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/quicktime"
        style={{ display: 'none' }}
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="jnj-card-clickable"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          width: '100%',
          aspectRatio: '9 / 16',
          padding: 20,
          border: '1px dashed var(--jnj-border)',
          borderRadius: 'var(--jnj-radius-lg)',
          background: 'var(--jnj-surface)',
          color: 'var(--jnj-text-muted)',
          fontFamily: 'var(--jnj-font-text)',
        }}
      >
        <span style={{ fontSize: 32, lineHeight: 1 }}>＋</span>
        <span className="jnj-caption" style={{ color: 'var(--jnj-text)' }}>
          {file ? '다른 영상 고르기' : '영상 고르기'}
        </span>
        <span className="jnj-small">mp4 · mov · 3분 이내 · {MAX_MB}MB 이내</span>
      </button>

      {file && (
        <p
          className="jnj-small jnj-text-center"
          style={{
            margin: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {file.name} · {(file.size / 1024 / 1024).toFixed(1)}MB
        </p>
      )}

      {pre.state === 'checking' && (
        <p className="jnj-small jnj-text-center" style={{ margin: 0 }}>
          화각 확인 중…
        </p>
      )}
      {pre.state === 'ok' && (
        <p
          className="jnj-small jnj-text-center"
          style={{ margin: 0, color: 'var(--jnj-green)' }}
        >
          전신 확인 · {Math.round(pre.durationSec)}초
        </p>
      )}
      {pre.state === 'warn' && (
        <div
          style={{
            border: '1px solid var(--jnj-border)',
            background: 'var(--jnj-surface)',
            borderRadius: 'var(--jnj-radius-lg)',
            padding: 16,
          }}
        >
          <p className="jnj-caption" style={{ margin: 0 }}>
            {pre.message}
          </p>
        </div>
      )}
      {pre.state === 'reject' && (
        <p
          role="alert"
          style={{
            margin: 0,
            border: '1px solid var(--jnj-red)',
            borderRadius: 'var(--jnj-radius-sm)',
            padding: '10px 14px',
            color: 'var(--jnj-red)',
            fontSize: 14,
            lineHeight: 1.5,
          }}
        >
          {pre.message}
        </p>
      )}
    </div>
  );
}

/** 첫 프레임을 뽑아 길이와 대략적인 화각을 확인한다. */
async function inspect(file: File): Promise<{
  durationSec: number;
  framing: 'ok' | 'bad' | 'unknown';
}> {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement('video');
    video.src = url;
    video.muted = true;
    video.playsInline = true;

    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error('영상을 읽을 수 없습니다'));
    });

    const durationSec = video.duration;
    // 0.5초 지점으로 이동해 첫 프레임의 검은 화면을 피한다.
    video.currentTime = Math.min(0.5, durationSec / 2);
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve();
    });

    const framing = await checkFraming(video);
    return { durationSec, framing };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function checkFraming(video: HTMLVideoElement): Promise<'ok' | 'bad' | 'unknown'> {
  try {
    const vision = await import('@mediapipe/tasks-vision');
    const fileset = await vision.FilesetResolver.forVisionTasks('/ajudge/mediapipe/wasm');
    const landmarker = await vision.PoseLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: '/ajudge/mediapipe/pose_landmarker_lite.task',
        delegate: 'GPU',
      },
      runningMode: 'IMAGE',
      numPoses: 1,
    });
    try {
      const result = landmarker.detect(video);
      const person = result.landmarks?.[0];
      if (!person) return 'bad';
      // worker/pose.py FULL_BODY_LANDMARKS 와 동일
      for (const i of [0, 11, 12, 23, 24, 27, 28]) {
        const lm = person[i];
        if (!lm) return 'bad';
        const vis = lm.visibility ?? 1;
        if (vis < 0.5 || lm.x < 0 || lm.x > 1 || lm.y < 0 || lm.y > 1) return 'bad';
      }
      return 'ok';
    } finally {
      landmarker.close();
    }
  } catch {
    return 'unknown';
  }
}
