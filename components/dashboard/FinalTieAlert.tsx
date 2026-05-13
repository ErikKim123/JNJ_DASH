// 결승 CALC TOTAL / RESULT 단계에서 1·2·3위 안에 동점자(같은 rank 2명 이상)가
// 있을 때 운영자가 수동 확정할 수 있도록 후보 전원의 번호·이름·총점을 표시.
// OverflowAlert와 동일한 디자인 패턴 — 본선/예선의 정원 초과 알림과 시각적 일관성 유지.
'use client';

import type { FinalTieEntry, FinalTieInfo } from '@/lib/sheets/types';

export function FinalTieAlert({ tie }: { tie: FinalTieInfo }) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-accent2 bg-accent/10 px-4 py-2.5 text-xs flex items-start gap-3"
    >
      <span className="text-accent text-base leading-none mt-0.5">⚠️</span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-accent">
          결승 동점자 발생 — 운영자 수동 확정 필요
        </p>
        <p className="text-ink2 mt-1 leading-relaxed">
          1·2·3위 안에 같은 순위로 묶인 후보가 있습니다. 시트(6.결승)에서 동점자를 직접
          확정한 뒤 우측 상단 <span className="font-mono text-accent">↻ 조회</span> 버튼을 눌러 갱신하세요.
        </p>

        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          {tie.leaderEntries.length ? (
            <TieList title="LEADER" entries={tie.leaderEntries} />
          ) : null}
          {tie.followerEntries.length ? (
            <TieList title="FOLLOWER" entries={tie.followerEntries} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function TieList({ title, entries }: { title: string; entries: FinalTieEntry[] }) {
  // 같은 rank가 2명 이상이면 그 rank의 행을 강조 표시.
  const rankCounts = new Map<number, number>();
  for (const e of entries) rankCounts.set(e.rank, (rankCounts.get(e.rank) ?? 0) + 1);

  return (
    <div className="rounded border border-border bg-panel/40 px-3 py-2">
      <div className="text-[10px] font-mono tracking-widest text-accent mb-1.5 flex justify-between">
        <span>{title}</span>
        <span className="text-ink2">점수</span>
      </div>
      <ul className="space-y-0.5">
        {entries.map((e, i) => {
          const isTied = (rankCounts.get(e.rank) ?? 0) > 1;
          return (
            <li
              key={`${e.num}-${i}`}
              className={`grid grid-cols-[40px_36px_1fr_auto] items-center gap-2 font-mono text-[11px] py-0.5 ${
                isTied ? 'text-accent' : 'text-ink'
              }`}
            >
              <span className="tabular-nums text-ink2">{e.rank}위</span>
              <span className="tabular-nums text-ink2">{e.num}</span>
              <span className="truncate" title={e.name}>{e.name}</span>
              <span className="tabular-nums">{e.score || '—'}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
