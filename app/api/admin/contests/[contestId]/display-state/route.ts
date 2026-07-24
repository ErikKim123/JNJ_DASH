// PUT /api/admin/contests/[contestId]/display-state   { round, step }
//   MC 모바일이 표출 포인터(현재 라운드/스텝)를 기록. 미들웨어(admin 세션)로 보호됨.
//   프로젝터(대시보드)는 공개 GET /api/contests/[id]/display-state 로 이 값을 폴링한다.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/db/client';
import { ROUND_KEYS, STEP_KEYS } from '@/lib/sheets/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BodySchema = z.object({
  round: z.enum(ROUND_KEYS as unknown as [string, ...string[]]),
  step: z.enum(STEP_KEYS as unknown as [string, ...string[]]),
});

interface RouteCtx { params: Promise<{ contestId: string }> }

export async function PUT(req: Request, ctx: RouteCtx) {
  const { contestId } = await ctx.params;
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 }); }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION', issues: parsed.error.issues }, { status: 400 });
  }
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('contests')
    .update({
      display_round: parsed.data.round,
      display_step: parsed.data.step,
      display_updated_at: new Date().toISOString(),
    })
    .eq('id', contestId)
    .select('display_round, display_step, display_updated_at')
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  return NextResponse.json({
    data: { round: data.display_round, step: data.display_step, updatedAt: data.display_updated_at },
  });
}
