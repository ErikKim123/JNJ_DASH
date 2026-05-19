// GET /api/admin/contests/[id]/finals
// POST /api/admin/contests/[id]/finals             - 단일 upsert
// PUT /api/admin/contests/[id]/finals              - bulk replace
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/db/client';
import { listFinalResults } from '@/lib/db/queries';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const RoleEnum = z.enum(['leader', 'follower']);

const FinalBase = z.object({
  participant_num: z.string().min(1).max(32),
  team_name: z.string().max(200).default(''),
  role: RoleEnum,
  final_rank: z.number().int().min(1).max(100).nullable().optional().default(null),
  total_score: z.number().nullable().optional().default(null),
  average: z.number().nullable().optional().default(null),
  photo_url: z.string().max(2048).default(''),
});

interface RouteCtx { params: Promise<{ contestId: string }> }

export async function GET(_req: Request, ctx: RouteCtx) {
  const { contestId } = await ctx.params;
  const rows = await listFinalResults(contestId);
  return NextResponse.json({ data: rows });
}

export async function POST(req: Request, ctx: RouteCtx) {
  const { contestId } = await ctx.params;
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 }); }
  const parsed = FinalBase.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION', issues: parsed.error.issues }, { status: 400 });
  }
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('final_results')
    .upsert({ ...parsed.data, contest_id: contestId }, { onConflict: 'contest_id,role,participant_num' })
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}

export async function PUT(req: Request, ctx: RouteCtx) {
  const { contestId } = await ctx.params;
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 }); }
  const parsed = z.array(FinalBase).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION', issues: parsed.error.issues }, { status: 400 });
  }
  const sb = getSupabaseAdmin();
  const del = await sb.from('final_results').delete().eq('contest_id', contestId);
  if (del.error) return NextResponse.json({ error: del.error.message }, { status: 500 });
  if (parsed.data.length === 0) return NextResponse.json({ data: [] });
  const rows = parsed.data.map((f) => ({ ...f, contest_id: contestId }));
  const ins = await sb.from('final_results').insert(rows).select('*');
  if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 500 });
  return NextResponse.json({ data: ins.data });
}
