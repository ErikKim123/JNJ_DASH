// PATCH/DELETE single judge
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/db/client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TargetRole = z.enum(['leader', 'follower', 'both']);
const Patch = z.object({
  name: z.string().min(1).max(200).optional(),
  display_order: z.number().int().min(1).max(99).optional(),
  alias: z.string().max(200).optional(),
  specialty: z.string().max(200).optional(),
  target_role: TargetRole.optional(),
  career: z.string().max(2000).optional(),
  phone: z.string().max(64).optional(),
  email: z.string().max(200).optional(),
  memo: z.string().max(2000).optional(),
  max_votes: z.number().int().min(0).max(999).nullable().optional(),
  // 채점 제출 완료 토글 — ISO 시각 = 제출됨, null = 제출 해제. 이 라운드 row 만 갱신(미러 X).
  submitted_at: z.string().datetime().nullable().optional(),
});

interface RouteCtx { params: Promise<{ contestId: string; round: string; judgeId: string }> }

export async function PATCH(req: Request, ctx: RouteCtx) {
  const { contestId, judgeId } = await ctx.params;
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 }); }
  const parsed = Patch.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'VALIDATION', issues: parsed.error.issues }, { status: 400 });
  if (Object.keys(parsed.data).length === 0) return NextResponse.json({ error: 'NO_FIELDS' }, { status: 400 });
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('judges')
    .update(parsed.data)
    .eq('id', judgeId)
    .eq('contest_id', contestId)
    .select('*')
    .maybeSingle();
  if (error) {
    const status = error.code === '23505' ? 409 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
  if (!data) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  return NextResponse.json({ data });
}

export async function DELETE(_req: Request, ctx: RouteCtx) {
  const { contestId, judgeId } = await ctx.params;
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from('judges')
    .delete()
    .eq('id', judgeId)
    .eq('contest_id', contestId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
