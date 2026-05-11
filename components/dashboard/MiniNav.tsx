// DISPLAY 모드 전용 미니 네비. 평소엔 흐릿하게 보이고 hover 시 선명해짐.
'use client';

import type { ContestMeta, RoundKey, StepKey } from '@/lib/sheets/types';

const ROUND_ORDER: RoundKey[] = ['prelim', 'semi', 'final'];
const STEP_LABEL: Record<StepKey, string> = {
  prep: 'PREP',
  pairing: 'PAIR',
  pairingB: 'PAIR-B',
  pairingC: 'PAIR-C',
  open: 'OPEN',
  live: 'LIVE',
  wrapup: 'CALC',
  close: 'CLOSE',
  result: 'RES',
  ceremony: 'CER',
};

// 같은 라운드에 pairingB/C가 있으면 'pairing'은 'PAIR-A'로 명시.
function labelFor(s: StepKey, steps: ReadonlyArray<StepKey>): string {
  if (
    s === 'pairing' &&
    (steps.includes('pairingB') || steps.includes('pairingC'))
  ) {
    return 'PAIR-A';
  }
  return STEP_LABEL[s];
}

export function MiniNav({
  meta,
  round,
  step,
  onRoundSelect,
  onStepSelect,
}: {
  meta: ContestMeta;
  round: RoundKey;
  step: StepKey;
  onRoundSelect: (round: RoundKey) => void;
  onStepSelect: (step: StepKey) => void;
}) {
  const steps = meta.rounds[round].steps;

  return (
    <div className="flex flex-col items-center gap-1 opacity-25 hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200">
      {/* 라운드: 1 / 2 / 3 */}
      <div className="flex gap-0.5 bg-panel/80 border border-border rounded px-1 py-0.5 backdrop-blur-sm">
        {ROUND_ORDER.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => onRoundSelect(key)}
            className={`px-1.5 py-0.5 text-[9px] font-mono tracking-wider rounded transition-colors ${
              key === round ? 'bg-accent text-[#1A1612] font-semibold' : 'text-ink2 hover:text-ink'
            }`}
            title={meta.rounds[key].label}
          >
            {meta.rounds[key].label}
          </button>
        ))}
      </div>
      {/* 스텝 */}
      <div className="flex gap-0.5 bg-panel/80 border border-border rounded px-1 py-0.5 backdrop-blur-sm">
        {steps.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onStepSelect(s)}
            className={`px-1.5 py-0.5 text-[9px] font-mono tracking-wider rounded transition-colors ${
              s === step
                ? s === 'live'
                  ? 'bg-danger text-white'
                  : 'bg-accent text-[#1A1612] font-semibold'
                : 'text-ink2 hover:text-ink'
            }`}
          >
            {labelFor(s, steps)}
          </button>
        ))}
      </div>
    </div>
  );
}
