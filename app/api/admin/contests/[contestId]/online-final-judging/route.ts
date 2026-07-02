// GET /api/admin/contests/[id]/online-final-judging
//   온라인 결승 심사 매트릭스 새로고침용 — 온라인 심사위원 + votes 최신값.
import { NextResponse } from 'next/server';
import { listAllOnlineJudges, listOnlineJudgeVotes } from '@/lib/db/queries';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface RouteCtx { params: Promise<{ contestId: string }> }

export async function GET(_req: Request, ctx: RouteCtx) {
  const { contestId } = await ctx.params;
  try {
    const [judges, votes] = await Promise.all([
      listAllOnlineJudges(contestId),
      listOnlineJudgeVotes(contestId),
    ]);
    return NextResponse.json({ data: { judges, votes } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'DB_ERR' }, { status: 500 });
  }
}
