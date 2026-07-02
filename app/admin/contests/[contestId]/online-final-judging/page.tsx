import { notFound } from 'next/navigation';
import {
  getContest,
  listQualifiers,
  listAllOnlineJudges,
  listOnlineJudgeVotes,
} from '@/lib/db/queries';
import { OnlineFinalJudgingMatrix } from '@/components/admin/OnlineFinalJudgingMatrix';
import { ContestTabs } from '@/components/admin/ContestTabs';
import { PageHeader } from '@/components/admin/ui';

export const dynamic = 'force-dynamic';

export default async function OnlineFinalJudgingPage({
  params,
}: {
  params: Promise<{ contestId: string }>;
}) {
  const { contestId } = await params;
  const contest = await getContest(contestId);
  if (!contest) notFound();

  const [semiQ, judges, votes] = await Promise.all([
    listQualifiers(contestId, 'semi'),
    listAllOnlineJudges(contestId),
    listOnlineJudgeVotes(contestId),
  ]);

  // 결승 진출자 = 본선(semi) 통과자 (leader/follower).
  const finalists = semiQ
    .filter((q) => q.passed && (q.role === 'leader' || q.role === 'follower'))
    .map((q) => ({ num: q.participant_num, team_name: q.team_name, role: q.role as 'leader' | 'follower' }))
    .sort((a, b) => a.num.localeCompare(b.num, undefined, { numeric: true }));

  const base = `/admin/contests/${encodeURIComponent(contestId)}`;
  return (
    <>
      <PageHeader
        title={
          <>
            <span className="font-mono text-xs text-ink2 mr-2">{contest.id}</span>
            {contest.name} · Online Final Judging
          </>
        }
        subtitle="온라인 심사위원의 결승 진출자 점수를 입력합니다. 심사위원이 많아 컬럼은 페이지로 나눠 표시됩니다."
      />
      <ContestTabs contestId={contestId} current={`${base}/online-final-judging`} />
      <OnlineFinalJudgingMatrix
        contestId={contestId}
        finalists={finalists}
        judges={judges}
        votes={votes}
        scoringItems={contest.scoring_items}
        onlineEnabled={contest.online_judges_enabled}
        finalStatus={contest.final_status}
      />
    </>
  );
}
