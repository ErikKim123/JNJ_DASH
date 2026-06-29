// POST /api/judge/[contestId]/[round]/[judgeId]/submit
//   { submitted: boolean }
// 심사위원이 본인 페이지에서 채점을 제출/해제. submitted=true 면 submitted_at=now,
// false 면 null. 이 값이 관리자 매트릭스에서 해당 컬럼을 녹색으로 표시하는 신호.
// judgeId(URL) 가 비밀 토큰 — contest+round 소속 검증 후 해당 row 만 갱신(미러 X).
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/db/client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const Body = z.object({ submitted: z.boolean() });

interface RouteCtx { params: Promise<{ contestId: string; round: string; judgeId: string }> }

export async function POST(req: Request, ctx: RouteCtx) {
  const { contestId, round, judgeId } = await ctx.params;
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 }); }
  const parsed = Body.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'VALIDATION', issues: parsed.error.issues }, { status: 400 });

  const sb = getSupabaseAdmin();
  const { data: judge, error: je } = await sb
    .from('judges').select('contest_id, round').eq('id', judgeId).maybeSingle();
  if (je) return NextResponse.json({ error: je.message }, { status: 500 });
  if (!judge || judge.contest_id !== contestId || judge.round !== round) {
    return NextResponse.json({ error: 'JUDGE_NOT_FOUND' }, { status: 404 });
  }

  const submitted_at = parsed.data.submitted ? new Date().toISOString() : null;
  const { data, error } = await sb
    .from('judges')
    .update({ submitted_at })
    .eq('id', judgeId)
    .eq('contest_id', contestId)
    .select('id, submitted_at')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
