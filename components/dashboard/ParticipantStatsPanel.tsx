// Design Ref: §11.2 — 예선/본선/결승 라운드 상단의 요약 패널.
// 표시 데이터:
//   · 예선: 예선참가자 수 | 헬퍼 | 예선 통과 목표 커플 (24)
//   · 본선: 본선참가자 수 | 헬퍼 | 본선 통과 목표 커플 (7)
//   · 결승: 결승참가자 수 | 1위 / 2위 / 3위 (리더 · 팔로워 이름)
// 데이터 출처: DB 의 contests / participants / qualifiers(prelim·semi) / final_results 테이블.
import type { ParticipantStats, RoundKey } from '@/lib/sheets/types';

export function ParticipantStatsPanel({
  stats,
  round,
}: {
  stats: ParticipantStats;
  round: RoundKey;
}) {
  if (round === 'final') return <FinalPanel stats={stats} />;
  return <PrelimOrSemiPanel stats={stats} round={round} />;
}

function PrelimOrSemiPanel({
  stats,
  round,
}: {
  stats: ParticipantStats;
  round: Exclude<RoundKey, 'final'>;
}) {
  const isSemi = round === 'semi';
  const passLabel = isSemi ? '본선 통과 목표 커플' : '예선 통과 목표 커플';
  const passSub = isSemi ? 'TO GRAND FINAL' : 'TO SEMI-FINAL';
  const passValue = isSemi ? stats.semiPassCouples : stats.prelimPassCouples;
  const participantLeaders = isSemi ? stats.semiLeaders : stats.leaders;
  const participantFollowers = isSemi ? stats.semiFollowers : stats.followers;

  // 헬퍼 칸은 예선에서만 의미 있음 (participants 의 helper_leader/helper_follower = 예선 RAND 페어링 보강용).
  // 본선은 예선 통과자만 참가하므로 헬퍼 통계 비노출 → 2-칸 레이아웃.
  return (
    <aside
      className={`flex-1 ${isSemi ? 'min-w-[260px]' : 'min-w-[320px]'} rounded-lg border border-accent2/60 bg-panel/40 px-4 py-3`}
      aria-label={`${isSemi ? '본선' : '예선'} 참가자 요약`}
    >
      <div
        className={`grid ${isSemi ? 'grid-cols-2' : 'grid-cols-3'} gap-3 h-full items-center`}
      >
        <StatCell
          label={isSemi ? '본선참가자 수' : '예선참가자 수'}
          sub="LEADER · FOLLOWER"
          value={`${participantLeaders} · ${participantFollowers}`}
        />
        {isSemi ? null : (
          <StatCell
            label="헬퍼"
            sub="LEADER · FOLLOWER"
            value={`${stats.helperLeaders} · ${stats.helperFollowers}`}
          />
        )}
        <StatCell label={passLabel} sub={passSub} value={String(passValue)} />
      </div>
    </aside>
  );
}

function FinalPanel({ stats }: { stats: ParticipantStats }) {
  return (
    <aside
      className="flex-1 min-w-[480px] rounded-lg border border-accent2/60 bg-panel/40 px-4 py-3"
      aria-label="결승 참가자 요약"
    >
      <div className="grid grid-cols-3 gap-3 items-start">
        <div className="self-center">
          <StatCell
            label="결승참가자 수"
            sub="LEADER · FOLLOWER"
            value={`${stats.finalLeaders} · ${stats.finalFollowers}`}
          />
        </div>
        <PodiumList role="LEADER" entries={stats.finalLeaderPodium} />
        <PodiumList role="FOLLOWER" entries={stats.finalFollowerPodium} />
      </div>
    </aside>
  );
}

function PodiumList({
  role,
  entries,
}: {
  role: string;
  entries: Array<{ rank: number; num: string; name: string; score: string }>;
}) {
  return (
    <div>
      <div className="text-[10px] font-mono tracking-widest text-accent opacity-80 text-center">{role}</div>
      <div className="mt-1 space-y-0.5">
        {entries.length === 0 ? (
          <div className="text-[11px] text-ink2 text-center">—</div>
        ) : (
          entries.map((e, i) => (
            <div
              key={`${e.rank}-${i}`}
              className="grid grid-cols-[28px_36px_1fr_auto] items-center gap-2 text-[11px]"
            >
              <span className="font-mono tracking-widest text-ink2 text-right">{e.rank}위</span>
              <span className="font-mono text-ink2/70 tabular-nums" title={`참가번호 ${e.num}`}>{e.num || '—'}</span>
              <span className="font-semibold text-ink truncate" title={e.name}>{e.name}</span>
              <span className="font-mono text-accent text-[10px] tabular-nums">{e.score || '—'}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function StatCell({ label, sub, value }: { label: string; sub: string; value: string }) {
  return (
    <div className="text-center">
      <div className="text-[10px] font-mono tracking-widest text-ink2">{label}</div>
      <div className="text-lg font-semibold text-ink leading-tight mt-0.5">{value}</div>
      <div className="text-[9px] font-mono tracking-widest text-accent opacity-70 mt-0.5">{sub}</div>
    </div>
  );
}

