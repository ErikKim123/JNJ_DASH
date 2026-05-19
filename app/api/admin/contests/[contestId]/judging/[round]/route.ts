// GET  /api/admin/contests/[id]/judging/[round]
//   → { judges: JudgeRow[], votes: JudgeVoteRow[] }
//   라운드별 심사위원 명단 + 모든 투표 셀을 한 번에 반환 (매트릭스 렌더용).
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { listJudges, listJudgeVotes } from '@/lib/db/queries';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const RoundEnum = z.enum(['prelim', 'semi', 'final']);

interface RouteCtx { params: Promise<{ contestId: string; round: string }> }

export async function GET(_req: Request, ctx: RouteCtx) {
  const { contestId, round } = await ctx.params;
  const r = RoundEnum.safeParse(round);
  if (!r.success) return NextResponse.json({ error: 'INVALID_ROUND' }, { status: 400 });
  const [judges, votes] = await Promise.all([
    listJudges(contestId, r.data),
    listJudgeVotes(contestId, r.data),
  ]);
  return NextResponse.json({ data: { judges, votes } });
}
