// /admin/contests/[contestId]/* 공용 레이아웃.
// RoundStatusBar 를 contest 하위 모든 탭(Judges, Participants, Judging, Qualifiers, Finals 등)
// 상단에 동일하게 표시 — 운영자가 어느 탭에 있든 PRELIM/SEMI/FINAL 상태를 즉시 조정 가능.
//
// contest 가 존재하지 않으면 자식 page.tsx 의 notFound() 처리에 맡기고 bar 만 생략.
import { getContest } from '@/lib/db/queries';
import { RoundStatusBar } from '@/components/admin/RoundStatusBar';

export const dynamic = 'force-dynamic';

export default async function ContestLayout({
  params,
  children,
}: {
  params: Promise<{ contestId: string }>;
  children: React.ReactNode;
}) {
  const { contestId } = await params;
  const contest = await getContest(contestId);

  if (!contest) return <>{children}</>;

  return (
    <>
      <div className="mb-4">
        <RoundStatusBar
          contestId={contest.id}
          initial={{
            prelim_status: contest.prelim_status,
            semi_status: contest.semi_status,
            final_status: contest.final_status,
          }}
        />
      </div>
      {children}
    </>
  );
}
