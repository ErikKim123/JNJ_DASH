// 오프비트 구간 카드 — 스펙 4.4.
// 타임코드 · 유형 · 평균 오프셋 · 비트별 미니 바차트 · danger 배지 · 코칭 문장.
// 색·타이포는 JNJ Mobile Design System(app/join/join.css) 토큰/클래스만 사용한다.
'use client';

import {
  CONTEXT_COACHING,
  PENALTY_LABEL,
  SEGMENT_CONTEXT_LABEL,
  SEGMENT_TYPE_LABEL,
  gradeOffset,
  offsetLabel,
  tcToSeconds,
  type BeatGrade,
} from '@/lib/ai-judge/format';
import type { OffbeatSegment } from '@/lib/ai-judge/types';

/** 비트 등급별 색 — 팔레트에 앰버가 없으므로 '경미'는 보조 글자색으로 둔다. */
const GRADE_TONE: Record<BeatGrade, string> = {
  onbeat: 'var(--jnj-green)',
  minor: 'var(--jnj-text-muted)',
  offbeat: 'var(--jnj-red)',
};

/** 배지 공통 — 유형/주의 배지가 같은 형태를 쓴다. */
const BADGE: React.CSSProperties = {
  display: 'inline-block',
  borderRadius: 'var(--jnj-radius-sm)',
  padding: '3px 8px',
  fontSize: 11,
  lineHeight: 1.4,
  fontWeight: 500,
  whiteSpace: 'nowrap',
};

/** 유형(밀림/당김/브레이크 무시)은 팔레트에 색이 더 없으므로 라벨 텍스트로 구분한다. */
const TYPE_BADGE: React.CSSProperties = {
  ...BADGE,
  border: '1px solid var(--jnj-border)',
  background: 'var(--jnj-track)',
  color: 'var(--jnj-text)',
};

const PENALTY_BADGE: React.CSSProperties = {
  ...BADGE,
  border: '1px solid var(--jnj-red)',
  background: 'transparent',
  color: 'var(--jnj-red)',
  whiteSpace: 'normal',
};

export function SegmentCard({
  segment,
  index,
  coaching,
  thresholds,
  onSeek,
}: {
  segment: OffbeatSegment;
  index: number;
  coaching?: string;
  thresholds: { onbeat_ms: number; minor_ms: number };
  onSeek?: (sec: number) => void;
}) {
  const start = tcToSeconds(segment.start_tc);
  const peak = Math.max(1, ...segment.beat_offsets_ms.map((v) => Math.abs(v)));

  return (
    <article className="jnj-card">
      <header
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 8,
          marginBottom: 12,
        }}
      >
        <button
          type="button"
          onClick={() => onSeek?.(start)}
          className="jnj-mono"
          style={{
            background: 'transparent',
            border: 'none',
            padding: 0,
            fontSize: 12,
            color: 'var(--jnj-text)',
            cursor: 'pointer',
            textDecoration: 'underline',
            textDecorationStyle: 'dotted',
            textUnderlineOffset: 3,
          }}
        >
          {segment.start_tc.slice(3, 12)} → {segment.end_tc.slice(3, 12)}
        </button>
        <span className="jnj-mono" style={TYPE_BADGE}>
          {SEGMENT_TYPE_LABEL[segment.type]}
        </span>
        {segment.penalty_trigger && (
          <span
            className="jnj-mono"
            style={PENALTY_BADGE}
            title={segment.penalty_codes.map((c) => `${c} ${PENALTY_LABEL[c]}`).join(', ')}
          >
            ⚠ {segment.penalty_codes.map((c) => PENALTY_LABEL[c]).join(' · ')}
          </span>
        )}
        <span
          className="jnj-mono"
          style={{
            marginLeft: 'auto',
            fontSize: 12,
            color: 'var(--jnj-text-muted)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          평균 {offsetLabel(segment.avg_offset_ms)}
        </span>
      </header>

      {/* 비트별 오프셋 미니 바차트 — 중앙선이 정확한 비트 */}
      <div style={{ marginBottom: 12 }}>
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            height: 56,
            gap: 2,
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: '50%',
              height: 1,
              background: 'var(--jnj-border)',
            }}
          />
          {segment.beat_offsets_ms.map((ms, i) => {
            const grade = gradeOffset(ms, thresholds);
            const ratio = Math.min(1, Math.abs(ms) / peak);
            const height = 6 + ratio * 22;
            return (
              <div
                key={i}
                style={{ position: 'relative', flex: 1 }}
                title={`${Math.round(ms)}ms`}
              >
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    width: '100%',
                    borderRadius: 2,
                    background: GRADE_TONE[grade],
                    ...(ms >= 0 ? { top: '50%', height } : { bottom: '50%', height }),
                  }}
                />
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span className="jnj-small" style={{ fontSize: 10 }}>
            ↑ 밀림
          </span>
          <span className="jnj-mono jnj-small" style={{ fontSize: 10 }}>
            {segment.beat_offsets_ms.length}비트
          </span>
          <span className="jnj-small" style={{ fontSize: 10 }}>
            ↓ 당김
          </span>
        </div>
      </div>

      <div
        style={{
          background: 'var(--jnj-track)',
          borderRadius: 'var(--jnj-radius-sm)',
          padding: '12px 14px',
        }}
      >
        <p className="jnj-mono jnj-small" style={{ margin: '0 0 4px', fontSize: 11 }}>
          추정 상황 · {SEGMENT_CONTEXT_LABEL[segment.context]}
        </p>
        <p className="jnj-caption" style={{ margin: 0, lineHeight: 1.7 }}>
          {coaching || CONTEXT_COACHING[segment.context]}
        </p>
      </div>

      <p
        className="jnj-mono jnj-small"
        style={{ margin: '8px 0 0', textAlign: 'right', fontSize: 10 }}
      >
        #{index + 1}
      </p>
    </article>
  );
}
