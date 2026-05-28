// GET  /api/admin/contests          - 전체 목록
// POST /api/admin/contests          - 생성
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/db/client';
import { listContests } from '@/lib/db/queries';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ScoringItemEnum = z.enum([
  'fundamentals', 'connection', 'musicality',
  'creativity', 'crowd_reaction', 'showmanship',
]);

const CreateContestSchema = z.object({
  id: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/, 'id 는 영문/숫자/-/_ 만 허용 (예: JNJ-004)'),
  name: z.string().min(1).max(200),
  host_org: z.string().max(200).optional().default(''),
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  design_template_number: z.number().int().min(1).max(99).optional().default(1),
  festival_header: z.string().max(200).optional().default(''),
  tagline: z.string().max(200).optional().default(''),
  prelim_pass_per_role: z.number().int().min(1).max(200).optional().default(10),
  semi_pass_per_role: z.number().int().min(1).max(200).optional().default(5),
  status: z.enum(['ready', 'live', 'done', 'archived']).optional().default('ready'),
  // JOIN APP 그룹 폴더 키. 자유 텍스트 (예: 'JLCL', 'PSLF'). 빈 문자열 = 미분류.
  group_name: z.string().max(100).optional().default(''),
  scoring_items: z.array(ScoringItemEnum).min(1).optional(),
  sponsor_logos: z
    .array(z.union([z.literal(''), z.string().url().max(2000)]))
    .max(6)
    .optional()
    .default([]),
  sponsor_logo_opacities: z
    .array(z.number().int().min(0).max(100))
    .max(6)
    .optional()
    .default([]),
  background_image: z
    .union([z.literal(''), z.string().url().max(2000)])
    .optional()
    .default(''),
  background_opacity: z.number().int().min(0).max(100).optional().default(100),
});

export async function GET() {
  try {
    const rows = await listContests();
    return NextResponse.json({ data: rows });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'unknown' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
  }
  const parsed = CreateContestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'VALIDATION', issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('contests')
    .insert(parsed.data)
    .select('*')
    .single();
  if (error) {
    const status = error.code === '23505' ? 409 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
  return NextResponse.json({ data }, { status: 201 });
}
