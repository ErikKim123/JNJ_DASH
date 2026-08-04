// 분석 대기 — 스펙 4.2. 5초 폴링으로 상태를 확인하고 완료 시 리포트로 보낸다.
//
// 스타일은 JNJ Mobile Design System(app/join/join.css) 토큰·클래스만 사용한다.
// 폭·좌우 패딩·배경은 셸(app/ajudge/layout.tsx)이 잡으므로 여기서 다시 잡지 않는다.
'use client';

import { useRouter } from 'next/navigation';
import { use, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { STAGES } from '@/lib/ai-judge/format';
import { createClientBrowser, MEDIA_BUCKET } from '@/lib/ai-judge/supabase-browser';
import type { JobSummary } from '@/lib/ai-judge/types';

const POLL_MS = 5000;
const MAX_MINUTES = 20;

/** 화면 최상단 여백 — 셸 헤더 아래 숨 쉴 공간. */
const TOP_PAD = 12;

export default function JobPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = use(params);
  const router = useRouter();
  const [job, setJob] = useState<JobSummary | null>(null);
  const [error, setError] = useState('');
  const [timedOut, setTimedOut] = useState(false);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    let alive = true;

    async function poll() {
      try {
        const res = await fetch(`/api/ajudge/jobs/${jobId}`, { cache: 'no-store' });
        const data = await res.json();
        if (!alive) return;
        if (!res.ok) {
          setError(data.message ?? data.error ?? '상태를 가져오지 못했습니다.');
          return;
        }
        setJob(data);
        if (data.status === 'done' && data.reportId) {
          router.replace(`/ajudge/report/${data.reportId}`);
          return;
        }
        if (data.status === 'failed') return;
        if (Date.now() - startedAt.current > MAX_MINUTES * 60_000) {
          setTimedOut(true);
          return;
        }
        setTimeout(poll, POLL_MS);
      } catch {
        if (alive) setTimeout(poll, POLL_MS);
      }
    }

    poll();
    return () => {
      alive = false;
    };
  }, [jobId, router]);

  if (error) {
    return <Notice title="오류" body={error} />;
  }
  if (timedOut) {
    return (
      <Notice
        title="시간이 오래 걸리고 있습니다"
        body="분석이 예상보다 지연되고 있습니다. 잠시 후 히스토리에서 확인해 주세요."
      />
    );
  }
  if (!job) {
    return (
      <div className="jnj-caption jnj-text-center" style={{ padding: '64px 0' }}>
        상태 확인 중…
      </div>
    );
  }

  if (job.status === 'failed') {
    return <JobFailed jobId={jobId} code={job.errorCode} />;
  }

  return (
    <div style={{ paddingTop: TOP_PAD }}>
      <h1 className="jnj-h2" style={{ margin: 0 }}>
        분석 중
      </h1>
      <p className="jnj-caption" style={{ margin: '8px 0 28px' }}>
        3분 영상 기준 2~3분 정도 걸립니다. 이 화면을 닫아도 계속 진행됩니다.
      </p>
      <StageStepper current={job.stageIndex} />
    </div>
  );
}

function StageStepper({ current }: { current: number }) {
  return (
    <ol
      style={{
        listStyle: 'none',
        margin: 0,
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {STAGES.map((s, i) => {
        const done = i < current;
        const active = i === current;

        // 스테퍼 원형 뱃지 — 완료 / 진행중 / 대기 세 상태.
        const badge: React.CSSProperties = done
          ? {
              background: 'var(--jnj-accent)',
              color: 'var(--jnj-on-accent)',
              border: '1px solid var(--jnj-accent)',
            }
          : active
            ? {
                background: 'transparent',
                color: 'var(--jnj-accent)',
                border: '1px solid var(--jnj-accent)',
              }
            : {
                background: 'transparent',
                color: 'var(--jnj-text-muted)',
                border: '1px solid var(--jnj-border)',
              };

        return (
          <li key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span
              style={{
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
                width: 28,
                height: 28,
                borderRadius: 9999,
                fontSize: 12,
                fontWeight: 500,
                lineHeight: 1,
                ...badge,
              }}
            >
              {done ? '✓' : i + 1}
            </span>
            <span
              style={{
                fontSize: 14,
                fontWeight: 500,
                color: active ? 'var(--jnj-text)' : 'var(--jnj-text-muted)',
                opacity: done || active ? 1 : 0.6,
              }}
            >
              {s.label}
            </span>
            {active && (
              <span
                style={{
                  marginLeft: 'auto',
                  width: 6,
                  height: 6,
                  borderRadius: 9999,
                  background: 'var(--jnj-accent)',
                }}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function JobFailed({ jobId, code }: { jobId: string; code: string }) {
  // 오디오 추출 실패만 사용자가 바로 조치할 수 있다 — 원곡 업로드 폴백(스펙 4.1).
  if (code === 'AUDIO_EXTRACT_FAILED') {
    return <SongFallback jobId={jobId} />;
  }

  const MESSAGES: Record<string, string> = {
    DURATION_EXCEEDED: '영상이 3분을 넘습니다. 3분 이내로 잘라서 다시 올려 주세요.',
    POSE_EXTRACT_FAILED:
      '영상에서 사람을 인식하지 못했습니다. 밝은 곳에서 전신이 나오게 다시 촬영해 주세요.',
    PERSON_COUNT_MISMATCH:
      '커플 모드인데 두 사람을 찾지 못했습니다. 역할 선택이나 영상을 확인해 주세요.',
    INTERNAL: '처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.',
  };

  return (
    <Notice
      title="분석에 실패했습니다"
      body={MESSAGES[code] ?? MESSAGES.INTERNAL}
      code={code}
    />
  );
}

function SongFallback({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function upload(file: File) {
    setBusy(true);
    setError('');
    try {
      const signRes = await fetch('/api/ajudge/uploads', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          kind: 'song',
          contentType: file.type || 'audio/mpeg',
          sizeBytes: file.size,
          jobId,
        }),
      });
      const sign = await signRes.json();
      if (!signRes.ok) throw new Error(sign.message ?? sign.error);

      const supabase = createClientBrowser();
      const { error: upErr } = await supabase.storage
        .from(MEDIA_BUCKET)
        .uploadToSignedUrl(sign.path, sign.token, file);
      if (upErr) throw new Error(upErr.message);

      const res = await fetch(`/api/ajudge/jobs/${jobId}/song`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ audioPath: sign.path }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error);

      router.refresh();
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : '업로드에 실패했습니다.');
      setBusy(false);
    }
  }

  return (
    <div style={{ paddingTop: TOP_PAD }}>
      <p
        className="jnj-text-center"
        style={{ fontSize: 34, lineHeight: 1, margin: '20px 0 14px' }}
      >
        🎵
      </p>
      <h1 className="jnj-h2 jnj-text-center" style={{ margin: 0 }}>
        음악을 찾지 못했습니다
      </h1>
      <p className="jnj-caption jnj-text-center" style={{ margin: '10px 0 24px' }}>
        영상 소리에서 박자를 추출하지 못했습니다.
        <br />
        원곡 파일을 올려주시면 그 소리로 분석합니다.
      </p>

      <label style={{ display: 'block' }}>
        <input
          type="file"
          accept="audio/mpeg,audio/wav,audio/mp4,audio/aac"
          style={{ display: 'none' }}
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
          }}
        />
        <span
          className="jnj-btn jnj-btn-primary jnj-btn-full jnj-btn-lg"
          style={
            busy
              ? {
                  background: 'var(--jnj-track)',
                  color: 'var(--jnj-text-muted)',
                  cursor: 'not-allowed',
                }
              : undefined
          }
        >
          {busy ? '올리는 중…' : '원곡 파일 고르기'}
        </span>
      </label>
      <p className="jnj-small jnj-text-center" style={{ margin: '8px 0 0' }}>
        mp3 · wav · m4a
      </p>

      {error && (
        <p
          role="alert"
          style={{
            margin: '16px 0 0',
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
  );
}

function Notice({ title, body, code }: { title: string; body: string; code?: string }) {
  return (
    <div style={{ paddingTop: TOP_PAD }}>
      <h1 className="jnj-h2 jnj-text-center" style={{ margin: '32px 0 0' }}>
        {title}
      </h1>

      <div className="jnj-card jnj-text-center" style={{ marginTop: 16 }}>
        <p className="jnj-caption" style={{ margin: 0 }}>
          {body}
        </p>
        {code && (
          <p className="jnj-mono jnj-small" style={{ margin: '10px 0 0', opacity: 0.7 }}>
            {code}
          </p>
        )}
      </div>

      <Link
        href="/ajudge"
        className="jnj-btn jnj-btn-primary jnj-btn-full"
        style={{ marginTop: 16 }}
      >
        새 영상 분석하기
      </Link>
    </div>
  );
}
