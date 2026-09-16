'use client';

import * as React from 'react';

/**
 * 판정 세 갈래.
 *   fail = OFF(0표) · may = 1/2(0.5표, 노랑) · pass = ON(1표, 초록)
 * 'absent'(불참)는 운영자가 따로 처리하므로 심사위원 화면에는 없다.
 */
type Verdict = 'pass' | 'may' | 'fail' | null;
export type RowStatus = 'idle' | 'submitting' | 'saved';

type Props = {
  value: Verdict;
  onChange: (next: Verdict) => void;
  onSubmit?: () => void;
  status?: RowStatus;
  disabled?: boolean;
};

export function PassFailToggle({
  value,
  onChange,
  onSubmit,
  status = 'idle',
  disabled = false,
}: Props): React.ReactElement {
  const locked = status === 'saved';
  const submitting = status === 'submitting';
  const togglesDisabled = disabled || locked || submitting;
  const submitDisabled =
    disabled || locked || submitting || value === null || !onSubmit;

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--jnj-space-2)',
      }}
    >
      <VoteSwitch
        value={value}
        onChange={onChange}
        disabled={togglesDisabled}
      />
      {onSubmit && (
        <SubmitPill
          active={locked}
          disabled={submitDisabled}
          onClick={() => onSubmit?.()}
          label={submitting ? 'Saving' : locked ? 'Done' : 'Submit'}
        />
      )}
    </div>
  );
}

// 왼쪽 OFF · 가운데 MAY · 오른쪽 ON 3단 스위치.
//
// 이전에는 두 갈래 토글이라 누를 때마다 뒤집히면 됐지만, 세 갈래부터는
// '몇 번 눌러야 원하는 칸에 닿는지' 를 세게 만들면 안 된다 — 심사 중에는
// 손가락이 급하다. 그래서 각 칸을 직접 누르는 세그먼트 방식으로 바꾼다.
//
// 데이터 대응: OFF → 'fail'(X) · MAY → 'may'(M) · ON → 'pass'(O).
// 초기 null 은 OFF 로 보이고, 실제 제출 시에도 X 로 기록된다(종전과 동일).
const SEGMENTS: { key: Exclude<Verdict, null>; label: string }[] = [
  { key: 'fail', label: 'OFF' },
  { key: 'may', label: '1/2' },
  { key: 'pass', label: 'ON' },
];

/** 칸별 선택 색 — 1/2 은 노랑(검은 글자라야 읽힌다), ON 은 초록. */
const SEG_STYLE: Record<
  Exclude<Verdict, null>,
  { bg: string; fg: string; border: string }
> = {
  fail: {
    bg: 'var(--jnj-text-primary)',
    fg: 'var(--jnj-white)',
    border: 'var(--jnj-text-primary)',
  },
  may: {
    bg: 'var(--jnj-yellow)',
    fg: 'var(--jnj-black)',
    border: 'var(--jnj-yellow)',
  },
  pass: {
    bg: 'var(--jnj-green)',
    fg: 'var(--jnj-white)',
    border: 'var(--jnj-green)',
  },
};

function VoteSwitch({
  value,
  onChange,
  disabled,
}: {
  value: Verdict;
  onChange: (next: Verdict) => void;
  disabled: boolean;
}) {
  // null 은 아직 아무것도 안 누른 상태 — OFF 칸을 선택된 것처럼 보여 준다.
  const active: Exclude<Verdict, null> = value ?? 'fail';

  return (
    <div
      role="radiogroup"
      aria-label="VOTE"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
        padding: 2,
        background: 'var(--jnj-grey-100)',
        border: '1px solid var(--jnj-grey-300)',
        borderRadius: 'var(--jnj-radius-pill)',
        opacity: disabled ? 0.55 : 1,
      }}
    >
      {SEGMENTS.map((seg) => {
        const on = seg.key === active;
        const c = SEG_STYLE[seg.key];
        return (
          <button
            key={seg.key}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={`VOTE ${seg.label}`}
            disabled={disabled}
            onClick={() => {
              if (disabled) return;
              onChange(seg.key);
            }}
            style={{
              appearance: 'none',
              cursor: disabled ? 'not-allowed' : 'pointer',
              minWidth: 52,
              height: 32,
              padding: '0 var(--jnj-space-3)',
              borderRadius: 'var(--jnj-radius-pill)',
              fontFamily: 'var(--jnj-font-text-medium)',
              fontWeight: 600,
              fontSize: 'var(--jnj-size-btn-sm)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              background: on ? c.bg : 'transparent',
              color: on ? c.fg : 'var(--jnj-text-secondary)',
              border: `1px solid ${on ? c.border : 'transparent'}`,
              transition:
                'background var(--jnj-transition), color var(--jnj-transition), border-color var(--jnj-transition)',
            }}
          >
            {seg.label}
          </button>
        );
      })}
    </div>
  );
}

function SubmitPill({
  active,
  disabled,
  onClick,
  label,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        appearance: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'var(--jnj-font-text-medium)',
        fontWeight: 500,
        fontSize: 'var(--jnj-size-btn-sm)',
        letterSpacing: '0.04em',
        padding: 'var(--jnj-space-2) var(--jnj-space-4)',
        borderRadius: 'var(--jnj-radius-pill)',
        minWidth: 64,
        height: 36,
        background: 'var(--jnj-text-primary)',
        color: 'var(--jnj-white)',
        border: '1.5px solid var(--jnj-text-primary)',
        opacity: disabled ? 0.55 : 1,
        transition: 'var(--jnj-transition)',
      }}
      aria-pressed={active}
    >
      {label}
    </button>
  );
}
