// PATCH/DELETE /api/admin/contests/[id]/online-judges/[judgeId]
//   온라인 심사위원 한 명의 프로필/PIN 수정 또는 삭제.
//   (등록 자체는 공개 조인앱 /api/ojudge/[id]/submit 에서 이뤄짐)
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/db/client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const Patch = z.object({
  name: z.string().max(200).optional(),
  first_name: z.string().max(200).optional(),
  last_name: z.string().max(200).optional(),
  representative: z.string().max(200).optional(),
  email: z.string().max(320).optional(),
  phone: z.string().max(64).optional(),
  photo_url: z.string().max(2048).optional(),
  // PIN 은 빈 문자열(해제) 또는 정확히 4자리 숫자만 허용.
  pin: z.string().regex(/^(\d{4})?$/, 'PIN must be 4 digits').optional(),
});

interface RouteCtx { params: Promise<{ contestId: string; judgeId: string }> }

export async function PATCH(req: Request, ctx: RouteCtx) {
  const { contestId, judgeId } = await ctx.params;
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 }); }
  const parsed = Patch.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'VALIDATION', issues: parsed.error.issues }, { status: 400 });
  if (Object.keys(parsed.data).length === 0) return NextResponse.json({ error: 'NO_FIELDS' }, { status: 400 });

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('online_judges')
    .update(parsed.data)
    .eq('id', judgeId)
    .eq('contest_id', contestId)
    .select('*')
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  return NextResponse.json({ data });
}

export async function DELETE(_req: Request, ctx: RouteCtx) {
  const { contestId, judgeId } = await ctx.params;
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from('online_judges')
    .delete()
    .eq('id', judgeId)
    .eq('contest_id', contestId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
