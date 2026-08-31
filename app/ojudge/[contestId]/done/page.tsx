// /ojudge/[contestId]/done — 관객 심사위원 등록 완료 화면 (JOIN done 과 동일 디자인).
//
// 0037 이후: 등록 한 번이면 같은 페스티벌(group_name)의 열린 대회 전체에 참여가 잡힌다.
//   여기서 그 대회들을 그대로 보여줘야 "다른 대회는 또 등록해야 하나?" 라는 질문이 안 생긴다.
import { getContest, listContests } from '@/lib/db/queries';
import { contestTheme, joinRootProps } from '@/lib/join/theme';
import { isEnrollable } from '@/lib/audience/account';
import { OJudgeDonePanel } from './OJudgeDonePanel';

export const dynamic = 'force-dynamic';

export default async function OJudgeDonePage({
  params,
  searchParams,
}: {
  params: Promise<{ contestId: string }>;
  searchParams: Promise<{ num?: string; no?: string; name?: string }>;
}) {
  const { contestId } = await params;
  const { num, no, name } = await searchParams;
  const contest = await getContest(contestId);
  const theme = contestTheme(contest);
  const root = joinRootProps(theme);

  // 함께 등록된 다른 대회 — 같은 group_name 의 열린 대회. 그룹이 비어있으면(미분류) 없음.
  const group = (contest?.group_name ?? '').trim();
  const alsoEnrolled = group
    ? (await listContests().catch(() => []))
        .filter((c) => c.id !== contest?.id && (c.group_name ?? '').trim() === group && isEnrollable(c))
        .map((c) => ({ id: c.id, name: c.name }))
    : [];

  return (
    <main
      className={root.className}
      style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', padding: '32px 20px 32px', ...root.style }}
    >
      <OJudgeDonePanel
        contestId={contest?.id ?? contestId}
        num={num ?? ''}
        judgeNo={no ?? ''}
        name={name ?? ''}
        contestName={contest?.name ?? ''}
        alsoEnrolled={alsoEnrolled}
      />
    </main>
  );
}
