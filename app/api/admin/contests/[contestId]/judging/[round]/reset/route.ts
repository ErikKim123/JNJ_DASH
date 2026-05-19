// POST /api/admin/contests/[id]/judging/[round]/reset
//   해당 라운드의 모든 judge_votes 행 삭제. judges 명단은 유지.
//   라운드의 매트릭스를 깨끗하게 비우고 재시작용.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/db/client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const RoundEnum = z.enum(['prelim', 'semi', 'final']);

interface RouteCtx { params: Promise<{ contestId: string; round: string }> }

export async function POST(_req: Request, ctx: RouteCtx) {
  const { contestId, round } = await ctx.params;
  const r = RoundEnum.safeParse(round);
  if (!r.success) return NextResponse.json({ error: 'INVALID_ROUND' }, { status: 400 });
  const sb = getSupabaseAdmin();

  // judges 의 id 들로 votes 행만 삭제 (cross-round 안전)
  const { data: judges, error: je } = await sb
    .from('judges')
    .select('id')
    .eq('contest_id', contestId)
    .eq('round', r.data);
  if (je) return NextResponse.json({ error: je.message }, { status: 500 });
  const ids = (judges ?? []).map((j) => j.id);
  if (ids.length === 0) return NextResponse.json({ data: { deleted: 0 } });

  const { error, count } = await sb
    .from('judge_votes')
    .delete({ count: 'exact' })
    .in('judge_id', ids);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: { deleted: count ?? 0 } });
}
