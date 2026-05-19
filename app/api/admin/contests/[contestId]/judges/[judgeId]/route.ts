// PATCH/DELETE /api/admin/contests/[id]/judges/[judgeId]
//   judgeId 가 속한 (contest_id, display_order) 그룹 전체(prelim/semi/final)에 동일 변경 적용.
//   "한 명이 모든 라운드 심사" UX 를 유지하기 위한 mirror 엔드포인트.
//
// 주의:
//   - display_order 변경은 허용하지 않음 (3 row 동시 swap 시 unique 충돌 위험).
//     순서를 바꾸려면 라운드별 엔드포인트(/judging/[round]/judges/[id])를 사용.
//   - 프로필 필드(name, alias 등) 와 max_votes 변경은 모두 mirror.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/db/client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TargetRole = z.enum(['leader', 'follower', 'both']);
const Patch = z.object({
  name: z.string().min(1).max(200).optional(),
  alias: z.string().max(200).optional(),
  specialty: z.string().max(200).optional(),
  target_role: TargetRole.optional(),
  career: z.string().max(2000).optional(),
  phone: z.string().max(64).optional(),
  email: z.string().max(200).optional(),
  memo: z.string().max(2000).optional(),
  max_votes: z.number().int().min(0).max(999).nullable().optional(),
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
  // 1) judgeId 로 display_order 조회 (mirror 키)
  const { data: judge, error: je } = await sb
    .from('judges')
    .select('display_order')
    .eq('id', judgeId)
    .eq('contest_id', contestId)
    .maybeSingle();
  if (je) return NextResponse.json({ error: je.message }, { status: 500 });
  if (!judge) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

  // 2) 같은 (contest_id, display_order) 의 모든 라운드 row 갱신
  const { data, error } = await sb
    .from('judges')
    .update(parsed.data)
    .eq('contest_id', contestId)
    .eq('display_order', judge.display_order)
    .select('*');
  if (error) {
    const status = error.code === '23505' ? 409 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
  const canonical = (data ?? []).find((d) => d.round === 'prelim') ?? data?.[0];
  return NextResponse.json({ data: canonical, group: data });
}

export async function DELETE(_req: Request, ctx: RouteCtx) {
  const { contestId, judgeId } = await ctx.params;
  const sb = getSupabaseAdmin();
  const { data: judge, error: je } = await sb
    .from('judges')
    .select('display_order')
    .eq('id', judgeId)
    .eq('contest_id', contestId)
    .maybeSingle();
  if (je) return NextResponse.json({ error: je.message }, { status: 500 });
  if (!judge) return new NextResponse(null, { status: 204 });

  const { error } = await sb
    .from('judges')
    .delete()
    .eq('contest_id', contestId)
    .eq('display_order', judge.display_order);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
