// 구간 상세 — 스펙 4.4. 오프비트 구간 카드 리스트 + 종합 패턴 요약.
// 색·타이포는 JNJ Mobile Design System(app/join/join.css) 토큰/클래스만 사용한다.
'use client';

import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { ConfidenceGate } from '@/components/ai-judge/ConfidenceGate';
import { SegmentCard } from '@/components/ai-judge/segments/SegmentCard';
import { PENALTY_LABEL } from '@/lib/ai-judge/format';
import { isUnavailable, type Comments, type ReportResponse } from '@/lib/ai-judge/types';

/** 주의/안내 박스 공통 */
const NOTICE_BOX: React.CSSProperties = {
  border: '1px solid var(--jnj-border)',
  background: 'var(--jnj-surface)',
  borderRadius: 'var(--jnj-radius-lg)',
  padding: 16,
};

export default function SegmentsPage({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  const { reportId } = use(params);
  const [data, setData] = useState<ReportResponse | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/ajudge/reports/${reportId}`, { cache: 'no-store' })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.message ?? j.error);
        return j as ReportResponse;
      })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : '불러오지 못했습니다.'));
  }, [reportId]);

  if (error) {
    return (
      <div style={{ padding: '48px 0' }}>
        <p
          style={{
            border: '1px solid var(--jnj-red)',
            borderRadius: 'var(--jnj-radius-sm)',
            padding: '10px 14px',
            color: 'var(--jnj-red)',
            fontSize: 14,
            lineHeight: 1.5,
            margin: 0,
          }}
        >
          {error}
        </p>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="jnj-caption jnj-text-center" style={{ padding: '48px 0' }}>
        불러오는 중…
      </div>
    );
  }

  const { report } = data;

  return (
    <div style={{ paddingTop: 8 }}>
      <header style={{ marginBottom: 20 }}>
        <Link
          href={`/ajudge/report/${reportId}`}
          className="jnj-mono jnj-small"
          style={{
            display: 'inline-block',
            color: 'var(--jnj-text-muted)',
            textDecoration: 'none',
          }}
        >
          ← 리포트로
        </Link>
        <h1 className="jnj-h2" style={{ margin: '8px 0 0', color: 'var(--jnj-text)' }}>
          구간 상세
        </h1>
      </header>

      <ConfidenceGate report={report}>
        {!isUnavailable(report) && <SegmentList report={report} />}
      </ConfidenceGate>
    </div>
  );
}

function SegmentList({
  report,
}: {
  report: Extract<ReportResponse['report'], { confidence: 'high' | 'medium' }>;
}) {
  const segments = report.metrics.offbeat_segments ?? [];
  const comments = report.comments as Partial<Comments>;
  const coachingByIndex = new Map(
    (comments.segment_coaching ?? []).map((s) => [s.segment_index, s.coaching])
  );
  const triggered = segments.filter((s) => s.penalty_trigger);

  if (!segments.length) {
    return (
      <div
        className="jnj-card jnj-text-center"
        style={{ borderColor: 'var(--jnj-green)', padding: '32px 20px' }}
      >
        <p style={{ margin: 0, fontSize: 28, lineHeight: 1, color: 'var(--jnj-green)' }}>✓</p>
        <p
          className="jnj-body"
          style={{ margin: '12px 0 0', color: 'var(--jnj-green)', lineHeight: 1.5 }}
        >
          눈에 띄는 오프비트 구간이 없습니다.
        </p>
        <p className="jnj-caption" style={{ margin: '6px 0 0' }}>
          박자를 안정적으로 유지했습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="jnj-stack-6">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <span className="jnj-mono jnj-small">오프비트 구간 {segments.length}개</span>
        {triggered.length > 0 && (
          <span className="jnj-mono jnj-small" style={{ color: 'var(--jnj-red)' }}>
            주의 구간 {triggered.length}개
          </span>
        )}
      </div>

      <div className="jnj-stack-3">
        {segments.map((s, i) => (
          <SegmentCard
            key={`${s.start_tc}-${i}`}
            segment={s}
            index={i}
            coaching={coachingByIndex.get(i)}
            thresholds={report.metrics.thresholds}
          />
        ))}
      </div>

      {/* 종합 패턴 요약 — Claude 생성 (스펙 4.4 하단) */}
      {comments.offbeat_pattern_summary && (
        <section className="jnj-card">
          <h2 className="jnj-section-title" style={{ margin: '0 0 12px' }}>
            종합 패턴
          </h2>
          <p
            className="jnj-caption"
            style={{ margin: 0, whiteSpace: 'pre-line', lineHeight: 1.7 }}
          >
            {comments.offbeat_pattern_summary}
          </p>
        </section>
      )}

      {triggered.length > 0 && (
        <section style={NOTICE_BOX}>
          <h3 className="jnj-section-title" style={{ margin: '0 0 8px' }}>
            주의 구간이란
          </h3>
          <p className="jnj-small" style={{ margin: 0, lineHeight: 1.7 }}>
            심사 기준상 눈에 띄기 쉬운 패턴을 표시한 것입니다.
            <span style={{ color: 'var(--jnj-text)' }}> 점수를 깎지 않으며</span>, 순위나 합격
            판정에도 사용하지 않습니다.
          </p>
          <ul
            style={{
              listStyle: 'none',
              margin: '12px 0 0',
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            {Object.entries(PENALTY_LABEL).map(([code, label]) => (
              <li key={code} className="jnj-mono jnj-small" style={{ fontSize: 11 }}>
                {code} · {label}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
