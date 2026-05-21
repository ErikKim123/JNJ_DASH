import { notFound } from 'next/navigation';
import { getContest, listJudges, listJudgeVotes } from '@/lib/db/queries';
import { JudgesAdmin, type JudgeGroup } from '@/components/admin/JudgesAdmin';
import { ContestTabs } from '@/components/admin/ContestTabs';
import { PageHeader } from '@/components/admin/ui';
import type { JudgeRow, JudgingRound, JudgeVoteRow } from '@/lib/db/types';
import { SCORING_ITEMS } from '@/lib/db/scoring';

export const dynamic = 'force-dynamic';

export default async function JudgesPage({
  params,
}: {
  params: Promise<{ contestId: string }>;
}) {
  const { contestId } = await params;
  const contest = await getContest(contestId);
  if (!contest) notFound();

  // 3개 라운드의 judges + votes 병렬 로드
  const rounds: JudgingRound[] = ['prelim', 'semi', 'final'];
  const [allJudges, allVotes] = await Promise.all([
    Promise.all(rounds.map((r) => listJudges(contestId, r))),
    Promise.all(rounds.map((r) => listJudgeVotes(contestId, r))),
  ]);

  // display_order 별로 묶어서 통합 명단으로 변환 — 한 명의 심사위원 = (prelim/semi/final) 3 row.
  // canonical row: prelim 우선, 없으면 semi, 없으면 final.
  const flat: JudgeRow[] = ([] as JudgeRow[]).concat(...allJudges);
  const byOrder = new Map<number, JudgeRow[]>();
  for (const j of flat) {
    const arr = byOrder.get(j.display_order) ?? [];
    arr.push(j);
    byOrder.set(j.display_order, arr);
  }
  const groups: JudgeGroup[] = [...byOrder.entries()]
    .sort(([a], [b]) => a - b)
    .map(([order, rows]) => {
      const canonical =
        rows.find((r) => r.round === 'prelim') ??
        rows.find((r) => r.round === 'semi') ??
        rows[0];
      const idsByRound: Partial<Record<JudgingRound, string>> = {};
      const maxVotesByRound: Partial<Record<JudgingRound, number | null>> = {};
      for (const r of rows) {
        idsByRound[r.round] = r.id;
        maxVotesByRound[r.round] = r.max_votes ?? null;
      }
      return {
        display_order: order,
        canonical,
        ids: rows.map((r) => r.id),
        idsByRound,
        maxVotesByRound,
      };
    });

  // judge_id → vote count.
  // prelim/semi : O 표 개수만 카운트 (X 는 통과 정원과 무관).
  // final       : 채점 항목 중 하나라도 입력된 row 수 (= 채점한 참가자 수).
  const voteCounts: Record<string, number> = {};
  const allScoreCols = SCORING_ITEMS.map((s) => s.column);
  for (let i = 0; i < rounds.length; i++) {
    const r = rounds[i];
    const votes = allVotes[i] as JudgeVoteRow[];
    for (const v of votes) {
      let n = 0;
      if (r === 'final') {
        // 결승: 점수가 한 칸이라도 들어가면 1 (참가자 1명 채점 = 1 vote).
        if (allScoreCols.some((c) => v[c] != null)) n = 1;
      } else {
        // 예선/본선: O 표만 카운트.
        if (v.vote_mark === 'O') n = 1;
      }
      if (n > 0) voteCounts[v.judge_id] = (voteCounts[v.judge_id] ?? 0) + n;
    }
  }

  const base = `/admin/contests/${encodeURIComponent(contestId)}`;
  return (
    <>
      <PageHeader
        title={
          <>
            <span className="font-mono text-xs text-ink2 mr-2">{contest.id}</span>
            {contest.name} · Judges
          </>
        }
        subtitle="Register, edit, and remove judges. One entry registers across prelim, semi, and final."
      />
      <ContestTabs contestId={contestId} current={`${base}/judges`} />
      <JudgesAdmin
        contestId={contestId}
        initial={groups}
        voteCounts={voteCounts}
        prelimQuotaPerRole={contest.prelim_pass_per_role}
        semiQuotaPerRole={contest.semi_pass_per_role}
      />
    </>
  );
}
