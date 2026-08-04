// 역할·리더위치·곡명 입력. 스펙 4.1 + Plan Q5(리더 위치).
//
// 스타일은 JNJ Mobile Design System(app/join/join.css)만 쓴다.
// 선택지는 .jnj-card + .jnj-card-clickable, 입력은 .jnj-field + .jnj-label + .jnj-input.
'use client';

import type { CSSProperties } from 'react';
import type { JobRole, LeaderSide } from '@/lib/ai-judge/types';

export interface MetaValue {
  role: JobRole;
  leaderSide: LeaderSide;
  songTitle: string;
}

const ROLES: { value: JobRole; label: string; hint: string }[] = [
  { value: 'leader', label: '리더', hint: '혼자 나오는 영상' },
  { value: 'follower', label: '팔로워', hint: '혼자 나오는 영상' },
  { value: 'couple', label: '커플', hint: '두 사람이 나오는 영상' },
];

/** 선택지 카드 — 선택 시 포인트색으로 반전된다. */
function choiceStyle(active: boolean): CSSProperties {
  return {
    padding: '14px 10px',
    textAlign: 'center',
    fontFamily: 'inherit',
    fontSize: 14,
    fontWeight: 500,
    lineHeight: 1.3,
    background: active ? 'var(--jnj-accent)' : 'var(--jnj-surface)',
    color: active ? 'var(--jnj-on-accent)' : 'var(--jnj-text-muted)',
    borderColor: active ? 'var(--jnj-accent)' : 'var(--jnj-border)',
    transition: 'background 200ms, color 200ms, border-color 200ms',
  };
}

export function MetaForm({
  value,
  onChange,
}: {
  value: MetaValue;
  onChange: (v: MetaValue) => void;
}) {
  const set = (patch: Partial<MetaValue>) => onChange({ ...value, ...patch });

  return (
    <div className="jnj-stack-6">
      <section>
        <h2 className="jnj-section-title">역할</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {ROLES.map((r) => {
            const active = value.role === r.value;
            return (
              <button
                key={r.value}
                type="button"
                onClick={() =>
                  set({ role: r.value, leaderSide: r.value === 'couple' ? value.leaderSide : '' })
                }
                className="jnj-card jnj-card-clickable"
                style={choiceStyle(active)}
              >
                <span style={{ display: 'block' }}>{r.label}</span>
                <span style={{ display: 'block', marginTop: 4, fontSize: 11, opacity: 0.7 }}>
                  {r.hint}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 커플 모드에서만 노출. 영상만으로는 누가 리더인지 판정할 수 없다. */}
      {value.role === 'couple' && (
        <section>
          <h2 className="jnj-section-title" style={{ marginBottom: 6 }}>
            리더 위치
          </h2>
          <p className="jnj-small" style={{ margin: '0 0 12px' }}>
            영상에서 리더가 어느 쪽에 있는지 알려주세요. 파트너 싱크로 지표 계산에 필요합니다.
          </p>
          <div className="jnj-grid-2">
            {(['left', 'right'] as const).map((side) => {
              const active = value.leaderSide === side;
              return (
                <button
                  key={side}
                  type="button"
                  onClick={() => set({ leaderSide: side })}
                  className="jnj-card jnj-card-clickable"
                  style={choiceStyle(active)}
                >
                  {side === 'left' ? '← 왼쪽' : '오른쪽 →'}
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <label className="jnj-field">
          <span className="jnj-label">
            곡명 <span style={{ fontWeight: 400 }}>(선택)</span>
          </span>
          <span className="jnj-small" style={{ display: 'block' }}>
            비트는 영상의 소리에서 자동으로 분석합니다. 곡명은 리포트 표시에만 씁니다.
          </span>
          <input
            type="text"
            className="jnj-input"
            value={value.songTitle}
            onChange={(e) => set({ songTitle: e.target.value })}
            placeholder="예: Bailando"
          />
        </label>
      </section>
    </div>
  );
}
