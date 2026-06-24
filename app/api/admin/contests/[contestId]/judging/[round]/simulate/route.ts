// POST /api/admin/contests/[contestId]/judging/[round]/simulate
//   테스트/시연용 — 경계 동점(boundary tie)이 역할별 tieCount 명 나오도록 judge_votes 를 생성.
//   prep 단계에서만 노출되는 시뮬레이션 버튼이 호출. 기존 해당 라운드 votes 를 모두 교체.
//
//   생성 규칙(역할별):
//     상위 (정원-1) 명 → 동점 점수보다 높은 O 수 (확실히 통과)
//     그 다음 tieCount 명 → 같은 O 수(동점 점수) — 마지막 1자리를 두고 경계 동점
//     나머지 → 동점 점수보다 낮은 O 수 (탈락)
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/db/client';
import { resolveActiveDefs, type ScoringItemKey } from '@/lib/db/scoring';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// 역할별 동점자 수(tieLeader/tieFollower) 우선, 없으면 tieCount 를 양쪽에 적용.
// 0~1 이면 그 역할은 강제 동점 없이 랜덤 부여.
const Body = z.object({
  tieCount: z.number().int().min(0).max(200).optional(),
  tieLeader: z.number().int().min(0).max(200).optional(),
  tieFollower: z.number().int().min(0).max(200).optional(),
});

interface RouteCtx { params: Promise<{ contestId: string; round: string }> }

export async function POST(req: Request, ctx: RouteCtx) {
  const { contestId, round } = await ctx.params;
  if (round !== 'prelim' && round !== 'semi' && round !== 'final') {
    return NextResponse.json({ error: 'ROUND_NOT_SUPPORTED' }, { status: 400 });
  }
  const body = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'VALIDATION', issues: parsed.error.issues }, { status: 400 });
  const tieFor = (role: 'leader' | 'follower'): number => {
    const v = role === 'leader' ? parsed.data.tieLeader : parsed.data.tieFollower;
    return v ?? parsed.data.tieCount ?? 3;
  };

  const sb = getSupabaseAdmin();

  const { data: contest } = await sb
    .from('contests')
    .select('prelim_pass_per_role, semi_pass_per_role, scoring_items')
    .eq('id', contestId)
    .maybeSingle();
  if (!contest) return NextResponse.json({ error: 'CONTEST_NOT_FOUND' }, { status: 404 });

  const { data: judges } = await sb
    .from('judges').select('id').eq('contest_id', contestId).eq('round', round).order('display_order', { ascending: true });
  const judgeIds = (judges ?? []).map((j) => j.id);
  if (judgeIds.length === 0) return NextResponse.json({ error: 'NO_JUDGES' }, { status: 400 });
  const J = judgeIds.length;

  // ── 결승(final) — 점수제. 활성 항목별 점수를 생성해 시상(top3) 경계 동점을 만든다. ──
  if (round === 'final') {
    const activeCols = resolveActiveDefs((contest.scoring_items ?? []) as ScoringItemKey[]).map((d) => d.column);
    const { data: qs } = await sb.from('qualifiers').select('participant_num, role')
      .eq('contest_id', contestId).eq('round', 'semi').eq('passed', true);
    const finalists = (qs ?? []).filter((q) => q.role === 'leader' || q.role === 'follower')
      .map((q) => ({ num: q.participant_num as string, role: q.role as 'leader' | 'follower' }));
    if (finalists.length === 0) return NextResponse.json({ error: 'NO_FINALISTS' }, { status: 400 });

    const PODIUM = 3;
    const base = 8; // 시상 경계(3위) 기준 점수
    // 결승 진출자별 항목 점수값(모든 심사위원 동일) → 합계 순위. 시상 경계 동점 tieCount 명.
    const cellByNum = new Map<string, number>();
    for (const role of ['leader', 'follower'] as const) {
      const list = finalists.filter((f) => f.role === role);
      for (let i = list.length - 1; i > 0; i--) {
        const k = Math.floor(Math.random() * (i + 1));
        [list[i], list[k]] = [list[k], list[i]];
      }
      const E = list.length;
      const reqTie = tieFor(role);
      if (E <= PODIUM || reqTie < 2) {
        // 시상 이하이거나 동점 미요청 — 내림차순 distinct 점수.
        list.forEach((f, idx) => cellByNum.set(f.num, Math.max(1, base + 2 - idx)));
        continue;
      }
      const aboveCount = PODIUM - 1;                              // 1·2위 확실
      const T = Math.max(2, Math.min(reqTie, E - aboveCount));
      list.forEach((f, idx) => {
        let val: number;
        if (idx < aboveCount) val = base + (aboveCount - idx);    // 1위 base+2, 2위 base+1
        else if (idx < aboveCount + T) val = base;               // 시상 경계 동점
        else val = Math.max(1, base - 1 - (idx - aboveCount - T)); // 그 이하
        cellByNum.set(f.num, val);
      });
    }

    const rows = finalists.flatMap((f) => {
      const val = cellByNum.get(f.num) ?? 1;
      const scoreObj: Record<string, number> = {};
      for (const col of activeCols) scoreObj[col] = val;
      return judgeIds.map((jid) => ({ judge_id: jid, participant_num: f.num, vote_mark: null, ...scoreObj }));
    });

    const { error: delErr } = await sb.from('judge_votes').delete().in('judge_id', judgeIds);
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
    // 새 점수로 기존 결승 결과 확정은 무효.
    await sb.from('final_results').delete().eq('contest_id', contestId);
    const CHUNK_F = 500;
    for (let i = 0; i < rows.length; i += CHUNK_F) {
      const { error } = await sb.from('judge_votes').insert(rows.slice(i, i + CHUNK_F));
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({
      data: { judges: J, finalists: finalists.length, votes: rows.length, tieLeader: tieFor('leader'), tieFollower: tieFor('follower') },
    });
  }

  const maxPerRole = round === 'prelim' ? contest.prelim_pass_per_role : contest.semi_pass_per_role;

  // 후보 풀 — prelim: 모든 leader/follower 참가자, semi: prelim 통과자.
  let pool: { num: string; role: 'leader' | 'follower' }[] = [];
  if (round === 'prelim') {
    const { data: ps } = await sb.from('participants').select('num, role').eq('contest_id', contestId);
    pool = (ps ?? []).filter((p) => p.role === 'leader' || p.role === 'follower')
      .map((p) => ({ num: p.num as string, role: p.role as 'leader' | 'follower' }));
  } else {
    const { data: qs } = await sb.from('qualifiers').select('participant_num, role')
      .eq('contest_id', contestId).eq('round', 'prelim').eq('passed', true);
    pool = (qs ?? []).filter((q) => q.role === 'leader' || q.role === 'follower')
      .map((q) => ({ num: q.participant_num as string, role: q.role as 'leader' | 'follower' }));
  }
  if (pool.length === 0) return NextResponse.json({ error: 'NO_CANDIDATES' }, { status: 400 });

  const clampO = (n: number) => Math.max(0, Math.min(J, Math.round(n)));

  // 역할별 목표 O 수 산정 → 경계 동점 tieCount 명.
  //   "모든 심사위원이 정원(M)만큼 O 를 준다" 를 기준으로 역할별 총 O = J*M (budget) 에 정확히 맞춘다.
  //   동점 점수 c = floor(budget/E). 상위(M-1) = c+1(이상), 동점 T = 정확히 c, 나머지 = c-1(이하).
  //   합계를 budget 에 맞추기 위해 below(↓0) / above(↑J) 만 가감 — 동점(c)은 불변 → 경계 동점 보존.
  const oCountByNum = new Map<string, number>();
  for (const role of ['leader', 'follower'] as const) {
    const list = pool.filter((p) => p.role === role);
    for (let i = list.length - 1; i > 0; i--) {
      const k = Math.floor(Math.random() * (i + 1));
      [list[i], list[k]] = [list[k], list[i]];
    }
    const E = list.length;
    const M = Math.max(1, maxPerRole);
    const reqTie = tieFor(role);
    const budget = J * M;

    if (E <= M || reqTie < 2) {
      // 정원 이하이거나 동점 미요청 — 평균으로 균등 (합계 = budget, 심사위원당 정확히 M).
      const base = Math.floor(budget / E);
      const rem = budget - base * E;
      list.forEach((p, i) => oCountByNum.set(p.num, clampO(base + (i < rem ? 1 : 0))));
      continue;
    }

    const c = Math.max(2, Math.min(J - 1, Math.floor(budget / E)));
    const aboveCount = Math.min(M - 1, E - 2);
    const T = Math.max(2, Math.min(reqTie, E - aboveCount));
    const arr = list.map((p, idx) => {
      if (idx < aboveCount) return { num: p.num, o: Math.min(J, c + 1), band: 'above' as const };
      if (idx < aboveCount + T) return { num: p.num, o: c, band: 'tie' as const };
      return { num: p.num, o: Math.max(0, c - 1), band: 'below' as const };
    });
    let sum = arr.reduce((s, x) => s + x.o, 0);
    const belowIdx = arr.flatMap((x, i) => (x.band === 'below' ? [i] : []));
    const aboveIdx = arr.flatMap((x, i) => (x.band === 'above' ? [i] : []));
    // 초과 → below 를 0 까지 내림. 부족 → above 를 J 까지 올림. (동점 c 불변)
    let guard = E * J + 10;
    while (sum > budget && guard-- > 0) {
      let moved = false;
      for (const i of belowIdx) { if (sum <= budget) break; if (arr[i].o > 0) { arr[i].o--; sum--; moved = true; } }
      if (!moved) break;
    }
    guard = E * J + 10;
    while (sum < budget && guard-- > 0) {
      let moved = false;
      for (const i of aboveIdx) { if (sum >= budget) break; if (arr[i].o < J) { arr[i].o++; sum++; moved = true; } }
      if (!moved) break;
    }
    arr.forEach((x) => oCountByNum.set(x.num, x.o));
  }

  // 풀 매트릭스 votes(O/X) 생성 — 각 참가자의 O 를 "가장 적게 투표한 심사위원"부터 배정하되
  // 정원(M)에 도달한 심사위원은 제외해 정원 초과를 막는다. 역할별로 별도 load.
  // → 모든 심사위원이 역할별로 정확히 M 표(정원만큼) 를 주게 된다.
  const oAssign = new Map<string, Set<number>>();
  for (const role of ['leader', 'follower'] as const) {
    const M = Math.max(1, maxPerRole);
    const roleList = pool
      .filter((p) => p.role === role)
      .sort((a, b) => (oCountByNum.get(b.num) ?? 0) - (oCountByNum.get(a.num) ?? 0));
    const load = new Array(J).fill(0);
    for (const p of roleList) {
      const oc = clampO(oCountByNum.get(p.num) ?? 0);
      const all = Array.from({ length: J }, (_, j) => j).sort((a, b) => load[a] - load[b]);
      const underCap = all.filter((j) => load[j] < M);
      const chosen = (underCap.length >= oc ? underCap : all).slice(0, oc);
      oAssign.set(p.num, new Set(chosen));
      for (const j of chosen) load[j]++;
    }
  }

  const rows: { judge_id: string; participant_num: string; vote_mark: 'O' | 'X' }[] = [];
  pool.forEach((p) => {
    const oset = oAssign.get(p.num) ?? new Set<number>();
    judgeIds.forEach((jid, jIdx) => {
      rows.push({ judge_id: jid, participant_num: p.num, vote_mark: oset.has(jIdx) ? 'O' : 'X' });
    });
  });

  // 기존 votes 교체.
  const { error: delErr } = await sb.from('judge_votes').delete().in('judge_id', judgeIds);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
  // 새 투표로 기존 통과자 확정은 무효 — 해당 라운드 qualifiers 도 비워 재확정을 유도.
  await sb.from('qualifiers').delete().eq('contest_id', contestId).eq('round', round);
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await sb.from('judge_votes').insert(rows.slice(i, i + CHUNK));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    data: {
      judges: J,
      participants: pool.length,
      votes: rows.length,
      tieLeader: tieFor('leader'),
      tieFollower: tieFor('follower'),
    },
  });
}
