// 직접 촬영 — MediaRecorder + 전신 가이드 박스. 스펙 4.1(촬영 표준 강제).
//
// 전신이 가이드 박스 안에 들어와야만 녹화 버튼이 활성화된다.
// 이렇게 입력 단계에서 화각을 강제해야 confidence=low 로 버려지는 영상이 줄어든다.
//
// 스타일은 JNJ Mobile Design System(app/join/join.css)만 쓴다.
// 색·타이포는 var(--jnj-*) 토큰, 레이아웃은 inline style — Tailwind 클래스는 쓰지 않는다.
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_GUIDE_BOX, usePoseGuide } from './usePoseGuide';

const MAX_SECONDS = 180; // 스펙 4.1 — 최대 3분

export function RecordPanel({ onRecorded }: { onRecorded: (file: File) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const [camera, setCamera] = useState<'idle' | 'on' | 'denied'>('idle');
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState('');

  const { state: guide, missing, box } = usePoseGuide(videoRef, camera === 'on', DEFAULT_GUIDE_BOX);

  // ── 카메라 ──────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1080 }, height: { ideal: 1920 } },
        audio: true, // 비트 분석에 소리가 필요하다
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCamera('on');
    } catch {
      setCamera('denied');
      setError('카메라 권한이 필요합니다. 브라우저 설정에서 허용해 주세요.');
    }
  }, []);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // ── 녹화 타이머 ─────────────────────────────────────────────
  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => {
      setSeconds((s) => {
        if (s + 1 >= MAX_SECONDS) {
          recorderRef.current?.stop();
          return MAX_SECONDS;
        }
        return s + 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [recording]);

  function startRecording() {
    const stream = streamRef.current;
    if (!stream) return;
    chunksRef.current = [];
    const mime = MediaRecorder.isTypeSupported('video/mp4')
      ? 'video/mp4'
      : 'video/webm;codecs=vp9,opus';
    const rec = new MediaRecorder(stream, { mimeType: mime });
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mime });
      const ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm';
      onRecorded(new File([blob], `recording.${ext}`, { type: mime }));
      setRecording(false);
    };
    recorderRef.current = rec;
    rec.start();
    setSeconds(0);
    setRecording(true);
  }

  const canRecord = camera === 'on' && (guide === 'ready' || guide === 'unavailable');

  // 가이드 박스 테두리 — 전신 확인은 성공색, 벗어남은 경고색, 그 외엔 보조색.
  const guideBorder =
    guide === 'ready'
      ? 'var(--jnj-green)'
      : guide === 'partial'
        ? 'var(--jnj-red)'
        : 'var(--jnj-text-muted)';

  return (
    <div className="jnj-stack-3">
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '9 / 16',
          overflow: 'hidden',
          borderRadius: 'var(--jnj-radius-lg)',
          background: camera === 'on' ? 'var(--jnj-bg)' : 'var(--jnj-surface)',
          border:
            camera === 'on' ? '1px solid var(--jnj-border)' : '1px dashed var(--jnj-border)',
        }}
      >
        <video
          ref={videoRef}
          playsInline
          muted
          style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
        />

        {/* 전신 가이드 박스 */}
        {camera === 'on' && (
          <div
            style={{
              position: 'absolute',
              pointerEvents: 'none',
              borderRadius: 'var(--jnj-radius-sm)',
              border: `2px solid ${guideBorder}`,
              transition: 'border-color 200ms',
              left: `${box.x * 100}%`,
              top: `${box.y * 100}%`,
              width: `${box.w * 100}%`,
              height: `${box.h * 100}%`,
            }}
          />
        )}

        {camera !== 'on' && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <button type="button" onClick={startCamera} className="jnj-btn jnj-btn-primary">
              카메라 켜기
            </button>
          </div>
        )}

        {recording && (
          <div
            style={{
              position: 'absolute',
              left: 12,
              top: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 12px',
              borderRadius: 'var(--jnj-radius-pill)',
              background: 'var(--jnj-bg)',
              border: '1px solid var(--jnj-border)',
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 9999,
                background: 'var(--jnj-red)',
              }}
            />
            <span className="jnj-mono" style={{ fontSize: 12, color: 'var(--jnj-text)' }}>
              {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')} / 3:00
            </span>
          </div>
        )}
      </div>

      {/* 가이드 상태 */}
      {camera === 'on' && (
        <p className="jnj-small" style={{ margin: 0, textAlign: 'center' }}>
          {guide === 'loading' && <span>전신 감지 준비 중…</span>}
          {guide === 'unavailable' && (
            <span style={{ color: 'var(--jnj-red)' }}>
              전신 감지를 쓸 수 없습니다. 머리부터 발끝까지 나오게 직접 맞춰 주세요.
            </span>
          )}
          {guide === 'searching' && <span>사람을 찾는 중…</span>}
          {guide === 'partial' && (
            <span style={{ color: 'var(--jnj-red)' }}>
              {missing.join('·')}이(가) 박스를 벗어났습니다. 뒤로 물러나 주세요.
            </span>
          )}
          {guide === 'ready' && (
            <span style={{ color: 'var(--jnj-green)' }}>전신 확인 — 촬영할 수 있습니다</span>
          )}
        </p>
      )}

      <button
        type="button"
        disabled={!canRecord}
        onClick={() => (recording ? recorderRef.current?.stop() : startRecording())}
        className={
          recording
            ? 'jnj-btn jnj-btn-full jnj-btn-lg'
            : 'jnj-btn jnj-btn-primary jnj-btn-full jnj-btn-lg'
        }
        style={recording ? { background: 'var(--jnj-red)', color: 'var(--jnj-white)' } : undefined}
      >
        {recording ? '녹화 중지' : '녹화 시작'}
      </button>

      {!canRecord && camera === 'on' && !recording && (
        <p className="jnj-small" style={{ margin: 0, textAlign: 'center' }}>
          전신이 박스 안에 들어와야 녹화를 시작할 수 있습니다.
        </p>
      )}
      {error && (
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
          {error}
        </p>
      )}
    </div>
  );
}
