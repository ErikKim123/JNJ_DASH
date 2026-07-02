// POST /api/admin/contests/[id]/online-final-judging/submit
//   관리자용 — 특정 온라인 심사위원의 결승 제출 상태 토글.
//   { judgeId, submitted:boolean } → final_submitted_at = now / null.
//   주로 제출 해제(submitted=false)에 사용.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/db/client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const Body = z.object({
  judgeId: z.string().uuid(),
  submitted: z.boolean(),
});

interface RouteCtx { params: Promise<{ contestId: string }> }

export async function POST(req: Request, ctx: RouteCtx) {
  const { contestId } = await ctx.params;
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 }); }
  const parsed = Body.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'VALIDATION' }, { status: 400 });

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('online_judges')
    .update({ final_submitted_at: parsed.data.submitted ? new Date().toISOString() : null })
    .eq('id', parsed.data.judgeId)
    .eq('contest_id', contestId)
    .select('id, final_submitted_at')
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  return NextResponse.json({ data: { submittedAt: data.final_submitted_at } });
}
