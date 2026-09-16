// 결승 '최종(가중)' 점수 — 판정단·관객 평균을 가중 결합한 값.
//
// 이 값이 두 곳에서 따로 계산되고 있었다.
//   · 관리 화면(결승 결과 탭)  : judge_votes 를 매번 다시 읽어 산출 — 화면에 보이는 값
//   · Wolf 게시                : final_results.average × 항목 수 — 확정 시점의 스냅샷
// 확정한 뒤 심사 점수를 한 칸이라도 고치면 둘이 어긋난다. 실제로 어긋났다:
// 같은 참가자가 화면에서는 27.80, 고객몰로는 28.60 으로 나갔다.
//
// 그래서 계산을 여기 하나로 모은다. 화면이 보여 준 숫자가 곧 게시되는 숫자여야 한다 —
// 운영자는 화면을 보고 확정을 누르기 때문이다.
import { listJudgeVotes, listOnlineJudgeVotes, listFinalResults, getContest } from '@/lib/db/queries';
import { resolveActiveDefs } from '@/lib/db/scoring';

/** 참가자별 판정단 / 관객 / 최종(가중) 점수 — avg(0-10) + total(avg × 항목 수). */
export interface ScoreBreakdown {
  panelAvg: number | null;
  onlineAvg: number | null;
  finalAvg: number | null;
  panelTotal: number | null;
  onlineTotal: number | null;
  finalTotal: number | null;
}

export interface FinalScores {
  /** 참가번호 → 산출값. 채점 기록이 없는 참가자는 값이 전부 null 이다. */
  breakdown: Record<string, ScoreBreakdown>;
  /** 활성 채점 항목 수 — total = avg × 이 값. */
  itemCount: number;
}

/**
 * 결승 점수 산출.
 *
 * 관객 심사(online)는 대회 설정에서 켠 경우에만 섞는다. 한쪽만 기록이 있으면 그쪽 값을
 * 그대로 쓴다 — 없는 쪽을 0 으로 치면 관객 심사를 안 한 대회의 점수가 통째로 반토막 난다.
 */
export async function computeFinalScores(contestId: string): Promise<FinalScores> {
  const contest = await getContest(contestId);
  if (!contest) return { breakdown: {}, itemCount: 1 };

  const [finals, panelVotes, onlineVotes] = await Promise.all([
    listFinalResults(contestId),
    listJudgeVotes(contestId, 'final'),
    listOnlineJudgeVotes(contestId),
  ]);

  const cols = resolveActiveDefs(contest.scoring_items).map((d) => d.column);
  const itemCount = Math.max(1, cols.length);
  const wp = Math.max(0, Number(contest.panel_judge_weight) || 0);
  const wo = Math.max(0, Number(contest.online_judge_weight) || 0);
  const usePanel = contest.panel_judges_enabled !== false;
  const useOnline = contest.online_judges_enabled === true;

  const panelAcc = new Map<string, { sum: number; cnt: number }>();
  for (const v of panelVotes) {
    const cur = panelAcc.get(v.participant_num) ?? { sum: 0, cnt: 0 };
    for (const c of cols) {
      const x = (v as unknown as Record<string, unknown>)[c];
      if (x != null && x !== '') { cur.sum += Number(x); cur.cnt++; }
    }
    panelAcc.set(v.participant_num, cur);
  }
  const onlineAcc = new Map<string, { sum: number; cnt: number }>();
  for (const v of onlineVotes) {
    const cur = onlineAcc.get(v.participant_num) ?? { sum: 0, cnt: 0 };
    for (const c of cols) {
      const x = (v as unknown as Record<string, number | null>)[c];
      if (x != null) { cur.sum += Number(x); cur.cnt++; }
    }
    onlineAcc.set(v.participant_num, cur);
  }

  const nums = new Set<string>([
    ...panelAcc.keys(),
    ...onlineAcc.keys(),
    ...finals.map((f) => f.participant_num),
  ]);

  const breakdown: Record<string, ScoreBreakdown> = {};
  for (const num of nums) {
    const p = panelAcc.get(num);
    const o = onlineAcc.get(num);
    const panelAvg = usePanel && p && p.cnt > 0 ? p.sum / p.cnt : null;
    const onlineAvg = useOnline && o && o.cnt > 0 ? o.sum / o.cnt : null;
    let finalAvg: number | null;
    if (panelAvg != null && onlineAvg != null) {
      const w = wp + wo;
      finalAvg = w > 0 ? (panelAvg * wp + onlineAvg * wo) / w : (panelAvg + onlineAvg) / 2;
    } else {
      finalAvg = panelAvg ?? onlineAvg;
    }
    breakdown[num] = {
      panelAvg, onlineAvg, finalAvg,
      panelTotal: panelAvg == null ? null : panelAvg * itemCount,
      onlineTotal: onlineAvg == null ? null : onlineAvg * itemCount,
      finalTotal: finalAvg == null ? null : finalAvg * itemCount,
    };
  }

  return { breakdown, itemCount };
}

/**
 * 외부(고객몰)로 내보낼 점수 한 쌍 — 총점·평균.
 *
 * 채점 기록이 있으면 화면과 같은 산출값을 쓰고, 없으면 final_results 에 저장된 값으로
 * 폴백한다. 운영자가 손으로 넣은 결과(+ Add Manually)는 judge_votes 가 아예 없어서,
 * 산출값만 고집하면 점수가 빈 칸으로 나간다.
 */
export function exportScore(
  b: ScoreBreakdown | undefined,
  stored: { total_score: number | null; average: number | null },
  itemCount: number,
): { totalScore: number | null; avgScore: number | null } {
  if (b && b.finalAvg != null) {
    return {
      totalScore: Number((b.finalAvg * itemCount).toFixed(2)),
      avgScore: Number(b.finalAvg.toFixed(2)),
    };
  }
  const avg = stored.average != null ? Number(Number(stored.average).toFixed(2)) : null;
  // 저장값만 있을 때도 '항목 평균 × 항목 수' 로 맞춘다 — total_score 원본은 심사위원 수만큼
  // 부풀어 있어(같은 9점대가 148 이 되기도 372 가 되기도 한다) 화면 숫자와 자릿수가 다르다.
  const total = avg != null ? Number((avg * itemCount).toFixed(2)) : stored.total_score;
  return { totalScore: total, avgScore: avg };
}
