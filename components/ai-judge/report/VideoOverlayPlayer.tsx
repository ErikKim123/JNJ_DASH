// 영상 플레이어 + canvas 오버레이 (스켈레톤 + 비트 마커). 스펙 4.3
//
// 스켈레톤은 워커가 Storage 에 올린 pose.json(10fps 로 솎은 랜드마크)을 읽어 그린다.
// metrics_json 에 담기엔 용량이 커서 별도 파일로 분리했다.
//
// DOM 은 JNJ 디자인 시스템 토큰만 쓰고, canvas 드로잉 색만 아래 상수(JNJ 팔레트)를 쓴다.
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Metrics } from '@/lib/ai-judge/types';

// ── canvas 드로잉 팔레트 (JNJ) ─────────────────────────────
/** 강조 — 1번 인물 스켈레톤, 비트 마커 */
const DRAW_ACCENT = '#FFFFFF';
/** 보조선 — 비트 트랙 바닥 */
const DRAW_GRID = '#39393B';
/** 대비색 — 2번 인물 스켈레톤 */
const DRAW_CONTRAST = '#E84D6A';
/** 인물 인덱스별 스켈레톤 색 (3인 이상은 순환) */
const SKELETON_COLORS = [DRAW_ACCENT, DRAW_CONTRAST];

// MediaPipe Pose 33 랜드마크 연결 (몸통/팔/다리만 — 얼굴 세부는 생략)
const BONES: [number, number][] = [
  [11, 12], [11, 23], [12, 24], [23, 24],          // 몸통
  [11, 13], [13, 15], [12, 14], [14, 16],          // 팔
  [23, 25], [25, 27], [24, 26], [26, 28],          // 다리
  [27, 31], [28, 32],                              // 발
];

interface Track {
  fps: number;
  persons: number;
  frames: ([number, number][] | null)[][];
}

export function VideoOverlayPlayer({
  videoUrl,
  trackUrl,
  metrics,
  seekTo,
}: {
  videoUrl: string | null;
  trackUrl: string | null;
  metrics: Metrics;
  seekTo?: number | null;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trackRef = useRef<Track | null>(null);
  const rafRef = useRef<number | null>(null);
  const [showSkeleton, setShowSkeleton] = useState(true);

  // 랜드마크 트랙 로드 (실패해도 영상 재생은 계속된다)
  useEffect(() => {
    if (!trackUrl) return;
    let alive = true;
    fetch(trackUrl)
      .then((r) => (r.ok ? r.json() : null))
      .then((t) => {
        if (alive) trackRef.current = t;
      })
      .catch(() => {
        /* 오버레이만 없이 동작 */
      });
    return () => {
      alive = false;
    };
  }, [trackUrl]);

  const draw = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);

    // ── 스켈레톤 ─────────────────────────────────────────────
    const track = trackRef.current;
    if (showSkeleton && track?.frames?.length) {
      const idx = Math.min(
        track.frames.length - 1,
        Math.max(0, Math.round(video.currentTime * track.fps))
      );
      const people = track.frames[idx] ?? [];
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.9;
      people.forEach((person, pi) => {
        if (!person) return;
        ctx.strokeStyle = SKELETON_COLORS[pi % SKELETON_COLORS.length];
        ctx.fillStyle = ctx.strokeStyle;
        for (const [a, b] of BONES) {
          const pa = person[a];
          const pb = person[b];
          if (!pa || !pb) continue;
          ctx.beginPath();
          ctx.moveTo(pa[0] * w, pa[1] * h);
          ctx.lineTo(pb[0] * w, pb[1] * h);
          ctx.stroke();
        }
        for (const p of person) {
          if (!p) continue;
          ctx.beginPath();
          ctx.arc(p[0] * w, p[1] * h, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      ctx.globalAlpha = 1;
    }

    // ── 비트 마커 — 현재 시각 근처의 비트를 하단에 표시 ────────
    const bpm = metrics.audio?.bpm ?? 0;
    if (bpm > 0) {
      const interval = 60 / bpm;
      const phase = (video.currentTime % interval) / interval;
      const barY = h - 10;
      ctx.fillStyle = DRAW_GRID;
      ctx.fillRect(0, barY, w, 3);
      // 비트 순간에 밝게 튀는 마커
      const strength = 1 - Math.min(1, phase * 4);
      ctx.globalAlpha = 0.25 + strength * 0.75;
      ctx.fillStyle = DRAW_ACCENT;
      ctx.fillRect(0, barY - 1, w * (1 - phase), 5);
      ctx.globalAlpha = 1;
    }

    rafRef.current = requestAnimationFrame(draw);
  }, [metrics, showSkeleton]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [draw]);

  // 타임라인/구간 클릭 → seek
  useEffect(() => {
    if (seekTo == null || !videoRef.current) return;
    videoRef.current.currentTime = seekTo;
    void videoRef.current.play().catch(() => {});
  }, [seekTo]);

  if (!videoUrl) {
    return (
      <div
        className="jnj-caption jnj-text-center"
        style={{
          display: 'grid',
          placeItems: 'center',
          width: '100%',
          aspectRatio: '9 / 16',
          border: '1px dashed var(--jnj-border)',
          borderRadius: 'var(--jnj-radius-lg)',
          background: 'var(--jnj-surface)',
          color: 'var(--jnj-text-muted)',
        }}
      >
        <span>
          영상 보관 기간이 지나
          <br />
          재생할 수 없습니다.
        </span>
      </div>
    );
  }

  return (
    <div className="jnj-stack-2">
      <div
        style={{
          position: 'relative',
          width: '100%',
          overflow: 'hidden',
          borderRadius: 'var(--jnj-radius-lg)',
          border: '1px solid var(--jnj-border)',
          background: 'var(--jnj-black)',
        }}
      >
        <video
          ref={videoRef}
          src={videoUrl}
          controls
          playsInline
          style={{
            display: 'block',
            width: '100%',
            maxHeight: '60vh',
            objectFit: 'contain',
          }}
        />
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
          }}
        />
      </div>
      <button
        type="button"
        onClick={() => setShowSkeleton((v) => !v)}
        className="jnj-btn jnj-btn-secondary"
        style={{ padding: '10px 18px', fontSize: 13 }}
      >
        스켈레톤 {showSkeleton ? '숨기기' : '보기'}
      </button>
    </div>
  );
}
