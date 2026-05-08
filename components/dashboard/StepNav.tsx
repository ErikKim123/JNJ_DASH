// Design Ref: §11.2 — 스텝 버튼 행. 라운드별 스텝 목록은 ContestMeta.rounds[round].steps 참조.
'use client';

import type { ContestMeta, RoundKey, StepKey } from '@/lib/sheets/types';

const STEP_LABEL: Record<StepKey, string> = {
  prep: 'PREP',
  pairing: 'PAIRING',
  open: 'OPEN',
  live: 'LIVE',
  wrapup: 'CALC TOTAL',
  close: 'CLOSE',
  result: 'RESULT',
};

export function StepNav({
  meta,
  round,
  currentStep,
  onSelect,
}: {
  meta: ContestMeta;
  round: RoundKey;
  currentStep: StepKey;
  onSelect: (step: StepKey) => void;
}) {
  const steps = meta.rounds[round].steps;

  return (
    <nav
      className="flex gap-1 p-1.5 rounded-lg bg-panel border border-border flex-wrap"
      aria-label="프로세스 스텝 선택"
    >
      {steps.map((step, idx) => {
        const isActive = step === currentStep;
        const isLive = step === 'live';
        return (
          <div key={step} className="flex items-center gap-1">
            {idx > 0 ? <span className="text-ink2 text-xs select-none">→</span> : null}
            <button
              type="button"
              onClick={() => onSelect(step)}
              className={`px-3.5 py-2 text-[11px] font-medium tracking-widest rounded transition-colors ${
                isActive
                  ? isLive
                    ? 'bg-danger text-white'
                    : 'bg-accent text-[#1A1612]'
                  : 'text-ink2 hover:bg-bg2 hover:text-ink'
              }`}
            >
              {STEP_LABEL[step]}
            </button>
          </div>
        );
      })}
    </nav>
  );
}
