// POST /api/admin/contests/[id]/online-final-judging/commit
//   결승 결과 확정 — 판정단(judges) + 온라인 심사위원(online_judges) 점수를 가중 결합해 final_results 에 반영.
//     결합식(평균 가중 합산): combined = (panelAvg×wp + onlineAvg×wo) / (wp+wo)
//       · 한쪽만 사용/데이터 있으면 그 평균이 곧 combined.
//       · panelAvg/onlineAvg = 각 그룹의 활성 항목 점수 평균(0–10 스케일).
//   body:
//     { dryRun:true }             → 쓰지 않고 역할별 순위 + 시상(top3) 경계 동점 그룹만 반환(동점 추려내기 모달용).
//     { tieExclude?: string[] }   → 경계 동점에서 탈락시킬 participant_num (선택자 우선 → 미선택 하위).
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db/client';
import { selectJudgeVotesAll, listOnlineJudgeVotes } from '@/lib/db/queries';
import { resolveActiveDefs } from '@/lib/db/scoring';
import type { ScoringItemKey } from '@/lib/db/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PODIUM = 3;

interface RouteCtx { params: Promise<{ contestId: string }> }

export async function POST(req: Request, ctx: RouteCtx) {
  const { contestId } = await ctx.params;

  let dryRun = false;
  let tieExclude = new Set<string>();
  try {
    const body = await req.json().catch(() => null);
    if (body?.dryRun === true) dryRun = true;
    const arr = body && Array.isArray(body.tieExclude) ? body.tieExclude : [];
    tieExclude = new Set(arr.filter((x: unknown): x is string => typeof x === 'string'));
  } catch { /* no body */ }

  const sb = getSupabaseAdmin();

  const { data: contest, error: ce } = await sb
    .from('contests')
    .select('scoring_items, panel_judges_enabled, online_judges_enabled, panel_judge_weight, online_judge_weight')
    .eq('id', contestId)
    .maybeSingle();
  if (ce) return NextResponse.json({ error: ce.message }, { status: 500 });
  if (!contest) return NextResponse.json({ error: 'CONTEST_NOT_FOUND' }, { status: 404 });

  const activeCols = resolveActiveDefs((contest.scoring_items ?? []) as ScoringItemKey[]).map((d) => d.column);
  const wp = Math.max(0, Number(contest.panel_judge_weight) || 0);
  const wo = Math.max(0, Number(contest.online_judge_weight) || 0);
  const usePanel = contest.panel_judges_enabled !== false;
  const useOnline = contest.online_judges_enabled === true;

  // 후보: 본선 통과자.
  const { data: qs, error: qe } = await sb
    .from('qualifiers')
    .select('participant_num, team_name, role, photo_url')
    .eq('contest_id', contestId)
    .eq('round', 'semi')
    .eq('passed', true);
  if (qe) return NextResponse.json({ error: qe.message }, { status: 500 });
  const candidates = (qs ?? []).filter((q) => q.role === 'leader' || q.role === 'follower') as Array<{
    participant_num: string; team_name: string; role: 'leader' | 'follower'; photo_url: string;
  }>;

  // 판정단 항목 평균 (num → {sum,cnt}).
  const panel = new Map<string, { sum: number; cnt: number }>();
  if (usePanel && activeCols.length > 0) {
    const { data: judges } = await sb.from('judges').select('id').eq('contest_id', contestId).eq('round', 'final');
    const ids = (judges ?? []).map((j) => j.id);
    if (ids.length > 0) {
      const votes = await selectJudgeVotesAll(sb, ids, ['participant_num', ...activeCols].join(','));
      for (const v of votes as unknown as Array<Record<string, number | string | null>>) {
        const num = String(v.participant_num ?? ''); if (!num) continue;
        const cur = panel.get(num) ?? { sum: 0, cnt: 0 };
        for (const c of activeCols) { const x = v[c]; if (x != null && x !== '') { cur.sum += Number(x); cur.cnt++; } }
        panel.set(num, cur);
      }
    }
  }

  // 온라인 항목 평균 (num → {sum,cnt}).
  const online = new Map<string, { sum: number; cnt: number }>();
  if (useOnline && activeCols.length > 0) {
    const votes = await listOnlineJudgeVotes(contestId);
    for (const v of votes) {
      const num = v.participant_num;
      const cur = online.get(num) ?? { sum: 0, cnt: 0 };
      for (const c of activeCols) { const x = (v as unknown as Record<string, number | null>)[c]; if (x != null) { cur.sum += Number(x); cur.cnt++; } }
      online.set(num, cur);
    }
  }

  // 결합 점수 (num → combined | null).
  function combinedOf(num: string): number | null {
    const p = panel.get(num); const o = online.get(num);
    const pAvg = usePanel && p && p.cnt > 0 ? p.sum / p.cnt : null;
    const oAvg = useOnline && o && o.cnt > 0 ? o.sum / o.cnt : null;
    if (pAvg != null && oAvg != null) {
      const w = wp + wo;
      return w > 0 ? (pAvg * wp + oAvg * wo) / w : (pAvg + oAvg) / 2;
    }
    return pAvg ?? oAvg;
  }

  const activeCount = activeCols.length || 1;
  const isEx = (num: string) => (tieExclude.has(num) ? 1 : 0);

  // 역할별 순위 산정.
  type Row = { num: string; name: string; combined: number | null; rank: number | null };
  const byRole: Record<'leader' | 'follower', Row[]> = { leader: [], follower: [] };
  for (const role of ['leader', 'follower'] as const) {
    const list = candidates
      .filter((c) => c.role === role)
      .map((c) => ({ num: c.participant_num, name: c.team_name, combined: combinedOf(c.participant_num) }))
      .filter((x) => x.combined != null) as Array<{ num: string; name: string; combined: number }>;
    list.sort((a, b) =>
      b.combined - a.combined ||
      isEx(a.num) - isEx(b.num) ||
      a.num.localeCompare(b.num, undefined, { numeric: true }),
    );
    let lastKey: string | null = null; let lastRank = 0;
    const rows: Row[] = list.map((x, i) => {
      const key = `${x.combined.toFixed(4)}:${isEx(x.num)}`;
      if (key !== lastKey) { lastRank = i + 1; lastKey = key; }
      return { num: x.num, name: x.name, combined: x.combined, rank: lastRank };
    });
    byRole[role] = rows;
  }

  // 시상(top3) 경계 동점 그룹 — dryRun 모달용.
  function tieGroup(role: 'leader' | 'follower') {
    const rows = byRole[role];
    if (rows.length <= PODIUM) return null;
    const cut = rows[PODIUM - 1].combined!;
    const next = rows[PODIUM].combined!;
    if (cut == null || cut !== next) return null;
    const tied = rows.filter((r) => r.combined === cut);
    const above = rows.filter((r) => (r.combined ?? -Infinity) > cut).length;
    return {
      role,
      tieScore: Number(cut.toFixed(2)),
      slots: Math.max(0, PODIUM - above),
      candidates: tied.map((t) => ({ num: t.num, name: t.name })),
    };
  }

  if (dryRun) {
    return NextResponse.json({
      data: {
        dryRun: true,
        groups: [tieGroup('leader'), tieGroup('follower')].filter(Boolean),
        ranking: byRole,
      },
    });
  }

  // final_results DELETE → INSERT.
  const rankMap = new Map<string, number>();
  for (const role of ['leader', 'follower'] as const) for (const r of byRole[role]) if (r.rank != null) rankMap.set(r.num, r.rank);

  const rows = candidates.map((c) => {
    const combined = combinedOf(c.participant_num);
    return {
      contest_id: contestId,
      participant_num: c.participant_num,
      team_name: c.team_name,
      role: c.role,
      photo_url: c.photo_url ?? '',
      total_score: combined == null ? null : Number((combined * activeCount).toFixed(3)),
      average: combined == null ? null : Number(combined.toFixed(3)),
      final_rank: rankMap.get(c.participant_num) ?? null,
    };
  });

  const { error: de } = await sb.from('final_results').delete().eq('contest_id', contestId);
  if (de) return NextResponse.json({ error: de.message }, { status: 500 });
  if (rows.length > 0) {
    const { error: ie } = await sb.from('final_results').insert(rows);
    if (ie) return NextResponse.json({ error: ie.message }, { status: 500 });
  }

  const podiumLeaders = rows.filter((r) => r.role === 'leader' && r.final_rank != null && r.final_rank <= PODIUM).length;
  const podiumFollowers = rows.filter((r) => r.role === 'follower' && r.final_rank != null && r.final_rank <= PODIUM).length;
  return NextResponse.json({
    data: { total: rows.length, confirmedLeaders: podiumLeaders, confirmedFollowers: podiumFollowers, usedPanel: usePanel, usedOnline: useOnline },
  });
}
