// GET /api/admin/contests/[id]/qualifiers/[round]
// PUT /api/admin/contests/[id]/qualifiers/[round]   - bulk replace
// POST /api/admin/contests/[id]/qualifiers/[round]  - 단일 추가
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/db/client';
import { listQualifiers } from '@/lib/db/queries';
import type { QualifierRoundDb } from '@/lib/db/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const RoundEnum = z.enum(['prelim', 'semi']);
const RoleEnum = z.enum(['leader', 'follower', 'helper_leader', 'helper_follower']);

const QualBase = z.object({
  participant_num: z.string().min(1).max(32),
  team_name: z.string().max(200).default(''),
  representative: z.string().max(200).default(''),
  role: RoleEnum,
  photo_url: z.string().max(2048).default(''),
  passed: z.boolean().default(false),
  votes: z.number().int().min(0).default(0),
  display_order: z.number().int().min(0).default(0),
});

interface RouteCtx { params: Promise<{ contestId: string; round: string }> }

function parseRound(round: string): QualifierRoundDb | null {
  const r = RoundEnum.safeParse(round);
  return r.success ? r.data : null;
}

export async function GET(_req: Request, ctx: RouteCtx) {
  const { contestId, round } = await ctx.params;
  const r = parseRound(round);
  if (!r) return NextResponse.json({ error: 'INVALID_ROUND' }, { status: 400 });
  const rows = await listQualifiers(contestId, r);
  return NextResponse.json({ data: rows });
}

export async function POST(req: Request, ctx: RouteCtx) {
  const { contestId, round } = await ctx.params;
  const r = parseRound(round);
  if (!r) return NextResponse.json({ error: 'INVALID_ROUND' }, { status: 400 });
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 }); }
  const parsed = QualBase.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION', issues: parsed.error.issues }, { status: 400 });
  }
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('qualifiers')
    .upsert({ ...parsed.data, contest_id: contestId, round: r }, { onConflict: 'contest_id,round,participant_num' })
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}

export async function PUT(req: Request, ctx: RouteCtx) {
  const { contestId, round } = await ctx.params;
  const r = parseRound(round);
  if (!r) return NextResponse.json({ error: 'INVALID_ROUND' }, { status: 400 });
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 }); }
  const parsed = z.array(QualBase).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION', issues: parsed.error.issues }, { status: 400 });
  }
  const sb = getSupabaseAdmin();
  const del = await sb.from('qualifiers').delete().eq('contest_id', contestId).eq('round', r);
  if (del.error) return NextResponse.json({ error: del.error.message }, { status: 500 });
  if (parsed.data.length === 0) return NextResponse.json({ data: [] });
  const rows = parsed.data.map((q) => ({ ...q, contest_id: contestId, round: r }));
  const ins = await sb.from('qualifiers').insert(rows).select('*');
  if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 500 });
  return NextResponse.json({ data: ins.data });
}
