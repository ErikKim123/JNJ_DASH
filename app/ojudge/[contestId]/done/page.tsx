// /ojudge/[contestId]/done — 온라인 심사위원 등록 완료 화면 (JOIN done 과 동일 디자인).
import { getContest } from '@/lib/db/queries';
import { contestTheme, joinRootProps } from '@/lib/join/theme';
import { OJudgeDonePanel } from './OJudgeDonePanel';

export const dynamic = 'force-dynamic';

export default async function OJudgeDonePage({
  params,
  searchParams,
}: {
  params: Promise<{ contestId: string }>;
  searchParams: Promise<{ num?: string; name?: string }>;
}) {
  const { contestId } = await params;
  const { num, name } = await searchParams;
  const contest = await getContest(contestId);
  const theme = contestTheme(contest);
  const root = joinRootProps(theme);

  return (
    <main
      className={root.className}
      style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', padding: '32px 20px 32px', ...root.style }}
    >
      <OJudgeDonePanel
        contestId={contest?.id ?? contestId}
        num={num ?? ''}
        name={name ?? ''}
        contestName={contest?.name ?? ''}
      />
    </main>
  );
}
