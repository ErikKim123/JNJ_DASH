import { notFound } from 'next/navigation';
import { getContest, listPairings } from '@/lib/db/queries';
import { PairingsPanel } from '@/components/admin/PairingsPanel';
import { ContestTabs } from '@/components/admin/ContestTabs';
import { PageHeader } from '@/components/admin/ui';

export const dynamic = 'force-dynamic';

export default async function PairingsPage({
  params,
}: {
  params: Promise<{ contestId: string; round: string }>;
}) {
  const { contestId, round } = await params;
  if (round !== 'prelim' && round !== 'semi') notFound();
  const contest = await getContest(contestId);
  if (!contest) notFound();
  const rows = await listPairings(contestId, round);

  const base = `/admin/contests/${encodeURIComponent(contestId)}`;
  const label = round === 'prelim' ? 'Prelim' : 'Semi';
  return (
    <>
      <PageHeader
        title={
          <>
            <span className="font-mono text-xs text-ink2 mr-2">{contest.id}</span>
            {contest.name} · {label} Pairing
          </>
        }
      />
      <ContestTabs contestId={contestId} current={`${base}/pairings/${round}`} />
      <PairingsPanel
        contestId={contestId}
        round={round}
        initial={rows}
        groupSize={round === 'prelim' ? contest.prelim_group_size : contest.semi_group_size}
      />
    </>
  );
}
