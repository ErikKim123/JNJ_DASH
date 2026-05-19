// GET /api/admin/contests/[id]/export
//   대회 한 개의 모든 관련 row 를 JSON 으로 묶어서 다운로드.
//   포함: contest / participants / judges / judge_votes / pairings / qualifiers / final_results
//   응답 헤더: Content-Disposition = attachment 로 파일 다운로드 트리거.
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db/client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface RouteCtx { params: Promise<{ contestId: string }> }

export async function GET(_req: Request, ctx: RouteCtx) {
  const { contestId } = await ctx.params;
  const sb = getSupabaseAdmin();

  // 1) contest 본체
  const contestRes = await sb.from('contests').select('*').eq('id', contestId).maybeSingle();
  if (contestRes.error) {
    return NextResponse.json({ error: contestRes.error.message }, { status: 500 });
  }
  if (!contestRes.data) {
    return NextResponse.json({ error: 'CONTEST_NOT_FOUND' }, { status: 404 });
  }

  // 2) 자식 테이블들 병렬 조회
  const [participants, judges, pairings, qualifiers, finalResults] = await Promise.all([
    sb.from('participants').select('*').eq('contest_id', contestId),
    sb.from('judges').select('*').eq('contest_id', contestId),
    sb.from('pairings').select('*').eq('contest_id', contestId),
    sb.from('qualifiers').select('*').eq('contest_id', contestId),
    sb.from('final_results').select('*').eq('contest_id', contestId),
  ]);

  for (const r of [participants, judges, pairings, qualifiers, finalResults]) {
    if (r.error) return NextResponse.json({ error: r.error.message }, { status: 500 });
  }

  // 3) judge_votes — contest_id 직접 컬럼 없음 → judges.id 로 필터
  const judgeIds = (judges.data ?? []).map((j) => j.id);
  let judgeVotesData: unknown[] = [];
  if (judgeIds.length > 0) {
    const r = await sb.from('judge_votes').select('*').in('judge_id', judgeIds);
    if (r.error) return NextResponse.json({ error: r.error.message }, { status: 500 });
    judgeVotesData = r.data ?? [];
  }

  const payload = {
    format: 'jnj-dash-backup',
    version: 1,
    exported_at: new Date().toISOString(),
    contest: contestRes.data,
    participants: participants.data ?? [],
    judges: judges.data ?? [],
    judge_votes: judgeVotesData,
    pairings: pairings.data ?? [],
    qualifiers: qualifiers.data ?? [],
    final_results: finalResults.data ?? [],
  };

  const today = new Date().toISOString().slice(0, 10);
  const safeId = contestId.replace(/[^A-Za-z0-9_-]/g, '_');
  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${safeId}-backup-${today}.json"`,
      'Cache-Control': 'no-store',
    },
  });
}
