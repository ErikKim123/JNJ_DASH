// POST /api/admin/contests/[id]/online-final-judging/reset
//   온라인 결승 채점 초기화 — 이 대회 온라인 심사위원의 모든 점수 삭제 + 제출 상태 해제.
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db/client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface RouteCtx { params: Promise<{ contestId: string }> }

export async function POST(_req: Request, ctx: RouteCtx) {
  const { contestId } = await ctx.params;
  const sb = getSupabaseAdmin();

  // 대회의 온라인 심사위원 id 목록.
  const { data: judges, error: je } = await sb
    .from('online_judges').select('id').eq('contest_id', contestId);
  if (je) return NextResponse.json({ error: je.message }, { status: 500 });
  const ids = (judges ?? []).map((j) => j.id);

  let deleted = 0;
  if (ids.length) {
    const { error: de, count } = await sb
      .from('online_judge_votes')
      .delete({ count: 'exact' })
      .in('online_judge_id', ids);
    if (de) return NextResponse.json({ error: de.message }, { status: 500 });
    deleted = count ?? 0;
    // 제출 상태도 해제.
    const { error: ue } = await sb
      .from('online_judges')
      .update({ final_submitted_at: null })
      .eq('contest_id', contestId)
      .not('final_submitted_at', 'is', null);
    if (ue) return NextResponse.json({ error: ue.message }, { status: 500 });
  }

  return NextResponse.json({ data: { deleted } });
}
