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
      return {
        display_order: order,
        canonical,
        ids: rows.map((r) => r.id),
      };
    });

  // judge_id → vote count (어떤 컬럼이든 값이 있으면 카운트, 모든 라운드 합산)
  const voteCounts: Record<string, number> = {};
  const allScoreCols = SCORING_ITEMS.map((s) => s.column);
  for (const votes of allVotes) {
    for (const v of votes as JudgeVoteRow[]) {
      let n = 0;
      if (v.vote_mark != null) n++;
      for (const col of allScoreCols) {
        if (v[col] != null) n++;
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
      <JudgesAdmin contestId={contestId} initial={groups} voteCounts={voteCounts} />
    </>
  );
}
