// GET   /api/admin/contests/[id]/participants
// POST  /api/admin/contests/[id]/participants            - 단일 생성
// PUT   /api/admin/contests/[id]/participants            - bulk upsert (전체 교체 아님)
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/db/client';
import { listParticipants } from '@/lib/db/queries';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const RoleEnum = z.enum(['leader', 'follower', 'helper_leader', 'helper_follower']);

const ParticipantBase = z.object({
  num: z.string().min(1).max(32).regex(/^[A-Za-z0-9_-]+$/),
  team_name: z.string().max(200).default(''),
  representative: z.string().max(200).default(''),
  role: RoleEnum,
  photo_url: z.string().max(2048).default(''),
  meta: z.record(z.string(), z.unknown()).optional().default({}),
});

interface RouteCtx { params: Promise<{ contestId: string }> }

export async function GET(_req: Request, ctx: RouteCtx) {
  const { contestId } = await ctx.params;
  const rows = await listParticipants(contestId);
  return NextResponse.json({ data: rows });
}

export async function POST(req: Request, ctx: RouteCtx) {
  const { contestId } = await ctx.params;
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 }); }
  const parsed = ParticipantBase.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION', issues: parsed.error.issues }, { status: 400 });
  }
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('participants')
    .insert({ ...parsed.data, contest_id: contestId })
    .select('*')
    .single();
  if (error) {
    const status = error.code === '23505' ? 409 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
  return NextResponse.json({ data }, { status: 201 });
}

export async function PUT(req: Request, ctx: RouteCtx) {
  const { contestId } = await ctx.params;
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 }); }
  const parsed = z.array(ParticipantBase).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION', issues: parsed.error.issues }, { status: 400 });
  }
  const rows = parsed.data.map((p) => ({ ...p, contest_id: contestId }));
  const sb = getSupabaseAdmin();
  const { error } = await sb.from('participants').upsert(rows, { onConflict: 'contest_id,num' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: { upserted: rows.length } });
}
