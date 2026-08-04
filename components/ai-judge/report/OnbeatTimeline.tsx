// 구간별 온비트 타임라인 — 스펙 4.3. 클릭 시 해당 지점 재생.
//
// 색 구분 임계값은 워커가 metrics.thresholds 에 기록한 값을 그대로 쓴다.
// 화면에서 다시 계산하면 rubric 과 어긋날 수 있다.
//
// 막대 색은 JNJ 팔레트(app/join/join.css 토큰)로 맞춘다:
// 온비트=포인트(흰색) / 경미=보조 회색 / 오프비트=레드.
'use client';

import { gradeOffset, shortTime, type BeatGrade } from '@/lib/ai-judge/format';
import type { Metrics } from '@/lib/ai-judge/types';

/** 등급별 막대 색 — 토큰만 사용한다. */
const GRADE_BAR: Record<BeatGrade, string> = {
  onbeat: 'var(--jnj-accent)',
  minor: 'var(--jnj-text-muted)',
  offbeat: 'var(--jnj-red)',
};

export function OnbeatTimeline({
  metrics,
  onSeek,
}: {
  metrics: Metrics;
  onSeek: (sec: number) => void;
}) {
  const offsets = metrics.timing.beat_offsets_ms ?? [];
  const duration = metrics.video.duration_sec || 1;

  if (!offsets.length) {
    return (
      <p
        className="jnj-caption jnj-text-center"
        style={{
          margin: 0,
          border: '1px dashed var(--jnj-border)',
          borderRadius: 'var(--jnj-radius-lg)',
          background: 'var(--jnj-surface)',
          color: 'var(--jnj-text-muted)',
          padding: '18px 16px',
        }}
      >
        동작을 충분히 감지하지 못해 타임라인을 만들지 못했습니다.
      </p>
    );
  }

  // 온셋은 시각 정보를 따로 갖고 있지 않으므로 균등 분포로 근사한다.
  // 정확한 구간 위치는 아래 offbeat_segments 가 타임코드로 갖고 있다.
  const step = duration / offsets.length;

  return (
    <section>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 8,
        }}
      >
        <h2 className="jnj-section-title" style={{ marginBottom: 0 }}>
          구간별 온비트
        </h2>
        <span className="jnj-mono jnj-small" style={{ whiteSpace: 'nowrap' }}>
          ±{metrics.thresholds.onbeat_ms}ms 이내 = 온비트
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 1,
          height: 40,
          width: '100%',
          overflow: 'hidden',
          borderRadius: 'var(--jnj-radius-sm)',
          background: 'var(--jnj-track)',
        }}
      >
        {offsets.map((ms, i) => {
          const grade = gradeOffset(ms, metrics.thresholds);
          const t = i * step;
          return (
            <button
              key={i}
              type="button"
              title={`${shortTime(t)} · ${Math.round(ms) > 0 ? '+' : ''}${Math.round(ms)}ms`}
              onClick={() => onSeek(t)}
              style={{
                flex: 1,
                minWidth: 1,
                height: '100%',
                padding: 0,
                border: 'none',
                cursor: 'pointer',
                background: GRADE_BAR[grade],
              }}
            />
          );
        })}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginTop: 8,
        }}
      >
        <Legend color="var(--jnj-accent)" label="온비트" />
        <Legend color="var(--jnj-text-muted)" label="경미" />
        <Legend color="var(--jnj-red)" label="오프비트" />
        <span className="jnj-mono jnj-small" style={{ marginLeft: 'auto' }}>
          {shortTime(duration)}
        </span>
      </div>
    </section>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span
      className="jnj-mono jnj-small"
      style={{ display: 'flex', alignItems: 'center', gap: 6 }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 2,
          background: color,
          flexShrink: 0,
        }}
      />
      {label}
    </span>
  );
}
