// /admin/contests/[contestId] — 대회 정보 편집 (기본 탭).
// RoundStatusBar 는 contest layout 에서 모든 탭 공통으로 렌더링하므로 여기서는 생략.
import { notFound } from 'next/navigation';
import { getContest } from '@/lib/db/queries';
import { ContestForm } from '@/components/admin/ContestForm';
import { ContestTabs } from '@/components/admin/ContestTabs';
import { ContestBackupBar } from '@/components/admin/ContestBackupBar';
import { PageHeader } from '@/components/admin/ui';

export const dynamic = 'force-dynamic';

export default async function ContestDetailPage({
  params,
}: {
  params: Promise<{ contestId: string }>;
}) {
  const { contestId } = await params;
  const contest = await getContest(contestId);
  if (!contest) notFound();

  const base = `/admin/contests/${encodeURIComponent(contestId)}`;
  return (
    <>
      <PageHeader
        title={
          <>
            <span className="font-mono text-xs text-ink2 mr-2">{contest.id}</span>
            {contest.name}
          </>
        }
        subtitle="Contest info / Participants / Pairings / Qualifiers / Final results"
      />

      <ContestTabs contestId={contestId} current={base} />

      <ContestForm mode="edit" initial={contest} />

      <div className="mt-8">
        <ContestBackupBar contestId={contest.id} />
      </div>
    </>
  );
}
