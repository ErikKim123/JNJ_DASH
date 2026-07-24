// GET /api/admin/contests/[id]/judging/[round]/standings
//   MC 모바일 심사 콘솔용 — 라운드별 역할(leader/follower) 순위 + 경계 동점 + 현재 확정 상태.
//   랭킹/동점 공식은 lib/judging/standings.ts (commit 라우트와 동일)로 단일화.
//
//   prelim/semi : value = O 카운트, maxPerRole = *_pass_per_role, 확정 = qualifiers.passed
//   final       : value = 활성 항목 총점, maxPerRole = 3, 확정 = final_rank<=3
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/db/client';
import { selectJudgeVotesAll } from '@/lib/db/queries';
import { resolveActiveDefs } from '@/lib/db/scoring';
import { computeStandings, type StandingInput } from '@/lib/judging/standings';
import type { ScoringItemKey } from '@/lib/db/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const RoundEnum = z.enum(['prelim', 'semi', 'final']);
interface RouteCtx { params: Promise<{ contestId: string; round: string }> }

interface Cand { num: string; name: string; role: 'leader' | 'follower' }

export async function GET(_req: Request, ctx: RouteCtx) {
  const { contestId, round } = await ctx.params;
  const r = RoundEnum.safeParse(round);
  if (!r.success) return NextResponse.json({ error: 'INVALID_ROUND' }, { status: 400 });
  const sb = getSupabaseAdmin();

  // 1) contest 설정.
  const { data: contest, error: ce } = await sb
    .from('contests')
    .select('prelim_pass_per_role, semi_pass_per_role, scoring_items')
    .eq('id', contestId)
    .maybeSingle();
  if (ce) return NextResponse.json({ error: ce.message }, { status: 500 });
  if (!contest) return NextResponse.json({ error: 'CONTEST_NOT_FOUND' }, { status: 404 });

  const maxPerRole =
    r.data === 'prelim' ? contest.prelim_pass_per_role
    : r.data === 'semi' ? contest.semi_pass_per_role
    : 3;

  // 2) judges (헤드 판별) + votes.
  const { data: judges, error: je } = await sb
    .from('judges').select('id, is_head').eq('contest_id', contestId).eq('round', r.data);
  if (je) return NextResponse.json({ error: je.message }, { status: 500 });
  const judgeIds = (judges ?? []).map((j) => j.id);
  const headIds = new Set((judges ?? []).filter((j) => j.is_head).map((j) => j.id));

  // 3) eligible pool (역할·이름).
  let candidates: Cand[] = [];
  if (r.data === 'prelim') {
    const { data: ps, error } = await sb
      .from('participants').select('num, team_name, role').eq('contest_id', contestId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    candidates = (ps ?? [])
      .filter((p) => p.role === 'leader' || p.role === 'follower')
      .map((p) => ({ num: p.num, name: p.team_name ?? '', role: p.role as 'leader' | 'follower' }));
  } else {
    const priorRound = r.data === 'semi' ? 'prelim' : 'semi';
    const { data: qs, error } = await sb
      .from('qualifiers').select('participant_num, team_name, role')
      .eq('contest_id', contestId).eq('round', priorRound).eq('passed', true);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    candidates = (qs ?? [])
      .filter((q) => q.role === 'leader' || q.role === 'follower')
      .map((q) => ({ num: q.participant_num, name: q.team_name ?? '', role: q.role as 'leader' | 'follower' }));
  }

  // 4) 값(value) 계산 + headO.
  const valueByNum = new Map<string, number>();
  const scoredNums = new Set<string>();
  const headONums = new Set<string>();

  if (r.data === 'final') {
    const activeCols = resolveActiveDefs((contest.scoring_items ?? []) as ScoringItemKey[]).map((d) => d.column);
    if (judgeIds.length && activeCols.length) {
      const votes = await selectJudgeVotesAll(sb, judgeIds, ['participant_num', ...activeCols].join(','));
      for (const v of votes as Array<Record<string, number | string | null>>) {
        const num = String(v.participant_num ?? '');
        if (!num) continue;
        let s = 0, c = 0;
        for (const col of activeCols) {
          const x = v[col];
          if (x != null && x !== '') { s += Number(x); c++; }
        }
        if (c > 0) {
          valueByNum.set(num, (valueByNum.get(num) ?? 0) + s);
          scoredNums.add(num);
        }
      }
    }
  } else {
    if (judgeIds.length) {
      const votes = await selectJudgeVotesAll(sb, judgeIds, 'judge_id, participant_num, vote_mark');
      for (const v of votes as Array<{ judge_id: string; participant_num: string; vote_mark: 'O' | 'X' | null }>) {
        if (v.vote_mark !== 'O') continue;
        const num = v.participant_num;
        valueByNum.set(num, (valueByNum.get(num) ?? 0) + 1);
        scoredNums.add(num);
        if (headIds.has(v.judge_id)) headONums.add(num);
      }
    }
  }

  // 5) 현재 확정 상태.
  const passedNums = new Set<string>();
  if (r.data === 'final') {
    const { data: fr } = await sb
      .from('final_results').select('participant_num, final_rank').eq('contest_id', contestId);
    for (const row of fr ?? []) {
      if (row.final_rank != null && row.final_rank <= 3) passedNums.add(row.participant_num);
    }
  } else {
    const { data: qs } = await sb
      .from('qualifiers').select('participant_num, passed').eq('contest_id', contestId).eq('round', r.data);
    for (const row of qs ?? []) if (row.passed) passedNums.add(row.participant_num);
  }
  const committed =
    r.data === 'final'
      ? (await sb.from('final_results').select('id', { count: 'exact', head: true }).eq('contest_id', contestId)).count! > 0
      : passedNums.size > 0 ||
        ((await sb.from('qualifiers').select('id', { count: 'exact', head: true }).eq('contest_id', contestId).eq('round', r.data)).count ?? 0) > 0;

  // 6) StandingInput 구성 → 랭킹.
  const inputs: StandingInput[] = candidates.map((c) => ({
    num: c.num,
    name: c.name,
    role: c.role,
    value: valueByNum.get(c.num) ?? 0,
    scored: scoredNums.has(c.num),
    headO: headONums.has(c.num),
    passed: passedNums.has(c.num),
  }));
  const { leader, follower } = computeStandings(inputs, maxPerRole);

  return NextResponse.json({
    data: { round: r.data, maxPerRole, leader, follower, committed },
  });
}
