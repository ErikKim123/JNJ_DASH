// PUT /api/judge/[contestId]/[round]/[judgeId]/votes
//   { participant_num, vote_mark?|basic_score?|...musicality_score? }
// 심사위원 본인 페이지 전용 — judgeId(URL) 가 비밀 토큰. 인증 미들웨어 우회(/api/admin 아님).
// 해당 judge 가 contest+round 에 실제 소속인지 검증한 뒤 단일 셀 upsert.
// 이미 제출(submitted_at != null)된 상태면 수정 불가 — 본인이 페이지에서 "수정하기"로 제출 해제해야 함.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/db/client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const Body = z.object({
  participant_num: z.string().min(1).max(32),
  vote_mark: z.enum(['O', 'X']).nullable().optional(),
  basic_score: z.number().min(0).max(999).nullable().optional(),
  connectivity_score: z.number().min(0).max(999).nullable().optional(),
  musicality_score: z.number().min(0).max(999).nullable().optional(),
  creativity_score: z.number().min(0).max(999).nullable().optional(),
  crowd_reaction_score: z.number().min(0).max(999).nullable().optional(),
  showmanship_score: z.number().min(0).max(999).nullable().optional(),
});

interface RouteCtx { params: Promise<{ contestId: string; round: string; judgeId: string }> }

export async function PUT(req: Request, ctx: RouteCtx) {
  const { contestId, round, judgeId } = await ctx.params;
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 }); }
  const parsed = Body.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'VALIDATION', issues: parsed.error.issues }, { status: 400 });

  const sb = getSupabaseAdmin();
  // judge 가 이 contest+round 소속인지 + 제출 여부 확인
  const { data: judge, error: je } = await sb
    .from('judges').select('contest_id, round, submitted_at').eq('id', judgeId).maybeSingle();
  if (je) return NextResponse.json({ error: je.message }, { status: 500 });
  if (!judge || judge.contest_id !== contestId || judge.round !== round) {
    return NextResponse.json({ error: 'JUDGE_NOT_FOUND' }, { status: 404 });
  }
  if (judge.submitted_at) {
    return NextResponse.json({ error: 'ALREADY_SUBMITTED' }, { status: 409 });
  }

  // 명시되지 않은 컬럼은 유지하기 위해 fetch 후 merge
  const { data: existing } = await sb
    .from('judge_votes')
    .select('*')
    .eq('judge_id', judgeId)
    .eq('participant_num', parsed.data.participant_num)
    .maybeSingle();

  const merged = {
    judge_id: judgeId,
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
