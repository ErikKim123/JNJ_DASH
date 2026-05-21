// POST /api/admin/contests/[id]/judging/[round]/commit
//   현재 라운드의 judge_votes 결과를 qualifiers / final_results 에 반영.
//
//   prelim/semi : O 카운트 → qualifiers (역할별 Olympic rank ≤ maxPerRole → passed=true)
//   final       : 활성 항목 점수 합/평균 → final_results (역할별 Olympic rank 부여, podium top 3 우선)
//
// 모두 idempotent — 시작 시 해당 라운드의 target 테이블을 DELETE 후 현재 상태로 INSERT.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/db/client';
import { resolveActiveDefs } from '@/lib/db/scoring';
import type { ScoringItemKey, ContestRow } from '@/lib/db/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const RoundEnum = z.enum(['prelim', 'semi', 'final']);

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
    return NextResponse.json({ error: 'INVALID_ROUND' }, { status: 400 });
  }
  const sb = getSupabaseAdmin();

  // 1) contest 로드 — final 분기에서 scoring_items 도 필요.
  const { data: contest, error: ce } = await sb
    .from('contests')
    .select('prelim_pass_per_role, semi_pass_per_role, scoring_items')
    .eq('id', contestId)
    .maybeSingle();
  if (ce) return NextResponse.json({ error: ce.message }, { status: 500 });
  if (!contest) return NextResponse.json({ error: 'CONTEST_NOT_FOUND' }, { status: 404 });

  // 결승은 별도 로직으로 분기.
  if (r.data === 'final') {
    return commitFinal(sb, contestId, contest as Pick<ContestRow, 'scoring_items'>);
  }

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

  // 5) DELETE → INSERT 로 idempotent commit.
  //    upsert 방식은 votes=0 으로 떨어진 옛 통과자나, 심사위원 수 변경 이전에 저장된 stale votes 가
  //    DB 에 그대로 남는 버그가 있었다 (display 가 5/4명 한도를 초과한 점수를 표시).
  //    매 commit 마다 현재 라운드의 qualifiers 를 깨끗이 비우고 현재 상태로 다시 채운다.
  const rowsToInsert = eligible
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

  const { error: de } = await sb
    .from('qualifiers')
    .delete()
    .eq('contest_id', contestId)
    .eq('round', r.data);
  if (de) return NextResponse.json({ error: de.message }, { status: 500 });

  if (rowsToInsert.length > 0) {
    const { error: ie } = await sb.from('qualifiers').insert(rowsToInsert);
    if (ie) return NextResponse.json({ error: ie.message }, { status: 500 });
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
      total: rowsToInsert.length,
      confirmedLeaders,
      confirmedFollowers,
      maxPerRole,
    },
  });
}

// ─── Final commit ───────────────────────────────────────────────────────
// 결승 매트릭스의 라이브 점수를 final_results 에 그대로 반영.
//   1) 후보 풀: semi qualifiers 중 passed=true 인 리더/팔로워
//   2) 활성 항목(contest.scoring_items) 의 점수 합계/평균 산출 — 모든 final judges 합산
//   3) 역할별 total desc 정렬 → Olympic rank (1, 1, 3, ...)
//   4) final_results DELETE → INSERT (idempotent). 자동 보강 항목:
//        participant_num, team_name, role, photo_url, total_score, average, final_rank
async function commitFinal(
  sb: ReturnType<typeof getSupabaseAdmin>,
  contestId: string,
  contest: Pick<ContestRow, 'scoring_items'>
) {
  // 활성 채점 항목 → 점수 컬럼 목록.
  const activeDefs = resolveActiveDefs((contest.scoring_items ?? []) as ScoringItemKey[]);
  const activeCols = activeDefs.map((d) => d.column);

  // 후보 풀: 본선 통과자 (semi qualifiers, passed=true)
  const { data: qs, error: qe } = await sb
    .from('qualifiers')
    .select('participant_num, team_name, representative, role, photo_url')
    .eq('contest_id', contestId)
    .eq('round', 'semi')
    .eq('passed', true);
  if (qe) return NextResponse.json({ error: qe.message }, { status: 500 });
  const candidates = (qs ?? []).filter((q) => q.role === 'leader' || q.role === 'follower') as Array<{
    participant_num: string; team_name: string; representative: string;
    role: 'leader' | 'follower'; photo_url: string;
  }>;

  // 결승 judges → judge_votes 합산.
  const { data: judges, error: je } = await sb
    .from('judges').select('id').eq('contest_id', contestId).eq('round', 'final');
  if (je) return NextResponse.json({ error: je.message }, { status: 500 });
  const judgeIds = (judges ?? []).map((j) => j.id);

  // 참가자별 sum/cnt — 활성 항목 점수만.
  const totals = new Map<string, { sum: number; cnt: number }>();
  if (judgeIds.length > 0 && activeCols.length > 0) {
    // 명시적으로 컬럼만 SELECT — 컬럼 이름이 dynamic 이라 SQL injection 우려 차단을 위해
    // activeCols 는 SCORING_ITEMS canonical column 목록에서만 나옴 (사용자 입력 아님).
    const cols = ['participant_num', ...activeCols].join(',');
    const { data: votes, error: ve } = await sb
      .from('judge_votes')
      .select(cols)
      .in('judge_id', judgeIds);
    if (ve) return NextResponse.json({ error: ve.message }, { status: 500 });
    for (const v of (votes ?? []) as unknown as Array<Record<string, number | string | null>>) {
      const num = String(v.participant_num ?? '');
      if (!num) continue;
      let s = 0, c = 0;
      for (const col of activeCols) {
        const x = v[col];
        if (x != null && x !== '') { s += Number(x); c++; }
      }
      if (c > 0) {
        const cur = totals.get(num) ?? { sum: 0, cnt: 0 };
        totals.set(num, { sum: cur.sum + s, cnt: cur.cnt + c });
      }
    }
  }

  // 역할별 정렬 + Olympic rank.
  const rankMap = new Map<string, number>(); // participant_num → rank (역할별)
  for (const role of ['leader', 'follower'] as const) {
    const list = candidates
      .filter((c) => c.role === role)
      .map((c) => {
        const t = totals.get(c.participant_num) ?? { sum: 0, cnt: 0 };
        return { num: c.participant_num, total: t.sum, cnt: t.cnt };
      })
      .filter((x) => x.cnt > 0) // 점수 한 칸이라도 입력된 후보만 랭킹 대상
      .sort((a, b) => b.total - a.total || a.num.localeCompare(b.num, undefined, { numeric: true }));
    let lastTotal = Number.POSITIVE_INFINITY;
    let lastRank = 0;
    for (let i = 0; i < list.length; i++) {
      if (list[i].total !== lastTotal) {
        lastRank = i + 1;
        lastTotal = list[i].total;
      }
      rankMap.set(list[i].num, lastRank);
    }
  }

  // INSERT 행 — 모든 후보 포함 (점수 없는 사람도 rank=null 로 보존).
  const rowsToInsert = candidates.map((c) => {
    const t = totals.get(c.participant_num);
    const sum = t?.sum ?? null;
    const cnt = t?.cnt ?? 0;
    const avg = cnt > 0 ? Number((sum! / cnt).toFixed(3)) : null;
    return {
      contest_id: contestId,
      participant_num: c.participant_num,
      team_name: c.team_name,
      role: c.role,
      photo_url: c.photo_url ?? '',
      total_score: sum,
      average: avg,
      final_rank: rankMap.get(c.participant_num) ?? null,
    };
  });

  // DELETE → INSERT (idempotent).
  const { error: de } = await sb.from('final_results').delete().eq('contest_id', contestId);
  if (de) return NextResponse.json({ error: de.message }, { status: 500 });
  if (rowsToInsert.length > 0) {
    const { error: ie } = await sb.from('final_results').insert(rowsToInsert);
    if (ie) return NextResponse.json({ error: ie.message }, { status: 500 });
  }

  // 응답 — podium 카운트.
  const podiumLeaders = rowsToInsert.filter((r) => r.role === 'leader' && r.final_rank != null && r.final_rank <= 3).length;
  const podiumFollowers = rowsToInsert.filter((r) => r.role === 'follower' && r.final_rank != null && r.final_rank <= 3).length;
  return NextResponse.json({
    data: {
      total: rowsToInsert.length,
      confirmedLeaders: podiumLeaders,
      confirmedFollowers: podiumFollowers,
      maxPerRole: 3,
    },
  });
}
