// POST /api/admin/contests/[id]/judging/[round]/judges    - add judge
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/db/client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const RoundEnum = z.enum(['prelim', 'semi', 'final']);
const TargetRole = z.enum(['leader', 'follower', 'both']);
const Body = z.object({
  name: z.string().min(1).max(200),
  display_order: z.number().int().min(1).max(99).optional(),
  alias: z.string().max(200).optional(),
  specialty: z.string().max(200).optional(),
  target_role: TargetRole.optional(),
  career: z.string().max(2000).optional(),
  phone: z.string().max(64).optional(),
  email: z.string().max(200).optional(),
  memo: z.string().max(2000).optional(),
  max_votes: z.number().int().min(0).max(999).nullable().optional(),
});

interface RouteCtx { params: Promise<{ contestId: string; round: string }> }

export async function POST(req: Request, ctx: RouteCtx) {
  const { contestId, round } = await ctx.params;
  const r = RoundEnum.safeParse(round);
  if (!r.success) return NextResponse.json({ error: 'INVALID_ROUND' }, { status: 400 });
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 }); }
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION', issues: parsed.error.issues }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  // display_order 미지정 시 라운드의 max+1 자동 할당.
  let displayOrder = parsed.data.display_order;
  if (displayOrder == null) {
    const { data: maxRow } = await sb
      .from('judges')
      .select('display_order')
      .eq('contest_id', contestId)
      .eq('round', r.data)
      .order('display_order', { ascending: false })
      .limit(1)
      .maybeSingle();
    displayOrder = (maxRow?.display_order ?? 0) + 1;
  }

  const insertRow = {
    contest_id: contestId,
    round: r.data,
    display_order: displayOrder,
    name: parsed.data.name,
    alias: parsed.data.alias ?? '',
    specialty: parsed.data.specialty ?? '',
    target_role: parsed.data.target_role ?? 'both',
    career: parsed.data.career ?? '',
    phone: parsed.data.phone ?? '',
    email: parsed.data.email ?? '',
    memo: parsed.data.memo ?? '',
    max_votes: parsed.data.max_votes ?? null,
  };
  const { data, error } = await sb
    .from('judges')
    .insert(insertRow)
    .select('*')
    .single();
  if (error) {
    const status = error.code === '23505' ? 409 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
  return NextResponse.json({ data }, { status: 201 });
}
