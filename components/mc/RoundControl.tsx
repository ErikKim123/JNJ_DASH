// 라운드(예선/본선) 컨트롤 — 패어링 / 심사·확정 서브탭. (요구 2·3·4·5)
'use client';

import { useState } from 'react';
import type { RoundKey } from '@/lib/sheets/types';
import { ROUND_LABEL } from './labels';
import { PairingControl } from './PairingControl';
import { JudgingControl } from './JudgingControl';

// 패어링·심사 API 는 prelim/semi 만 (PairingRoundDb / commit).
type PairRound = 'prelim' | 'semi';

export function RoundControl({ contestId, round }: { contestId: string; round: PairRound }) {
  const [sub, setSub] = useState<'pairing' | 'judging'>('pairing');
  void (round as RoundKey); // round 는 prelim|semi 만 들어옴

  return (
    <>
      <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-panel border border-border">
        <button
          type="button"
          onClick={() => setSub('pairing')}
          className={`py-2.5 rounded-lg text-sm font-semibold transition ${
            sub === 'pairing' ? 'bg-accent text-[#1A1612]' : 'text-ink2 active:text-ink'
          }`}
        >
          패어링
        </button>
        <button
          type="button"
          onClick={() => setSub('judging')}
          className={`py-2.5 rounded-lg text-sm font-semibold transition ${
            sub === 'judging' ? 'bg-accent text-[#1A1612]' : 'text-ink2 active:text-ink'
          }`}
        >
          심사·확정
        </button>
      </div>

      <p className="text-[10px] font-mono uppercase tracking-widest text-ink2 text-center">
        {ROUND_LABEL[round].ko} · {ROUND_LABEL[round].en}
      </p>

      {sub === 'pairing' ? (
        <PairingControl contestId={contestId} round={round} />
      ) : (
        <JudgingControl contestId={contestId} round={round} />
      )}
    </>
  );
}
