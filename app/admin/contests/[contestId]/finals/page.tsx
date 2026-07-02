import { notFound } from 'next/navigation';
import {
  getContest,
  listFinalResults,
  listQualifiers,
  listJudgeVotes,
  listOnlineJudgeVotes,
} from '@/lib/db/queries';
import { resolveActiveDefs } from '@/lib/db/scoring';
import { FinalsPanel, type ScoreBreakdown } from '@/components/admin/FinalsPanel';
import { ContestTabs } from '@/components/admin/ContestTabs';
import { PageHeader } from '@/components/admin/ui';

export const dynamic = 'force-dynamic';

export default async function FinalsPage({
  params,
}: {
  params: Promise<{ contestId: string }>;
}) {
  const { contestId } = await params;
  const contest = await getContest(contestId);
  if (!contest) notFound();
  const [finals, semiQualifiers, panelVotes, onlineVotes] = await Promise.all([
    listFinalResults(contestId),
    listQualifiers(contestId, 'semi'),
    listJudgeVotes(contestId, 'final'),
    listOnlineJudgeVotes(contestId),
  ]);

  // 판정단 / 온라인 / 최종(가중) 점수 — 참가자별 활성 항목 평균 기준으로 산출.
  const cols = resolveActiveDefs(contest.scoring_items).map((d) => d.column);
  const items = Math.max(1, cols.length);
  const wp = Math.max(0, Number(contest.panel_judge_weight) || 0);
  const wo = Math.max(0, Number(contest.online_judge_weight) || 0);
  const usePanel = contest.panel_judges_enabled !== false;
  const useOnline = contest.online_judges_enabled === true;

  const panelAcc = new Map<string, { sum: number; cnt: number }>();
  for (const v of panelVotes) {
    const cur = panelAcc.get(v.participant_num) ?? { sum: 0, cnt: 0 };
    for (const c of cols) { const x = (v as unknown as Record<string, unknown>)[c]; if (x != null && x !== '') { cur.sum += Number(x); cur.cnt++; } }
    panelAcc.set(v.participant_num, cur);
  }
  const onlineAcc = new Map<string, { sum: number; cnt: number }>();
  for (const v of onlineVotes) {
    const cur = onlineAcc.get(v.participant_num) ?? { sum: 0, cnt: 0 };
    for (const c of cols) { const x = (v as unknown as Record<string, number | null>)[c]; if (x != null) { cur.sum += Number(x); cur.cnt++; } }
    onlineAcc.set(v.participant_num, cur);
  }

  const nums = new Set<string>([...panelAcc.keys(), ...onlineAcc.keys(), ...finals.map((f) => f.participant_num)]);
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
      panelTotal: panelAvg == null ? null : panelAvg * items,
      onlineTotal: onlineAvg == null ? null : onlineAvg * items,
      finalTotal: finalAvg == null ? null : finalAvg * items,
    };
  }

  const base = `/admin/contests/${encodeURIComponent(contestId)}`;
  return (
    <>
      <PageHeader
        title={
          <>
            <span className="font-mono text-xs text-ink2 mr-2">{contest.id}</span>
            {contest.name} · Final Results
          </>
        }
      />
      <ContestTabs contestId={contestId} current={`${base}/finals`} />
      <FinalsPanel
        contestId={contestId}
        initial={finals}
        semiQualifiers={semiQualifiers}
        breakdown={breakdown}
        weights={{ panel: wp, online: wo, usePanel, useOnline }}
      />
    </>
  );
}
