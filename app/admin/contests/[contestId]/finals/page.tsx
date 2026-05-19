import { notFound } from 'next/navigation';
import { getContest, listFinalResults, listQualifiers } from '@/lib/db/queries';
import { FinalsPanel } from '@/components/admin/FinalsPanel';
import { ContestTabs } from '@/components/admin/ContestTabs';
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
  const [finals, semiQualifiers] = await Promise.all([
    listFinalResults(contestId),
    listQualifiers(contestId, 'semi'),
  ]);

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
      <ContestTabs contestId={contestId} current={`${base}/finals`} />
      <FinalsPanel contestId={contestId} initial={finals} semiQualifiers={semiQualifiers} />
    </>
  );
}
