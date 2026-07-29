// MC 모바일 콘솔 진입점 (Server Component) — 대회 로드 후 MCConsole 렌더.
import { notFound } from 'next/navigation';
import { getContest } from '@/lib/db/queries';
import { MCConsole } from '@/components/mc/MCConsole';
import { normalizeExtraVideos } from '@/lib/contest/extraVideos';

export const dynamic = 'force-dynamic';

export default async function McConsolePage({
  params,
}: {
  params: Promise<{ contestId: string }>;
}) {
  const { contestId } = await params;
  const contest = await getContest(contestId);
  if (!contest) notFound();

  return (
    <MCConsole
      contestId={contest.id}
      contestName={contest.name}
      initialRound={contest.display_round}
      initialStep={contest.display_step}
      initialFollow={contest.display_follow ?? false}
      extraVideos={normalizeExtraVideos(contest.extra_videos)}
    />
  );
}
