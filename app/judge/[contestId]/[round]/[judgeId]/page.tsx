// /judge/[contestId]/[round]/[judgeId] — 심사위원 본인 전용 채점 페이지.
// judgeId(UUID) 가 비밀 링크 토큰. 관리자가 이 링크를 각 심사위원에게 전달.
// 심사위원은 자기 컬럼만 채점하고 SUBMIT → 관리자 매트릭스 컬럼이 녹색으로 표시됨.
import { notFound } from 'next/navigation';
import { getContest, listParticipants, listQualifiers } from '@/lib/db/queries';
import { getSupabaseAdmin } from '@/lib/db/client';
import type { JudgingRound, JudgeRow, JudgeVoteRow } from '@/lib/db/types';
import { JudgeScoring, type JudgeEligible } from '@/components/judge/JudgeScoring';

export const dynamic = 'force-dynamic';

export default async function JudgeScoringPage({
  params,
}: {
  params: Promise<{ contestId: string; round: string; judgeId: string }>;
}) {
  const { contestId, round, judgeId } = await params;
  if (round !== 'prelim' && round !== 'semi' && round !== 'final') notFound();
  const r = round as JudgingRound;

  const contest = await getContest(contestId);
  if (!contest) notFound();

  const sb = getSupabaseAdmin();
  const { data: judge } = await sb
    .from('judges')
    .select('*')
    .eq('id', judgeId)
    .eq('contest_id', contestId)
    .eq('round', r)
    .maybeSingle();
  if (!judge) notFound();

  const [participants, qPrelim, qSemi, votesRes] = await Promise.all([
    listParticipants(contestId),
    listQualifiers(contestId, 'prelim'),
    listQualifiers(contestId, 'semi'),
    sb.from('judge_votes').select('*').eq('judge_id', judgeId),
  ]);

  // 채점 대상 — 관리자 매트릭스와 동일 규칙.
  let eligible: JudgeEligible[];
  if (r === 'prelim') {
    eligible = participants
      .filter((p) =>
        p.role === 'leader' || p.role === 'follower' ||
        p.role === 'helper_leader' || p.role === 'helper_follower'
      )
      .map((p) => {
        const isHelper = p.role === 'helper_leader' || p.role === 'helper_follower';
        const role: 'leader' | 'follower' =
          p.role === 'leader' || p.role === 'helper_leader' ? 'leader' : 'follower';
        return { num: p.num, team_name: p.team_name, role, isHelper };
      });
  } else {
    const source = r === 'semi' ? qPrelim : qSemi;
    eligible = source
      .filter((q) => q.passed && (q.role === 'leader' || q.role === 'follower'))
      .map((q) => ({
        num: q.participant_num,
        team_name: q.team_name,
        role: q.role as 'leader' | 'follower',
        isHelper: false,
      }));
  }
  // 리더 먼저 → 번호 오름차순.
  eligible.sort((a, b) => {
    if (a.role !== b.role) return a.role === 'leader' ? -1 : 1;
    return a.num.localeCompare(b.num, undefined, { numeric: true });
  });

  const maxPerRole =
    r === 'prelim' ? contest.prelim_pass_per_role :
    r === 'semi' ? contest.semi_pass_per_role :
    3;

  return (
    <JudgeScoring
      contestId={contestId}
      round={r}
      contestName={contest.name}
      judge={judge as JudgeRow}
      eligible={eligible}
      votes={(votesRes.data ?? []) as JudgeVoteRow[]}
      scoringItems={contest.scoring_items}
      maxPerRole={maxPerRole}
    />
  );
}
