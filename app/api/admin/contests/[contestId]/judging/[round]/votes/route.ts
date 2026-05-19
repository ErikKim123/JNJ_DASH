// PUT /api/admin/contests/[id]/judging/[round]/votes
//   { judge_id, participant_num, vote_mark?|basic_score?|connectivity_score?|musicality_score? }
// 단일 셀 upsert. 빈 값(null) 처리도 허용 — 비우면 해당 컬럼 null 로.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/db/client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const Body = z.object({
  judge_id: z.string().uuid(),
  participant_num: z.string().min(1).max(32),
  vote_mark: z.enum(['O', 'X']).nullable().optional(),
  basic_score: z.number().min(0).max(999).nullable().optional(),
  connectivity_score: z.number().min(0).max(999).nullable().optional(),
  musicality_score: z.number().min(0).max(999).nullable().optional(),
  creativity_score: z.number().min(0).max(999).nullable().optional(),
  crowd_reaction_score: z.number().min(0).max(999).nullable().optional(),
  showmanship_score: z.number().min(0).max(999).nullable().optional(),
});

interface RouteCtx { params: Promise<{ contestId: string; round: string }> }

export async function PUT(req: Request, ctx: RouteCtx) {
  const { contestId } = await ctx.params;
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 }); }
  const parsed = Body.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'VALIDATION', issues: parsed.error.issues }, { status: 400 });

  const sb = getSupabaseAdmin();
  // judge_id 가 해당 contest 소속인지 확인 (cross-contest injection 방지)
  const { data: judge, error: je } = await sb
    .from('judges').select('contest_id').eq('id', parsed.data.judge_id).maybeSingle();
  if (je) return NextResponse.json({ error: je.message }, { status: 500 });
  if (!judge || judge.contest_id !== contestId) {
    return NextResponse.json({ error: 'JUDGE_NOT_IN_CONTEST' }, { status: 400 });
  }

  // upsert 시 명시되지 않은 컬럼은 그대로 유지하기 위해 fetch 후 merge
  const { data: existing } = await sb
    .from('judge_votes')
    .select('*')
    .eq('judge_id', parsed.data.judge_id)
    .eq('participant_num', parsed.data.participant_num)
    .maybeSingle();

  const merged = {
    judge_id: parsed.data.judge_id,
    participant_num: parsed.data.participant_num,
    vote_mark: 'vote_mark' in parsed.data ? parsed.data.vote_mark ?? null : existing?.vote_mark ?? null,
    basic_score: 'basic_score' in parsed.data ? parsed.data.basic_score ?? null : existing?.basic_score ?? null,
    connectivity_score: 'connectivity_score' in parsed.data ? parsed.data.connectivity_score ?? null : existing?.connectivity_score ?? null,
    musicality_score: 'musicality_score' in parsed.data ? parsed.data.musicality_score ?? null : existing?.musicality_score ?? null,
    creativity_score: 'creativity_score' in parsed.data ? parsed.data.creativity_score ?? null : existing?.creativity_score ?? null,
    crowd_reaction_score: 'crowd_reaction_score' in parsed.data ? parsed.data.crowd_reaction_score ?? null : existing?.crowd_reaction_score ?? null,
    showmanship_score: 'showmanship_score' in parsed.data ? parsed.data.showmanship_score ?? null : existing?.showmanship_score ?? null,
  };

  const { data, error } = await sb
    .from('judge_votes')
    .upsert(merged, { onConflict: 'judge_id,participant_num' })
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
