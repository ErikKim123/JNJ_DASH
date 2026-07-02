// GET /api/ovote/[contestId]/state?judgeId=...
//   온라인 심사위원 앱의 라운드/결승 화면 데이터.
//   반환: 대회 라운드 설정(online_judge_rounds, final_status, 사용여부) +
//         결승 진출자 목록 + 활성 채점 항목 + 이 심사위원의 기존 점수.
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db/client';
import { getContest } from '@/lib/db/queries';
import { resolveActiveDefs } from '@/lib/db/scoring';
import { fullName } from '@/lib/participants/name';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface RouteCtx { params: Promise<{ contestId: string }> }

function normalizePhoto(url: string): string {
  const m1 = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m1) return `https://lh3.googleusercontent.com/d/${m1[1]}=w400`;
  const m2 = url.match(/drive\.google\.com\/(?:open|uc|thumbnail)\?(?:[^#]*&)?id=([a-zA-Z0-9_-]+)/);
  if (m2) return `https://lh3.googleusercontent.com/d/${m2[1]}=w400`;
  return url;
}

export async function GET(req: Request, ctx: RouteCtx) {
  const { contestId } = await ctx.params;
  const url = new URL(req.url);
  const judgeId = url.searchParams.get('judgeId') || '';

  const contest = await getContest(contestId);
  if (!contest) return NextResponse.json({ error: 'CONTEST_NOT_FOUND' }, { status: 404 });

  const sb = getSupabaseAdmin();

  // judgeId 검증 (해당 대회 소속인지) + 제출 상태.
  let submittedAt: string | null = null;
  if (judgeId) {
    const { data: j } = await sb
      .from('online_judges').select('id, final_submitted_at').eq('id', judgeId).eq('contest_id', contestId).maybeSingle();
    if (!j) return NextResponse.json({ error: 'JUDGE_NOT_IN_CONTEST' }, { status: 401 });
    submittedAt = (j.final_submitted_at as string | null) ?? null;
  }

  // 결승 진출자 = 본선(semi) 통과자.
  const { data: qual, error: qe } = await sb
    .from('qualifiers')
    .select('participant_num, team_name, representative, role, photo_url, passed')
    .eq('contest_id', contestId)
    .eq('round', 'semi')
    .eq('passed', true);
  if (qe) return NextResponse.json({ error: qe.message }, { status: 500 });

  // 진출자 사진 폴백을 위해 participants 사진도 함께 조회.
  const nums = (qual ?? []).map((q) => q.participant_num);
  const photoByNum = new Map<string, string>();
  if (nums.length) {
    const { data: parts } = await sb
      .from('participants')
      .select('num, photo_url, meta')
      .eq('contest_id', contestId)
      .in('num', nums);
    for (const p of parts ?? []) {
      const raw = (p.photo_url && p.photo_url.trim())
        || ((p.meta as Record<string, unknown> | null)?.['사진원본'] as string | undefined)
        || '';
      if (raw) photoByNum.set(p.num, raw);
    }
  }

  const finalists = (qual ?? [])
    .filter((q) => q.role === 'leader' || q.role === 'follower')
    .map((q) => {
      const raw = (q.photo_url && q.photo_url.trim()) || photoByNum.get(q.participant_num) || '';
      return {
        num: q.participant_num,
        name: q.team_name ?? '',
        role: q.role as 'leader' | 'follower',
        photoUrl: raw ? normalizePhoto(raw) : '',
      };
    })
    .sort((a, b) => a.num.localeCompare(b.num, undefined, { numeric: true }));

  // 이 심사위원의 기존 점수.
  const defs = resolveActiveDefs(contest.scoring_items);
  const myVotes: Record<string, Record<string, number | null>> = {};
  if (judgeId) {
    const { data: votes } = await sb
      .from('online_judge_votes')
      .select('*')
      .eq('online_judge_id', judgeId);
    for (const v of votes ?? []) {
      const row: Record<string, number | null> = {};
      for (const d of defs) row[d.column] = (v as Record<string, number | null>)[d.column] ?? null;
      myVotes[v.participant_num as string] = row;
    }
  }

  const rounds = Array.isArray(contest.online_judge_rounds) ? contest.online_judge_rounds : [];
  return NextResponse.json({
    data: {
      contestName: contest.name,
      onlineEnabled: contest.online_judges_enabled,
      onlineRounds: rounds,
      roundStatus: {
        prelim: contest.prelim_status,
        semi: contest.semi_status,
        final: contest.final_status,
      },
      scoringItems: defs.map((d) => ({ key: d.key, label: d.label, column: d.column })),
      finalists,
      myVotes,
      submittedAt,
    },
  });
}
