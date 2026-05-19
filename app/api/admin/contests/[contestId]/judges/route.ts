// POST /api/admin/contests/[id]/judges
//   통합 명단에 심사위원 추가 → prelim/semi/final 3 라운드에 동시 생성 (mirror).
//   display_order 는 contest 내 모든 라운드의 max + 1.
//
// "한 명이 예선/본선/결승 모두 심사" UX 를 위한 단일 진입점.
// 라운드 분리 스키마는 그대로 두고 UI/입력 단에서만 한 묶음으로 다룸.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/db/client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TargetRole = z.enum(['leader', 'follower', 'both']);
const Body = z.object({
  name: z.string().min(1).max(200),
  alias: z.string().max(200).optional(),
  specialty: z.string().max(200).optional(),
  target_role: TargetRole.optional(),
  career: z.string().max(2000).optional(),
  phone: z.string().max(64).optional(),
  email: z.string().max(200).optional(),
  memo: z.string().max(2000).optional(),
  max_votes: z.number().int().min(0).max(999).nullable().optional(),
});

interface RouteCtx { params: Promise<{ contestId: string }> }

export async function POST(req: Request, ctx: RouteCtx) {
  const { contestId } = await ctx.params;
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 }); }
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION', issues: parsed.error.issues }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  // 다음 display_order — contest 전체(모든 라운드) 의 max + 1.
  // 라운드 간 비대칭 데이터가 있어도 안전 (어느 라운드에도 점유되지 않은 order).
  const { data: maxRow } = await sb
    .from('judges')
    .select('display_order')
    .eq('contest_id', contestId)
    .order('display_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  const displayOrder = (maxRow?.display_order ?? 0) + 1;

  const base = {
    contest_id: contestId,
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
    .insert([
      { ...base, round: 'prelim' },
      { ...base, round: 'semi'   },
      { ...base, round: 'final'  },
    ])
    .select('*');
  if (error) {
    const status = error.code === '23505' ? 409 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
  // canonical: prelim row 반환 (없을 일은 없지만 fallback)
  const prelim = (data ?? []).find((d) => d.round === 'prelim') ?? data?.[0];
  return NextResponse.json({ data: prelim, group: data }, { status: 201 });
}
