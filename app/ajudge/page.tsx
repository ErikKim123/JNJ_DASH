// 영상 입력 — 스펙 4.1. 업로드 / 직접 촬영 탭 + 메타 입력 + 제출.
'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { MetaForm, type MetaValue } from '@/components/ai-judge/input/MetaForm';
import { RecordPanel } from '@/components/ai-judge/input/RecordPanel';
import { UploadPanel } from '@/components/ai-judge/input/UploadPanel';
import { createClientBrowser, MEDIA_BUCKET } from '@/lib/ai-judge/supabase-browser';

// ⚠️ 'use client' 파일에서는 route segment config( dynamic 등 )를 export 할 수 없다.

type Tab = 'upload' | 'record';

// 세그먼트 탭 — JNJ 디자인 시스템 스펙(트랙 위 필 버튼).
const SEGMENT_WRAP: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 4,
  padding: 4,
  background: 'var(--jnj-track)',
  border: '1px solid var(--jnj-border)',
  borderRadius: 'var(--jnj-radius-pill)',
};
const SEGMENT_BTN: React.CSSProperties = {
  border: 'none',
  padding: '10px 0',
  fontFamily: 'var(--jnj-font-text)',
  fontSize: 14,
  fontWeight: 500,
  cursor: 'pointer',
  borderRadius: 'var(--jnj-radius-pill)',
  transition: 'background 200ms, color 200ms',
};
const SEGMENT_ON: React.CSSProperties = {
  background: 'var(--jnj-accent)',
  color: 'var(--jnj-on-accent)',
};
const SEGMENT_OFF: React.CSSProperties = {
  background: 'transparent',
  color: 'var(--jnj-text-muted)',
};

export default function InputPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [meta, setMeta] = useState<MetaValue>({
    role: 'leader',
    leaderSide: '',
    songTitle: '',
  });
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');

  const ready =
    !!file && !busy && (meta.role !== 'couple' || meta.leaderSide !== '');

  async function submit() {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      // 1) signed upload URL
      setProgress('업로드 준비 중…');
      const signRes = await fetch('/api/ajudge/uploads', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          kind: 'video',
          contentType: file.type || 'video/mp4',
          sizeBytes: file.size,
        }),
      });
      const sign = await signRes.json();
      if (!signRes.ok) throw new Error(sign.message ?? sign.error);

      // 2) Storage 직접 업로드 (서버 미경유)
      setProgress('영상 올리는 중…');
      const supabase = createClientBrowser();
      const { error: upErr } = await supabase.storage
        .from(MEDIA_BUCKET)
        .uploadToSignedUrl(sign.path, sign.token, file);
      if (upErr) throw new Error(upErr.message);

      // 3) 잡 생성
      setProgress('분석 요청 중…');
      const jobRes = await fetch('/api/ajudge/jobs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          jobId: sign.jobId,
          videoPath: sign.path,
          role: meta.role,
          leaderSide: meta.leaderSide,
          songTitle: meta.songTitle,
          contestId: null,
        }),
      });
      const job = await jobRes.json();
      if (!jobRes.ok) throw new Error(job.message ?? job.error);

      router.push(`/ajudge/jobs/${job.jobId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '요청에 실패했습니다.');
      setBusy(false);
      setProgress('');
    }
  }

  return (
    <div style={{ paddingTop: 8 }}>
      <h1 className="jnj-h2" style={{ margin: 0, color: 'var(--jnj-text)' }}>
        영상 분석
      </h1>
      <p className="jnj-caption" style={{ margin: '8px 0 0' }}>
        머리부터 발끝까지 나오는 3분 이내 영상을 올려 주세요.
        <br />
        비트는 영상 소리에서 자동으로 분석합니다.
      </p>

      {/* 탭 */}
      <div style={{ ...SEGMENT_WRAP, marginTop: 20 }}>
        {(
          [
            ['upload', '파일 업로드'],
            ['record', '직접 촬영'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            style={{ ...SEGMENT_BTN, ...(tab === k ? SEGMENT_ON : SEGMENT_OFF) }}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 16 }}>
        {tab === 'upload' ? (
          <UploadPanel file={file} onPick={setFile} />
        ) : (
          <RecordPanel onRecorded={setFile} />
        )}
      </div>

      <div style={{ marginTop: 24 }}>
        <MetaForm value={meta} onChange={setMeta} />
      </div>

      <div style={{ marginTop: 32 }}>
        <button
          type="button"
          disabled={!ready}
          onClick={submit}
          className="jnj-btn jnj-btn-primary jnj-btn-full jnj-btn-lg"
        >
          {busy ? progress || '처리 중…' : '분석 시작'}
        </button>
        {!file && (
          <p className="jnj-small jnj-text-center" style={{ margin: '8px 0 0' }}>
            먼저 영상을 올리거나 촬영해 주세요.
          </p>
        )}
        {meta.role === 'couple' && !meta.leaderSide && file && (
          <p
            className="jnj-small jnj-text-center"
            style={{ margin: '8px 0 0', color: 'var(--jnj-red)' }}
          >
            커플 모드는 리더 위치를 선택해 주세요.
          </p>
        )}
        {error && (
          <p
            role="alert"
            style={{
              margin: '12px 0 0',
              border: '1px solid var(--jnj-red)',
              borderRadius: 'var(--jnj-radius-sm)',
              padding: '10px 14px',
              color: 'var(--jnj-red)',
              fontSize: 14,
              lineHeight: 1.5,
              textAlign: 'center',
            }}
          >
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
