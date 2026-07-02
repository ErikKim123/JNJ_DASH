import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { getContest, listOnlineJudges } from '@/lib/db/queries';
import { OnlineJudgesAdmin } from '@/components/admin/OnlineJudgesAdmin';
import { ContestTabs } from '@/components/admin/ContestTabs';
import { PageHeader } from '@/components/admin/ui';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

export default async function OnlineJudgesPage({
  params,
  searchParams,
}: {
  params: Promise<{ contestId: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { contestId } = await params;
  const { page: pageParam } = await searchParams;
  const contest = await getContest(contestId);
  if (!contest) notFound();

  const page = Math.max(1, Number(pageParam) || 1);
  const { rows, total } = await listOnlineJudges(contestId, page, PAGE_SIZE);

  // 공개 등록 앱 절대 URL — 관리자 QR/링크 공유용.
  const h = await headers();
  const proto = h.get('x-forwarded-proto') ?? 'http';
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const joinUrl = `${proto}://${host}/ojudge/${encodeURIComponent(contestId)}`;

  const base = `/admin/contests/${encodeURIComponent(contestId)}`;
  return (
    <>
      <PageHeader
        title={
          <>
            <span className="font-mono text-xs text-ink2 mr-2">{contest.id}</span>
            {contest.name} · Online Judges
          </>
        }
        subtitle="셀프 등록된 온라인 심사위원 명단. 등록은 공개 조인앱(/ojudge)에서 이뤄집니다."
      />
      <ContestTabs contestId={contestId} current={`${base}/online-judges`} />
      <OnlineJudgesAdmin
        contestId={contestId}
        rows={rows}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        joinUrl={joinUrl}
      />
    </>
  );
}
