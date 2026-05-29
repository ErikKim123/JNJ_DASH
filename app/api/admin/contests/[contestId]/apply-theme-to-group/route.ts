// POST /api/admin/contests/[contestId]/apply-theme-to-group
//   이 대회의 JOIN 톤앤매너(join_theme + join_accent)를 같은 그룹(group_name)에 속한
//   모든 대회에 일괄 적용한다. group_name 은 서버에서 대상 대회 레코드 기준으로 읽는다.
//   body: { join_theme: string, join_accent: string } — 적용할 테마 값(폼의 현재 선택).
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/db/client';
import { getContest } from '@/lib/db/queries';
import { JOIN_PRESET_KEYS } from '@/lib/join/theme';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BodySchema = z.object({
  join_theme: z.string().refine((k) => JOIN_PRESET_KEYS.includes(k), 'unknown theme preset'),
  join_accent: z
    .union([z.literal(''), z.string().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'accent 는 #RGB 또는 #RRGGBB hex')]),
});

interface RouteCtx { params: Promise<{ contestId: string }> }

export async function POST(req: Request, ctx: RouteCtx) {
  const { contestId } = await ctx.params;

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 }); }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION', issues: parsed.error.issues }, { status: 400 });
  }

  const contest = await getContest(contestId);
  if (!contest) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

  const group = (contest.group_name ?? '').trim();
  if (!group) {
    // 그룹 미지정 대회 — 전체 미분류 대상에 무차별 적용되는 사고 방지.
    return NextResponse.json({ error: 'NO_GROUP' }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('contests')
    .update({ join_theme: parsed.data.join_theme, join_accent: parsed.data.join_accent })
    .eq('group_name', group)
    .select('id');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data: { group, applied: data?.length ?? 0, ids: (data ?? []).map((r) => r.id) } });
}
