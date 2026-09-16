import { notFound } from 'next/navigation';
import {
  getContest,
  listFinalResults,
  listQualifiers,
} from '@/lib/db/queries';
import { computeFinalScores } from '@/lib/judging/final-score';
import { FinalsPanel } from '@/components/admin/FinalsPanel';
import { ContestTabs } from '@/components/admin/ContestTabs';
import { PublishResultsControl } from '@/components/admin/PublishResultsControl';
import { PageHeader } from '@/components/admin/ui';

export const dynamic = 'force-dynamic';

export default async function FinalsPage({
  params,
}: {
  params: Promise<{ contestId: string }>;
}) {
  const { contestId } = await params;
  const contest = await getContest(contestId);
  if (!contest) notFound();
  const [finals, semiQualifiers, { breakdown }] = await Promise.all([
    listFinalResults(contestId),
    listQualifiers(contestId, 'semi'),
    // 판정단 / 관객 / 최종(가중) 산출 — Wolf 게시도 같은 함수를 쓴다.
    // 화면이 보여 준 숫자가 곧 게시되는 숫자여야 한다(lib/judging/final-score.ts).
    computeFinalScores(contestId),
  ]);

  const wp = Math.max(0, Number(contest.panel_judge_weight) || 0);
  const wo = Math.max(0, Number(contest.online_judge_weight) || 0);
  const usePanel = contest.panel_judges_enabled !== false;
  const useOnline = contest.online_judges_enabled === true;

  const base = `/admin/contests/${encodeURIComponent(contestId)}`;
  return (
    <>
      <PageHeader
        title={
          <>
            <span className="font-mono text-xs text-ink2 mr-2">{contest.id}</span>
            {contest.name} · Final Results
          </>
        }
      />
      <ContestTabs
        contestId={contestId}
        current={`${base}/finals`}
        trailing={
          <PublishResultsControl
            contestId={contestId}
            contestName={contest.name}
            published={contest.results_published === true}
          />
        }
      />
      <FinalsPanel
        contestId={contestId}
        initial={finals}
        semiQualifiers={semiQualifiers}
        breakdown={breakdown}
        weights={{ panel: wp, online: wo, usePanel, useOnline }}
      />
    </>
  );
}
