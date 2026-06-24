import { notFound } from 'next/navigation';
import {
  getContest,
  listJudges,
  listJudgeVotes,
  listParticipants,
  listQualifiers,
} from '@/lib/db/queries';
import { JudgingMatrix } from '@/components/admin/JudgingMatrix';
import { ContestTabs } from '@/components/admin/ContestTabs';
import { PageHeader } from '@/components/admin/ui';
import type { JudgingRound } from '@/lib/db/types';

export const dynamic = 'force-dynamic';

export default async function JudgingPage({
  params,
}: {
  params: Promise<{ contestId: string; round: string }>;
}) {
  const { contestId, round } = await params;
  if (round !== 'prelim' && round !== 'semi' && round !== 'final') notFound();
  const r = round as JudgingRound;
  const contest = await getContest(contestId);
  if (!contest) notFound();

  const [judges, votes, participants, qPrelim, qSemi] = await Promise.all([
    listJudges(contestId, r),
    listJudgeVotes(contestId, r),
    listParticipants(contestId),
    listQualifiers(contestId, 'prelim'),
    listQualifiers(contestId, 'semi'),
  ]);

  const base = `/admin/contests/${encodeURIComponent(contestId)}`;
  const label = r === 'prelim' ? 'Prelim' : r === 'semi' ? 'Semi' : 'Final';
  // 통과 정원 — final 은 1·2·3등 podium 이라 3 고정.
  const maxPerRole =
    r === 'prelim' ? contest.prelim_pass_per_role :
    r === 'semi' ? contest.semi_pass_per_role :
    3;

  // 라운드의 Qualifiers 에서 passed=true 카운트 (Commit 직후 매트릭스 상단에 즉시 반영용)
  const roundStatus =
    r === 'prelim' ? contest.prelim_status :
    r === 'semi' ? contest.semi_status :
    contest.final_status;

  const roundQualifiers = r === 'prelim' ? qPrelim : r === 'semi' ? qSemi : [];
  const initialConfirmed = {
    leaders: roundQualifiers.filter((q) => q.passed && q.role === 'leader').length,
    followers: roundQualifiers.filter((q) => q.passed && q.role === 'follower').length,
  };

  return (
    <>
      <PageHeader
        title={
          <>
            <span className="font-mono text-xs text-ink2 mr-2">{contest.id}</span>
            {contest.name} · {label} Judging
          </>
        }
      />
      <ContestTabs contestId={contestId} current={`${base}/judging/${round}`} />
      <JudgingMatrix
        contestId={contestId}
        round={r}
        judges={judges}
        votes={votes}
        participants={participants}
        prelimQualifiers={qPrelim}
        semiQualifiers={qSemi}
        maxPerRole={maxPerRole}
        scoringItems={contest.scoring_items}
        initialConfirmed={initialConfirmed}
        roundStatus={roundStatus}
      />
    </>
  );
}
