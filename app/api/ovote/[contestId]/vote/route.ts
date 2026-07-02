// PUT /api/ovote/[contestId]/vote
//   온라인 심사위원 결승 점수 단일 셀 upsert(공개). PIN 로그인으로 얻은 judgeId 를 함께 전송.
//   결승(final)이 online_judge_rounds 에 포함되고 final_status 가 open/live 일 때만 허용.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/db/client';
import { getContest } from '@/lib/db/queries';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const Body = z.object({
  judgeId: z.string().uuid(),
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
  if (!parsed.success) return NextResponse.json({ error: 'VALIDATION' }, { status: 400 });

  const contest = await getContest(contestId);
  if (!contest) return NextResponse.json({ error: 'CONTEST_NOT_FOUND' }, { status: 404 });
  // 결승 온라인 심사 허용 조건 검증.
  const rounds = Array.isArray(contest.online_judge_rounds) ? contest.online_judge_rounds : [];
  if (!contest.online_judges_enabled || !rounds.includes('final')) {
    return NextResponse.json({ error: 'ROUND_DISABLED' }, { status: 403 });
  }
  if (contest.final_status !== 'open' && contest.final_status !== 'live') {
    return NextResponse.json({ error: 'ROUND_LOCKED', status: contest.final_status }, { status: 403 });
  }

  const sb = getSupabaseAdmin();
  const { data: judge } = await sb
    .from('online_judges').select('contest_id').eq('id', parsed.data.judgeId).maybeSingle();
  if (!judge || judge.contest_id !== contestId) {
    return NextResponse.json({ error: 'JUDGE_NOT_IN_CONTEST' }, { status: 401 });
  }

  const { data: existing } = await sb
    .from('online_judge_votes')
    .select('*')
    .eq('online_judge_id', parsed.data.judgeId)
    .eq('participant_num', parsed.data.participant_num)
    .maybeSingle();

  const pick = (k: keyof typeof parsed.data, cur: number | null | undefined) =>
    k in parsed.data ? (parsed.data[k] as number | null) ?? null : cur ?? null;

  const merged = {
    online_judge_id: parsed.data.judgeId,
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
