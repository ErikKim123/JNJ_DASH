// PATCH  /api/admin/contests/[id]/participants/[participantId]
// DELETE /api/admin/contests/[id]/participants/[participantId]
//
// participantId 는 participants.id (uuid).
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/db/client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const RoleEnum = z.enum(['leader', 'follower', 'helper_leader', 'helper_follower']);
const PatchSchema = z.object({
  num: z.string().min(1).max(32).regex(/^[A-Za-z0-9_-]+$/).optional(),
  first_name: z.string().max(200).optional(),
  last_name: z.string().max(200).optional(),
  representative: z.string().max(200).optional(),
  role: RoleEnum.optional(),
  photo_url: z.string().max(2048).optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

interface RouteCtx {
  params: Promise<{ contestId: string; participantId: string }>;
}

export async function PATCH(req: Request, ctx: RouteCtx) {
  const { contestId, participantId } = await ctx.params;
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 }); }
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION', issues: parsed.error.issues }, { status: 400 });
  }
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'NO_FIELDS' }, { status: 400 });
  }
  // 표시명(team_name)은 last_name 과 동기화 — last_name 이 패치에 포함될 때만 갱신.
  const patch: Record<string, unknown> = { ...parsed.data };
  if (typeof parsed.data.first_name === 'string') {
    patch.first_name = parsed.data.first_name.trim();
  }
  if (typeof parsed.data.last_name === 'string') {
    patch.last_name = parsed.data.last_name.trim();
    patch.team_name = parsed.data.last_name.trim();
  }
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('participants')
    .update(patch)
    .eq('id', participantId)
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
  const { contestId, participantId } = await ctx.params;
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from('participants')
    .delete()
    .eq('id', participantId)
    .eq('contest_id', contestId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
