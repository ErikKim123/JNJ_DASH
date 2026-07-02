// PUT /api/admin/contests/[id]/online-final-judging/votes
//   { online_judge_id, participant_num, basic_score?|connectivity_score?|... }
// 온라인 심사위원 결승 채점 단일 셀 upsert. 명시되지 않은 컬럼은 유지, 빈 값(null)이면 해당 컬럼 null.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/db/client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const Body = z.object({
  online_judge_id: z.string().uuid(),
  participant_num: z.string().min(1).max(32),
  basic_score: z.number().min(0).max(999).nullable().optional(),
  connectivity_score: z.number().min(0).max(999).nullable().optional(),
  musicality_score: z.number().min(0).max(999).nullable().optional(),
  creativity_score: z.number().min(0).max(999).nullable().optional(),
  crowd_reaction_score: z.number().min(0).max(999).nullable().optional(),
  showmanship_score: z.number().min(0).max(999).nullable().optional(),
});

interface RouteCtx { params: Promise<{ contestId: string }> }

export async function PUT(req: Request, ctx: RouteCtx) {
  const { contestId } = await ctx.params;
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 }); }
  const parsed = Body.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'VALIDATION', issues: parsed.error.issues }, { status: 400 });

  const sb = getSupabaseAdmin();
  // online_judge 가 해당 contest 소속인지 확인 (cross-contest injection 방지)
  const { data: judge, error: je } = await sb
    .from('online_judges').select('contest_id').eq('id', parsed.data.online_judge_id).maybeSingle();
  if (je) return NextResponse.json({ error: je.message }, { status: 500 });
  if (!judge || judge.contest_id !== contestId) {
    return NextResponse.json({ error: 'JUDGE_NOT_IN_CONTEST' }, { status: 400 });
  }

  const { data: existing } = await sb
    .from('online_judge_votes')
    .select('*')
    .eq('online_judge_id', parsed.data.online_judge_id)
    .eq('participant_num', parsed.data.participant_num)
    .maybeSingle();

  const pick = (k: keyof typeof parsed.data, cur: number | null | undefined) =>
    k in parsed.data ? (parsed.data[k] as number | null) ?? null : cur ?? null;

  const merged = {
    online_judge_id: parsed.data.online_judge_id,
    participant_num: parsed.data.participant_num,
    basic_score: pick('basic_score', existing?.basic_score),
    connectivity_score: pick('connectivity_score', existing?.connectivity_score),
    musicality_score: pick('musicality_score', existing?.musicality_score),
    creativity_score: pick('creativity_score', existing?.creativity_score),
    crowd_reaction_score: pick('crowd_reaction_score', existing?.crowd_reaction_score),
    showmanship_score: pick('showmanship_score', existing?.showmanship_score),
  };

  const { data, error } = await sb
    .from('online_judge_votes')
    .upsert(merged, { onConflict: 'online_judge_id,participant_num' })
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
