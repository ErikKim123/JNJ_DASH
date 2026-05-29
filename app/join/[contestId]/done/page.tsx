// /join/[contestId]/done?num=XXX — 신청 완료 확인 화면.
// 본문은 EN/KO 토글 클라이언트 컴포넌트(DonePanel). 테마는 서버에서 main 에 적용.
import { getContest } from '@/lib/db/queries';
import { contestTheme, joinRootProps } from '@/lib/join/theme';
import { DonePanel } from './DonePanel';

export const dynamic = 'force-dynamic';

export default async function DonePage({
  params,
  searchParams,
}: {
  params: Promise<{ contestId: string }>;
  searchParams: Promise<{ num?: string }>;
}) {
  const { contestId } = await params;
  const { num } = await searchParams;
  const contest = await getContest(contestId);
  const theme = contestTheme(contest);
  const root = joinRootProps(theme);

  // Back to Competitions → 트로피와 동일하게 이 대회가 속한 그룹의 목록 화면.
  const backHref = contest?.group_name?.trim()
    ? `/join/competitions?group=${encodeURIComponent(contest.group_name.trim())}`
    : '/join/competitions';

  const period = contest?.period_start
    ? `${contest.period_start} ~ ${contest.period_end ?? ''}`
    : '';

  return (
    <main
      className={root.className}
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        padding: '32px 20px 32px',
        ...root.style,
      }}
    >
      <DonePanel
        contestId={contest?.id ?? contestId}
        num={num ?? ''}
        contestName={contest?.name ?? ''}
        period={period}
        backHref={backHref}
        snsUrl={contest?.sns_url ?? ''}
      />
    </main>
  );
}
