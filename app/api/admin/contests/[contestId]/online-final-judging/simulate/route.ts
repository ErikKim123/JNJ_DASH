// POST /api/admin/contests/[id]/online-final-judging/simulate
//   Prep 단계 테스트용 — 온라인 심사위원 × 결승 진출자에 랜덤 점수를 자동 채운다.
//   기존 점수는 upsert 로 덮어씀. 제출 상태는 건드리지 않음.
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db/client';
import { getContest, listAllOnlineJudges } from '@/lib/db/queries';
import { resolveActiveDefs } from '@/lib/db/scoring';
import type { ScoringItemKey } from '@/lib/db/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface RouteCtx { params: Promise<{ contestId: string }> }

export async function POST(_req: Request, ctx: RouteCtx) {
  const { contestId } = await ctx.params;
  const contest = await getContest(contestId);
  if (!contest) return NextResponse.json({ error: 'CONTEST_NOT_FOUND' }, { status: 404 });

  const sb = getSupabaseAdmin();
  const activeCols = resolveActiveDefs((contest.scoring_items ?? []) as ScoringItemKey[]).map((d) => d.column);
  if (activeCols.length === 0) return NextResponse.json({ error: 'NO_SCORING_ITEMS' }, { status: 400 });

  const [judges, { data: qs, error: qe }] = await Promise.all([
    listAllOnlineJudges(contestId),
    sb.from('qualifiers').select('participant_num, role').eq('contest_id', contestId).eq('round', 'semi').eq('passed', true),
  ]);
  if (qe) return NextResponse.json({ error: qe.message }, { status: 500 });
  const finalists = (qs ?? []).filter((q) => q.role === 'leader' || q.role === 'follower').map((q) => q.participant_num);
  if (judges.length === 0 || finalists.length === 0) {
    return NextResponse.json({ error: 'NO_JUDGES_OR_FINALISTS' }, { status: 400 });
  }

  // 6~10 사이 랜덤 정수 — display_order/index 로 결정(재현 가능, Math.random 미사용).
  const score = (a: number, b: number) => 6 + ((a * 7 + b * 13) % 5);

  const rows: Record<string, unknown>[] = [];
  for (const j of judges) {
    finalists.forEach((num, fi) => {
      const row: Record<string, unknown> = { online_judge_id: j.id, participant_num: num };
      activeCols.forEach((c, ci) => { row[c] = score(j.display_order + ci, fi + ci); });
      rows.push(row);
    });
  }

  // 배치 upsert (500행씩).
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await sb
      .from('online_judge_votes')
      .upsert(rows.slice(i, i + CHUNK), { onConflict: 'online_judge_id,participant_num' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: { judges: judges.length, finalists: finalists.length, cells: rows.length } });
}
