// POST /api/ovote/[contestId]/submit
//   온라인 심사위원 결승 채점 제출/해제.
//     { judgeId, submitted:true }  → 점수 저장 후 final_submitted_at = now (잠금)
//     { judgeId, submitted:false } → final_submitted_at = null (수정 재개)
//   entries 를 함께 보내면 제출 직전 일괄 저장(빈 셀은 무시).
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/db/client';
import { getContest } from '@/lib/db/queries';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ScoreFields = {
  basic_score: z.number().min(0).max(999).nullable().optional(),
  connectivity_score: z.number().min(0).max(999).nullable().optional(),
  musicality_score: z.number().min(0).max(999).nullable().optional(),
  creativity_score: z.number().min(0).max(999).nullable().optional(),
  crowd_reaction_score: z.number().min(0).max(999).nullable().optional(),
  showmanship_score: z.number().min(0).max(999).nullable().optional(),
};

const Body = z.object({
  judgeId: z.string().uuid(),
  submitted: z.boolean(),
  entries: z.array(z.object({ participant_num: z.string().min(1).max(32), ...ScoreFields })).max(500).optional(),
});

const SCORE_COLS = Object.keys(ScoreFields);

interface RouteCtx { params: Promise<{ contestId: string }> }

export async function POST(req: Request, ctx: RouteCtx) {
  const { contestId } = await ctx.params;
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 }); }
  const parsed = Body.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'VALIDATION' }, { status: 400 });

  const contest = await getContest(contestId);
  if (!contest) return NextResponse.json({ error: 'CONTEST_NOT_FOUND' }, { status: 404 });
  const rounds = Array.isArray(contest.online_judge_rounds) ? contest.online_judge_rounds : [];
  const roundOpen = contest.online_judges_enabled && rounds.includes('final')
    && (contest.final_status === 'open' || contest.final_status === 'live');
  // 제출/저장은 결승이 열려 있을 때만. 해제(submitted=false)도 동일 정책.
  if (!roundOpen) return NextResponse.json({ error: 'ROUND_LOCKED', status: contest.final_status }, { status: 403 });

  const sb = getSupabaseAdmin();
  const { data: judge } = await sb
    .from('online_judges').select('contest_id').eq('id', parsed.data.judgeId).maybeSingle();
  if (!judge || judge.contest_id !== contestId) {
    return NextResponse.json({ error: 'JUDGE_NOT_IN_CONTEST' }, { status: 401 });
  }

  // 제출 직전 일괄 저장 (entries 제공 시).
  if (parsed.data.entries?.length) {
    const rows = parsed.data.entries.map((e) => {
      const row: Record<string, unknown> = {
        online_judge_id: parsed.data.judgeId,
        participant_num: e.participant_num,
      };
      for (const c of SCORE_COLS) row[c] = (e as Record<string, unknown>)[c] ?? null;
      return row;
    });
    const { error: upErr } = await sb
      .from('online_judge_votes')
      .upsert(rows, { onConflict: 'online_judge_id,participant_num' });
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  const { data, error } = await sb
    .from('online_judges')
    .update({ final_submitted_at: parsed.data.submitted ? new Date().toISOString() : null })
    .eq('id', parsed.data.judgeId)
    .select('final_submitted_at')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: { submittedAt: data.final_submitted_at } });
}
