// POST /api/admin/contests/[id]/judging/[round]/uncommit
//   "통과자 확정" 의 역연산. 해당 라운드의 qualifiers 행을 모두 삭제한다.
//   judge_votes / pairings / judges 는 건드리지 않는다 — 같은 표 결과로 다시 commit 가능.
//   prelim/semi 만 지원 (final 은 final_results 별도 관리).
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/db/client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const RoundEnum = z.enum(['prelim', 'semi']);

interface RouteCtx { params: Promise<{ contestId: string; round: string }> }

export async function POST(_req: Request, ctx: RouteCtx) {
  const { contestId, round } = await ctx.params;
  const r = RoundEnum.safeParse(round);
  if (!r.success) {
    return NextResponse.json({ error: 'UNCOMMIT_ONLY_PRELIM_OR_SEMI' }, { status: 400 });
  }
  const sb = getSupabaseAdmin();

  // 삭제 전 카운트 — 응답 메시지용.
  const { count, error: ce } = await sb
    .from('qualifiers')
    .select('participant_num', { count: 'exact', head: true })
    .eq('contest_id', contestId)
    .eq('round', r.data);
  if (ce) return NextResponse.json({ error: ce.message }, { status: 500 });

  const { error: de } = await sb
    .from('qualifiers')
    .delete()
    .eq('contest_id', contestId)
    .eq('round', r.data);
  if (de) return NextResponse.json({ error: de.message }, { status: 500 });

  return NextResponse.json({ data: { deleted: count ?? 0, round: r.data } });
}
