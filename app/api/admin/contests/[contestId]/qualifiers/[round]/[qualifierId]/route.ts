// PATCH/DELETE 단일 qualifier
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/db/client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const RoleEnum = z.enum(['leader', 'follower', 'helper_leader', 'helper_follower']);
const PatchSchema = z.object({
  team_name: z.string().max(200).optional(),
  representative: z.string().max(200).optional(),
  role: RoleEnum.optional(),
  photo_url: z.string().max(2048).optional(),
  passed: z.boolean().optional(),
  votes: z.number().int().min(0).optional(),
  display_order: z.number().int().min(0).optional(),
});

interface RouteCtx {
  params: Promise<{ contestId: string; round: string; qualifierId: string }>;
}

export async function PATCH(req: Request, ctx: RouteCtx) {
  const { contestId, qualifierId } = await ctx.params;
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 }); }
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION', issues: parsed.error.issues }, { status: 400 });
  }
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'NO_FIELDS' }, { status: 400 });
  }
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('qualifiers')
    .update(parsed.data)
    .eq('id', qualifierId)
    .eq('contest_id', contestId)
    .select('*')
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  return NextResponse.json({ data });
}

export async function DELETE(_req: Request, ctx: RouteCtx) {
  const { contestId, qualifierId } = await ctx.params;
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from('qualifiers')
    .delete()
    .eq('id', qualifierId)
    .eq('contest_id', contestId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
