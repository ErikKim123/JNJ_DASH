// 리포트 메인 — 스펙 4.3.
// 색·타이포는 JNJ Mobile Design System(app/join/join.css) 토큰/클래스만 사용한다.
'use client';

import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { ConfidenceGate } from '@/components/ai-judge/ConfidenceGate';
import { CommentSections } from '@/components/ai-judge/report/CommentSections';
import { MetricCards } from '@/components/ai-judge/report/MetricCards';
import { OnbeatTimeline } from '@/components/ai-judge/report/OnbeatTimeline';
import { VideoOverlayPlayer } from '@/components/ai-judge/report/VideoOverlayPlayer';
import { ROLE_LABEL } from '@/lib/ai-judge/format';
import { isUnavailable, type ReportResponse } from '@/lib/ai-judge/types';

type Payload = ReportResponse & { media: { trackUrl?: string | null } };

export default function ReportPage({ params }: { params: Promise<{ reportId: string }> }) {
  const { reportId } = use(params);
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState('');
  const [seekTo, setSeekTo] = useState<number | null>(null);

  useEffect(() => {
    fetch(`/api/ajudge/reports/${reportId}`, { cache: 'no-store' })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.message ?? j.error);
        return j as Payload;
      })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : '리포트를 불러오지 못했습니다.'));
  }, [reportId]);

  if (error) {
    return (
      <div style={{ padding: '48px 0', textAlign: 'center' }}>
        <p
          style={{
            border: '1px solid var(--jnj-red)',
            borderRadius: 'var(--jnj-radius-sm)',
            padding: '10px 14px',
            color: 'var(--jnj-red)',
            fontSize: 14,
            lineHeight: 1.5,
            textAlign: 'left',
            margin: 0,
          }}
        >
          {error}
        </p>
        <Link
          href="/ajudge"
          className="jnj-btn jnj-btn-primary"
          style={{ marginTop: 24 }}
        >
          새 영상 분석하기
        </Link>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="jnj-caption jnj-text-center" style={{ padding: '48px 0' }}>
        리포트 불러오는 중…
      </div>
    );
  }

  const { report, job, media } = data;

  return (
    <div style={{ paddingTop: 8 }}>
      {/* 상단 메타 — 신뢰도 배지는 low 여부와 무관하게 항상 보여준다 */}
      <header style={{ marginBottom: 20 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 8,
            marginBottom: 8,
          }}
        >
          <ConfidenceBadge level={report.confidence} />
          <span className="jnj-small">{ROLE_LABEL[job.role]}</span>
          {job.songTitle && <span className="jnj-small">· {job.songTitle}</span>}
          {job.contestId && <span className="jnj-small">· {job.contestId}</span>}
        </div>
        <h1 className="jnj-h2" style={{ margin: 0, color: 'var(--jnj-text)' }}>
          분석 리포트
        </h1>
      </header>

      <ConfidenceGate report={report}>
        {!isUnavailable(report) && (
          <div className="jnj-stack-6">
            <VideoOverlayPlayer
              videoUrl={media.videoUrl}
              trackUrl={media.trackUrl ?? null}
              metrics={report.metrics}
              seekTo={seekTo}
            />

            <OnbeatTimeline metrics={report.metrics} onSeek={setSeekTo} />

            <MetricCards report={report} />

            <CommentSections comments={report.comments} />

            <div className="jnj-grid-2" style={{ paddingTop: 8 }}>
              <Link
                href={`/ajudge/report/${reportId}/segments`}
                className="jnj-btn jnj-btn-primary"
                style={{ padding: '14px 12px' }}
              >
                구간 상세 보기
              </Link>
              <button
                type="button"
                onClick={() => window.print()}
                className="jnj-btn jnj-btn-secondary"
                style={{ padding: '14px 12px' }}
              >
                PDF 저장
              </button>
            </div>
          </div>
        )}
      </ConfidenceGate>
    </div>
  );
}

function ConfidenceBadge({ level }: { level: 'high' | 'medium' | 'low' }) {
  // 다크 셸 위 3단계 톤 — 팔레트에 앰버가 없으므로 medium 은 보조 글자색으로 둔다.
  const tone = {
    high: 'var(--jnj-green)',
    medium: 'var(--jnj-text-muted)',
    low: 'var(--jnj-red)',
  }[level];
  const label = { high: '신뢰도 높음', medium: '신뢰도 보통', low: '신뢰도 낮음' }[level];
  return (
    <span
      className="jnj-mono"
      style={{
        display: 'inline-block',
        border: `1px solid ${tone}`,
        borderRadius: 'var(--jnj-radius-sm)',
        padding: '3px 8px',
        fontSize: 11,
        lineHeight: 1.4,
        fontWeight: 500,
        color: tone,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}
