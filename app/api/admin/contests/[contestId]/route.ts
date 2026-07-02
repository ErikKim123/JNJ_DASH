// GET    /api/admin/contests/[contestId]
// PATCH  /api/admin/contests/[contestId]
// DELETE /api/admin/contests/[contestId]
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/db/client';
import { getContest } from '@/lib/db/queries';
import { JOIN_PRESET_KEYS } from '@/lib/join/theme';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ScoringItemEnum = z.enum([
  'fundamentals', 'connection', 'musicality',
  'creativity', 'crowd_reaction', 'showmanship',
]);

const RoundStatusEnum = z.enum([
  'prep', 'pairing', 'open', 'live', 'calculate', 'close', 'result',
]);

// 라운드별 추가 영상 — 각 라운드 최대 3개, 각 항목은 빈 문자열 또는 URL/링크 문자열.
const ExtraVideoArray = z.array(z.union([z.literal(''), z.string().max(2000)])).max(3);
const ExtraVideosSchema = z.object({
  prelim: ExtraVideoArray,
  semi: ExtraVideoArray,
  final: ExtraVideoArray,
}).partial();

const PatchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  host_org: z.string().max(200).optional(),
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  design_template_number: z.number().int().min(1).max(99).optional(),
  festival_header: z.string().max(200).optional(),
  tagline: z.string().max(200).optional(),
  prelim_pass_per_role: z.number().int().min(1).max(200).optional(),
  semi_pass_per_role: z.number().int().min(1).max(200).optional(),
  prelim_group_size: z.number().int().min(0).max(200).optional(),
  semi_group_size: z.number().int().min(0).max(200).optional(),
  prelim_groups: z.array(z.number().int().min(0).max(2000)).max(50).optional(),
  semi_groups: z.array(z.number().int().min(0).max(2000)).max(50).optional(),
  status: z.enum(['ready', 'closed', 'live', 'done', 'archived']).optional(),
  group_name: z.string().max(100).optional(),
  scoring_items: z.array(ScoringItemEnum).min(1).optional(),
  sponsor_logos: z
    .array(z.union([z.literal(''), z.string().url().max(2000)]))
    .max(6)
    .optional(),
  sponsor_logo_opacities: z
    .array(z.number().int().min(0).max(100))
    .max(6)
    .optional(),
  background_image: z.union([z.literal(''), z.string().url().max(2000)]).optional(),
  background_opacity: z.number().int().min(0).max(100).optional(),
  // 원격 URL(https) 또는 로컬 파일 풀경로(Z:\...) 모두 허용 — 표출 시 /api/video 로 변환.
  judges_video_url: z.union([z.literal(''), z.string().min(1).max(2000)]).optional(),
  extra_videos: ExtraVideosSchema.optional(),
  join_theme: z.string().refine((k) => JOIN_PRESET_KEYS.includes(k), 'unknown theme preset').optional(),
  join_accent: z
    .union([z.literal(''), z.string().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'accent 는 #RGB 또는 #RRGGBB hex')])
    .optional(),
  sns_url: z.union([z.literal(''), z.string().url().max(2000)]).optional(),
  sns_enabled: z.boolean().optional(),
  payment_url: z.union([z.literal(''), z.string().url().max(2000)]).optional(),
  payment_enabled: z.boolean().optional(),
  panel_judges_enabled: z.boolean().optional(),
  online_judges_enabled: z.boolean().optional(),
  panel_judge_weight: z.number().min(0).max(9999).optional(),
  online_judge_weight: z.number().min(0).max(9999).optional(),
  online_judge_rounds: z.array(z.enum(['prelim', 'semi', 'final'])).optional(),
  prelim_status: RoundStatusEnum.optional(),
  semi_status: RoundStatusEnum.optional(),
  final_status: RoundStatusEnum.optional(),
});

interface RouteCtx { params: Promise<{ contestId: string }> }

export async function GET(_req: Request, ctx: RouteCtx) {
  const { contestId } = await ctx.params;
  const row = await getContest(contestId);
  if (!row) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  return NextResponse.json({ data: row });
}

export async function PATCH(req: Request, ctx: RouteCtx) {
  const { contestId } = await ctx.params;
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
    .from('contests')
    .update(parsed.data)
    .eq('id', contestId)
    .select('*')
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  return NextResponse.json({ data });
}

export async function DELETE(_req: Request, ctx: RouteCtx) {
  const { contestId } = await ctx.params;
  const sb = getSupabaseAdmin();
  // CASCADE 로 participants/pairings/qualifiers/final_results 까지 자동 삭제됨.
  const { error } = await sb.from('contests').delete().eq('id', contestId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
