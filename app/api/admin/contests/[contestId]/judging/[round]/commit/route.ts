// POST /api/admin/contests/[id]/judging/[round]/commit
//   현재 라운드의 judge_votes 결과를 qualifiers 에 반영:
//     1) 각 참가자의 O 카운트 = votes
//     2) role 별 votes desc 정렬 + Olympic rank (1,1,3 ...) — boundary tie 모두 정원 안 포함
//     3) votes > 0 인 모든 후보를 qualifiers 에 upsert (없으면 신규 생성)
//        - rank ≤ maxPerRole → passed=true
//        - 그 외 → passed=false
//     4) 결과 응답: { confirmed: { leaders, followers }, total }
//   prelim/semi 만 지원. final 은 별도 (final_results) 라 commit 불필요.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/db/client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const RoundEnum = z.enum(['prelim', 'semi']);

interface RouteCtx { params: Promise<{ contestId: string; round: string }> }

interface CandidateInfo {
  num: string;
  team_name: string;
  representative: string;
  role: 'leader' | 'follower';
  photo_url: string;
}

export async function POST(_req: Request, ctx: RouteCtx) {
  const { contestId, round } = await ctx.params;
  const r = RoundEnum.safeParse(round);
  if (!r.success) {
    return NextResponse.json({ error: 'COMMIT_ONLY_PRELIM_OR_SEMI' }, { status: 400 });
  }
  const sb = getSupabaseAdmin();

  // 1) maxPerRole
  const { data: contest, error: ce } = await sb
    .from('contests')
    .select('prelim_pass_per_role, semi_pass_per_role')
    .eq('id', contestId)
    .maybeSingle();
  if (ce) return NextResponse.json({ error: ce.message }, { status: 500 });
  if (!contest) return NextResponse.json({ error: 'CONTEST_NOT_FOUND' }, { status: 404 });
  const maxPerRole = r.data === 'prelim' ? contest.prelim_pass_per_role : contest.semi_pass_per_role;

  // 2) judges + votes → O count map
  const { data: judges, error: je } = await sb
    .from('judges').select('id').eq('contest_id', contestId).eq('round', r.data);
  if (je) return NextResponse.json({ error: je.message }, { status: 500 });
  const judgeIds = (judges ?? []).map((j) => j.id);
  const voteCount = new Map<string, number>();
  if (judgeIds.length > 0) {
    const { data: votes, error: ve } = await sb
      .from('judge_votes')
      .select('participant_num, vote_mark')
      .in('judge_id', judgeIds);
    if (ve) return NextResponse.json({ error: ve.message }, { status: 500 });
    for (const v of (votes ?? []) as { participant_num: string; vote_mark: 'O' | 'X' | null }[]) {
      if (v.vote_mark === 'O') {
        voteCount.set(v.participant_num, (voteCount.get(v.participant_num) ?? 0) + 1);
      }
    }
  }

  // 3) Eligible pool — prelim: all leader/follower participants
  //                   semi: prelim qualifiers with passed=true
  let eligible: CandidateInfo[] = [];
  if (r.data === 'prelim') {
    const { data: ps, error: pe } = await sb
      .from('participants')
      .select('num, team_name, representative, role, photo_url')
      .eq('contest_id', contestId);
    if (pe) return NextResponse.json({ error: pe.message }, { status: 500 });
    eligible = (ps ?? [])
      .filter((p) => p.role === 'leader' || p.role === 'follower')
      .map((p) => ({
        num: p.num,
        team_name: p.team_name ?? '',
        representative: p.representative ?? '',
        role: p.role as 'leader' | 'follower',
        photo_url: p.photo_url ?? '',
      }));
  } else {
    const { data: qs, error: qe } = await sb
      .from('qualifiers')
      .select('participant_num, team_name, representative, role, photo_url')
      .eq('contest_id', contestId)
      .eq('round', 'prelim')
      .eq('passed', true);
    if (qe) return NextResponse.json({ error: qe.message }, { status: 500 });
    eligible = (qs ?? [])
      .filter((q) => q.role === 'leader' || q.role === 'follower')
      .map((q) => ({
        num: q.participant_num,
        team_name: q.team_name ?? '',
        representative: q.representative ?? '',
        role: q.role as 'leader' | 'follower',
        photo_url: q.photo_url ?? '',
      }));
  }

  // 4) votes > 0 만 후보 — rank 산정 + passed 결정 (Olympic style: boundary tie 모두 통과)
  const inQuota = new Set<string>(); // `${role}:${num}`
  for (const role of ['leader', 'follower'] as const) {
    const list = eligible
      .filter((e) => e.role === role)
      .map((e) => ({ ...e, votes: voteCount.get(e.num) ?? 0 }))
      .filter((e) => e.votes > 0)
      .sort((a, b) => b.votes - a.votes || a.num.localeCompare(b.num, undefined, { numeric: true }));
    let lastVotes = -1;
    let lastRank = 0;
    for (let i = 0; i < list.length; i++) {
      if (list[i].votes !== lastVotes) {
        lastRank = i + 1;
        lastVotes = list[i].votes;
      }
      if (lastRank <= maxPerRole) inQuota.add(`${role}:${list[i].num}`);
    }
  }

  // 5) upsert qualifiers: votes > 0 후보만 — passed = inQuota
  const rowsToUpsert = eligible
    .filter((e) => (voteCount.get(e.num) ?? 0) > 0)
    .map((e) => ({
      contest_id: contestId,
      round: r.data,
      participant_num: e.num,
      team_name: e.team_name,
      representative: e.representative,
      role: e.role,
      photo_url: e.photo_url,
      passed: inQuota.has(`${e.role}:${e.num}`),
      votes: voteCount.get(e.num) ?? 0,
      display_order: 0,
    }));

  if (rowsToUpsert.length > 0) {
    const { error: ue } = await sb
      .from('qualifiers')
      .upsert(rowsToUpsert, { onConflict: 'contest_id,round,participant_num' });
    if (ue) return NextResponse.json({ error: ue.message }, { status: 500 });
  }

  // 6) 응답 — passed 카운트 (in-quota set 으로 계산)
  let confirmedLeaders = 0;
  let confirmedFollowers = 0;
  for (const key of inQuota) {
    if (key.startsWith('leader:')) confirmedLeaders++;
    else if (key.startsWith('follower:')) confirmedFollowers++;
  }

  return NextResponse.json({
    data: {
      total: rowsToUpsert.length,
      confirmedLeaders,
      confirmedFollowers,
      maxPerRole,
    },
  });
}
