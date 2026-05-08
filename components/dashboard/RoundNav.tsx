// Design Ref: §11.2 — 라운드 메뉴(예선/본선/결승). 결승은 3스텝만 노출됨을 StepNav가 처리.
'use client';

import type { ContestMeta, RoundKey } from '@/lib/sheets/types';

const ROUND_ORDER: RoundKey[] = ['prelim', 'semi', 'final'];

const EN_LABEL: Record<RoundKey, string> = {
  prelim: 'PRELIMINARY',
  semi: 'SEMI-FINAL',
  final: 'GRAND FINAL',
};

export function RoundNav({
  meta,
  current,
  onSelect,
}: {
  meta: ContestMeta;
  current: RoundKey;
  onSelect: (round: RoundKey) => void;
}) {
  return (
    <nav className="flex gap-2 flex-wrap" aria-label="라운드 선택">
      {ROUND_ORDER.map((key) => {
        const round = meta.rounds[key];
        const isActive = key === current;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(key)}
            className={`px-5 py-3 rounded-lg border min-w-[160px] text-left transition-colors ${
              isActive
                ? 'border-accent bg-gradient-to-b from-panel to-accent/10 text-ink'
                : 'border-border bg-panel text-ink2 hover:border-accent2 hover:text-ink'
            }`}
          >
            <div className="text-base font-semibold tracking-tight">{round.label}</div>
            <div className="text-[10px] font-mono tracking-widest opacity-70">{EN_LABEL[key]}</div>
            <div className="text-[10px] font-mono text-accent">{round.steps.length} STEPS</div>
          </button>
        );
      })}
    </nav>
  );
}
