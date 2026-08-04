// 지표 카드 — 스펙 4.3.
//
// ⚠️ 절대 원칙 1 (docs/rubric.md §1.2) 의 UI 강제점:
//    ScoredMetricCard 는 온비트율 전용이다(Timing 축).
//    나머지는 ReferenceIndexCard 로만 그릴 수 있고, "참고 지표 · 점수 아님"
//    배지가 컴포넌트 내부에 하드코딩되어 있어 호출부에서 제거할 수 없다.
//
// 스타일은 JNJ Mobile Design System(app/join/join.css) 토큰만 사용한다.
'use client';

import type { ReportAvailable } from '@/lib/ai-judge/types';

/** 참고 지표 배지 — 절대 원칙 1. 호출부에서 제거 불가. */
const REFERENCE_BADGE: React.CSSProperties = {
  padding: '2px 8px',
  borderRadius: 'var(--jnj-radius-pill)',
  background: 'var(--jnj-track)',
  border: '1px solid var(--jnj-border)',
  color: 'var(--jnj-text-muted)',
  fontSize: 10,
  lineHeight: 1.4,
  whiteSpace: 'nowrap',
};

/** Timing 축 점수. 이 컴포넌트는 온비트율에만 쓴다. */
export function ScoredMetricCard({ onbeatRatio }: { onbeatRatio: number }) {
  return (
    <div className="jnj-card" style={{ borderColor: 'var(--jnj-accent)' }}>
      <p className="jnj-mono jnj-small" style={{ margin: 0 }}>
        온비트율
      </p>
      <p
        className="jnj-display"
        style={{
          margin: '10px 0 0',
          fontSize: 48,
          color: 'var(--jnj-accent)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {onbeatRatio.toFixed(1)}
        <span style={{ fontSize: 20, marginLeft: 2 }}>%</span>
      </p>
      <p className="jnj-small" style={{ margin: '10px 0 0' }}>
        비트에 맞춰 움직인 동작의 비율
      </p>
    </div>
  );
}

/** 참고 지표. 점수가 아니며 순위·합불에 쓰지 않는다. */
export function ReferenceIndexCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | null;
  hint: string;
}) {
  return (
    <div className="jnj-card">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 6,
        }}
      >
        <p className="jnj-mono jnj-small" style={{ margin: 0 }}>
          {label}
        </p>
        {/* 이 배지는 제거할 수 없다 — 절대 원칙 1 */}
        <span className="jnj-mono" style={REFERENCE_BADGE}>
          참고 지표
        </span>
      </div>
      <p
        className="jnj-display"
        style={{
          margin: '10px 0 0',
          fontSize: 32,
          color: 'var(--jnj-text-muted)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value === null ? '—' : value.toFixed(0)}
      </p>
      <p className="jnj-small" style={{ margin: '10px 0 0' }}>
        {hint}
      </p>
    </div>
  );
}

export function MetricCards({ report }: { report: ReportAvailable }) {
  const isCouple = report.syncIndex !== null;
  return (
    <section className="jnj-stack-3">
      <ScoredMetricCard onbeatRatio={report.onbeatRatio} />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isCouple ? '1fr 1fr' : '1fr',
          gap: 12,
        }}
      >
        {isCouple && (
          <ReferenceIndexCard
            label="파트너 싱크로"
            value={report.syncIndex}
            hint="두 사람 동작의 일치 정도"
          />
        )}
        <ReferenceIndexCard
          label="음악 반응도"
          value={report.activityIndex}
          hint="음악 세기 변화에 움직임이 따라간 정도"
        />
      </div>
      <p className="jnj-small" style={{ margin: 0 }}>
        점수는 온비트율 하나입니다. 나머지는 참고용 수치이며 순위나 합격 판정에
        사용하지 않습니다.
      </p>
    </section>
  );
}
