import { notFound } from 'next/navigation';
import { getContest, listParticipants } from '@/lib/db/queries';
import { ParticipantsTable } from '@/components/admin/ParticipantsTable';
import { ContestTabs } from '@/components/admin/ContestTabs';
import { PageHeader } from '@/components/admin/ui';

export const dynamic = 'force-dynamic';

export default async function ParticipantsPage({
  params,
}: {
  params: Promise<{ contestId: string }>;
}) {
  const { contestId } = await params;
  const contest = await getContest(contestId);
  if (!contest) notFound();
  const rows = await listParticipants(contestId);

  const base = `/admin/contests/${encodeURIComponent(contestId)}`;
  return (
    <>
      <PageHeader
        title={
          <>
            <span className="font-mono text-xs text-ink2 mr-2">{contest.id}</span>
            {contest.name} · Participants
          </>
        }
      />
      <ContestTabs contestId={contestId} current={`${base}/participants`} />
      <ParticipantsTable
        contestId={contestId}
        initial={rows}
        scoringItems={contest.scoring_items}
      />
    </>
  );
}
