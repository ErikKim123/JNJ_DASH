// Result 화면에서 시트의 자동 통과(TRUE) 인원이 설정 정원을 초과한 경우 표시되는 경고.
// 동점자 처리를 운영자가 수동으로 결정할 수 있도록 통과자 전원의 번호·이름·투표수를 함께 표출.
'use client';

import type { OverflowEntry, ResultData } from '@/lib/sheets/types';

export function OverflowAlert({ overflow }: { overflow: NonNullable<ResultData['overflow']> }) {
  const parts: string[] = [];
  if (overflow.leaderOverflow > 0) {
    parts.push(`리더 ${overflow.leaderTotal}명(정원 +${overflow.leaderOverflow})`);
  }
  if (overflow.followerOverflow > 0) {
    parts.push(`팔로워 ${overflow.followerTotal}명(정원 +${overflow.followerOverflow})`);
  }

  return (
    <div
      role="alert"
      className="rounded-lg border border-accent2 bg-accent/10 px-4 py-2.5 text-xs flex items-start gap-3"
    >
      <span className="text-accent text-base leading-none mt-0.5">⚠️</span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-accent">
          동점자 발생 — 운영자 수동 검토 필요 (정원 {overflow.maxPerRole}명)
        </p>
        <p className="text-ink2 mt-1 font-mono">
          시트 자동 통과: {parts.join(' · ')}
        </p>
        <p className="text-ink2 mt-1 leading-relaxed">
          대시보드는 정원 {overflow.maxPerRole}명만 표출 중. 시트에서 통과자를 직접
          확정한 뒤 우측 상단 <span className="font-mono text-accent">↻ 조회</span> 버튼을 눌러 갱신하세요.
        </p>

        {/* 순위권에 들어온 통과자 전원 — 리더/팔로워 양쪽 모두 표시 (overflow가 한쪽에만 있어도).
            투표수 내림차순. boundary 줄 아래는 정원 초과 후보로 dim 처리. */}
        {(overflow.leaderEntries?.length || overflow.followerEntries?.length) ? (
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            {overflow.leaderEntries?.length ? (
              <EntryList
                title="LEADER"
                entries={overflow.leaderEntries}
                boundary={overflow.maxPerRole}
              />
            ) : null}
            {overflow.followerEntries?.length ? (
              <EntryList
                title="FOLLOWER"
                entries={overflow.followerEntries}
                boundary={overflow.maxPerRole}
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function EntryList({
  title,
  entries,
  boundary,
}: {
  title: string;
  entries: OverflowEntry[];
  boundary: number;
}) {
  return (
    <div className="rounded border border-border bg-panel/40 px-3 py-2">
      <div className="text-[10px] font-mono tracking-widest text-accent mb-1.5 flex justify-between">
        <span>{title}</span>
        <span className="text-ink2">번호 · 이름 · 투표수</span>
      </div>
      <ul className="space-y-0.5">
        {entries.map((e, i) => {
          // boundary 위치(=정원 마지막 자리)에 가는 경계선 표시 — 그 아래가 overflow 대상.
          const isLastInQuota = i === boundary - 1;
          return (
            <li
              key={`${e.num}-${i}`}
              className={`grid grid-cols-[36px_1fr_auto] items-center gap-2 font-mono text-[11px] py-0.5 ${
                isLastInQuota ? 'border-b border-accent2/40 pb-1 mb-0.5' : ''
              } ${i >= boundary ? 'text-ink2' : 'text-ink'}`}
            >
              <span className="tabular-nums text-ink2">{e.num}</span>
              <span className="truncate" title={e.name}>{e.name}</span>
              <span className="tabular-nums text-accent">{e.votes}표</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
