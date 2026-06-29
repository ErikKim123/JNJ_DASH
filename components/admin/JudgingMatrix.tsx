'use client';

// Judging matrix — participants (rows) × judges (cols).
//   prelim / semi : O/X cell toggle (click cycles  ·  → O → X → ·)
//   final         : 3 numeric inputs per cell (basic / connectivity / musicality)
// Eligibility:
//   prelim : every leader / follower in the contest
//   semi   : prelim qualifiers with passed=true
//   final  : semi qualifiers with passed=true
import { useMemo, useState, useTransition, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button, Input } from './ui';
import type {
  JudgeRow,
  JudgeVoteRow,
  ParticipantRow,
  QualifierRow,
  JudgingRound,
  VoteMark,
  RoundStatus,
} from '@/lib/db/types';
import {
  resolveActiveDefs,
  aggregateScores,
  type ScoringItemKey,
  type ScoringItemDef,
} from '@/lib/db/scoring';
import { useT } from '@/lib/i18n/LocaleContext';

interface Eligible {
  num: string;
  team_name: string;
  role: 'leader' | 'follower';
  isHelper: boolean;
}

export function JudgingMatrix({
  contestId,
  round,
  judges: initialJudges,
  votes: initialVotes,
  participants,
  prelimQualifiers,
  semiQualifiers,
  maxPerRole,
  scoringItems,
  initialConfirmed,
  roundStatus,
}: {
  contestId: string;
  round: JudgingRound;
  judges: JudgeRow[];
  votes: JudgeVoteRow[];
  participants: ParticipantRow[];
  prelimQualifiers: QualifierRow[];
  semiQualifiers: QualifierRow[];
  /** 통과 정원 (역할별). final 라운드는 3 고정. */
  maxPerRole: number;
  /** 결승 활성 채점 항목 키. final 라운드에서만 사용. */
  scoringItems?: readonly ScoringItemKey[];
  /** Qualifiers 테이블에 이미 확정(passed=true)된 인원. prelim/semi 에서만 의미. */
  initialConfirmed?: { leaders: number; followers: number };
  /** 이 라운드의 진행 상태 — 'prep' 일 때만 시뮬레이션 버튼 노출. */
  roundStatus?: RoundStatus;
}) {
  const router = useRouter();
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [judges, setJudges] = useState<JudgeRow[]>(initialJudges);
  const [votes, setVotes] = useState<JudgeVoteRow[]>(initialVotes);
  const [newJudgeName, setNewJudgeName] = useState('');
  const [confirmed, setConfirmed] = useState<{ leaders: number; followers: number }>(
    initialConfirmed ?? { leaders: 0, followers: 0 }
  );
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [uncommitModalOpen, setUncommitModalOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  // 동점 추려내기 모달 — 경계 동점 그룹에서 올릴 사람 선택.
  const [tieModalOpen, setTieModalOpen] = useState(false);
  const [tiePick, setTiePick] = useState<Record<string, boolean>>({});
  // 시뮬레이션 모달 — prep 단계에서 리더/팔로워 동점자 수를 각각 정해 자동 투표.
  const [simModalOpen, setSimModalOpen] = useState(false);
  const [simTieLeader, setSimTieLeader] = useState(3);
  const [simTieFollower, setSimTieFollower] = useState(3);
  const [simBusy, setSimBusy] = useState(false);

  const apiBase = `/api/admin/contests/${encodeURIComponent(contestId)}/judging/${round}`;
  // judges 추가/수정/삭제는 3 라운드 mirror 가 적용된 통합 엔드포인트 사용.
  const judgesApiBase = `/api/admin/contests/${encodeURIComponent(contestId)}/judges`;
  const roundLabel = round === 'prelim' ? t('round.prelim') : round === 'semi' ? t('round.semi') : t('round.final');
  const isFinal = round === 'final';
  const L = t('matrix.leaderShort');
  const F = t('matrix.followerShort');

  // 활성 채점 항목 — final 라운드에서만 의미.
  const activeDefs: ScoringItemDef[] = useMemo(() => resolveActiveDefs(scoringItems), [scoringItems]);
  const activeKeys: readonly ScoringItemKey[] = useMemo(() => activeDefs.map((d) => d.key), [activeDefs]);

  // Eligible participants for this round
  // prelim 은 helper_leader / helper_follower 도 포함해 매트릭스에 노출 (isHelper=true).
  // 헬퍼는 표시·투표만 가능하고 순위/정원/통과 계산에서는 제외된다.
  const eligible = useMemo<Eligible[]>(() => {
    if (round === 'prelim') {
      return participants
        .filter((p) =>
          p.role === 'leader' || p.role === 'follower' ||
          p.role === 'helper_leader' || p.role === 'helper_follower'
        )
        .map((p) => {
          const isHelper = p.role === 'helper_leader' || p.role === 'helper_follower';
          const role: 'leader' | 'follower' =
            p.role === 'leader' || p.role === 'helper_leader' ? 'leader' : 'follower';
          return { num: p.num, team_name: p.team_name, role, isHelper };
        })
        .sort((a, b) => a.num.localeCompare(b.num, undefined, { numeric: true }));
    }
    const source = round === 'semi' ? prelimQualifiers : semiQualifiers;
    return source
      .filter((q) => q.passed && (q.role === 'leader' || q.role === 'follower'))
      .map((q) => ({
        num: q.participant_num,
        team_name: q.team_name,
        role: q.role as 'leader' | 'follower',
        isHelper: false,
      }))
      .sort((a, b) => a.num.localeCompare(b.num, undefined, { numeric: true }));
  }, [round, participants, prelimQualifiers, semiQualifiers]);

  // Lookup: voteMap[`${judgeId}:${num}`] = vote row
  const voteMap = useMemo(() => {
    const m = new Map<string, JudgeVoteRow>();
    for (const v of votes) m.set(`${v.judge_id}:${v.participant_num}`, v);
    return m;
  }, [votes]);

  // Aggregates per participant — totals for display
  const totals = useMemo(() => {
    const t = new Map<string, { o: number; x: number; total: number; avg: number | null }>();
    for (const e of eligible) {
      let o = 0, x = 0, sum = 0, cnt = 0;
      for (const j of judges) {
        const v = voteMap.get(`${j.id}:${e.num}`);
        if (!v) continue;
        if (v.vote_mark === 'O') o++;
        else if (v.vote_mark === 'X') x++;
        if (isFinal) {
          const agg = aggregateScores(v, activeKeys);
          sum += agg.sum; cnt += agg.cnt;
        }
      }
      t.set(e.num, { o, x, total: sum, avg: cnt > 0 ? sum / cnt : null });
    }
    return t;
  }, [judges, voteMap, eligible, isFinal, activeKeys]);

  // 헬퍼는 순위/정원 계산에서 제외하기 위한 lookup.
  const helperSet = useMemo(() => {
    const s = new Set<string>();
    for (const e of eligible) if (e.isHelper) s.add(e.num);
    return s;
  }, [eligible]);

  // 점수 평가 — prelim/semi 는 O 카운트, final 은 total(없으면 avg). rank + boundary tie 공용.
  // 헬퍼는 -Infinity 로 처리 → 정렬·rank 대상에서 자동 배제 (commit 로직과 일치).
  const scoreOf = useMemo(() => (num: string): number => {
    if (helperSet.has(num)) return -Infinity;
    const t = totals.get(num);
    if (!t) return -Infinity;
    if (isFinal) return t.total > 0 ? t.total : (t.avg ?? -Infinity);
    // prelim/semi : O가 0이면 ranking 대상이 아님 (commit 로직과 일치 — "No O vote → not in qualifiers list").
    // 그렇지 않으면 0표 동점자가 정원 안으로 흘러들어와 통과 인원이 부풀려진다.
    return t.o > 0 ? t.o : -Infinity;
  }, [totals, isFinal, helperSet]);

  // 정원 경계 동점자 — rank == maxPerRole 의 점수와 rank == maxPerRole+1 의 점수가 같으면
  // 그 점수를 가진 모든 참가자가 boundary tie. 정원 안/밖 모두 포함 → 운영자 수동 결정 필요.
  const boundaryTieNums = useMemo(() => {
    const tieSet = new Set<string>();
    for (const role of ['leader', 'follower'] as const) {
      const sorted = eligible
        .filter((e) => e.role === role)
        .map((e) => e.num)
        .sort((a, b) => scoreOf(b) - scoreOf(a));
      if (sorted.length <= maxPerRole) continue; // 후보가 정원 이하 → 경계 동점 없음
      const cutoff = scoreOf(sorted[maxPerRole - 1]);
      const next = scoreOf(sorted[maxPerRole]);
      if (cutoff !== -Infinity && cutoff === next) {
        for (const num of sorted) {
          if (scoreOf(num) === cutoff) tieSet.add(num);
        }
      }
    }
    return tieSet;
  }, [eligible, scoreOf, maxPerRole]);

  // 경계 동점 그룹 — 역할별로 같은 점수에 묶여 정원 경계에 걸친 후보군.
  //   slots = 정원 - (동점보다 점수 높은 자동 통과 인원). 관리자가 이 중 slots 명을 올린다.
  const tieGroups = useMemo(() => {
    const out: { role: 'leader' | 'follower'; tieScore: number; slots: number; candidates: { num: string; team_name: string }[] }[] = [];
    // 예선/본선: O 표 동점(통과 경계). 결승: 총점 동점(시상 top3 경계). scoreOf 가 라운드에 맞춰 처리.
    for (const role of ['leader', 'follower'] as const) {
      const tied = eligible.filter((e) => e.role === role && !e.isHelper && boundaryTieNums.has(e.num));
      if (tied.length < 2) continue;
      const tieScore = scoreOf(tied[0].num);
      const aboveCount = eligible.filter(
        (e) => e.role === role && !e.isHelper && scoreOf(e.num) !== -Infinity && scoreOf(e.num) > tieScore
      ).length;
      out.push({
        role,
        tieScore,
        slots: Math.max(0, maxPerRole - aboveCount),
        candidates: tied
          .map((t) => ({ num: t.num, team_name: t.team_name }))
          .sort((a, b) => a.num.localeCompare(b.num, undefined, { numeric: true })),
      });
    }
    return out;
  }, [eligible, boundaryTieNums, scoreOf, maxPerRole, isFinal]);

  // Rank per role (Olympic-style: 1, 1, 3).
  const rankMap = useMemo(() => {
    const r = new Map<string, number>();
    const score = scoreOf;
    for (const role of ['leader', 'follower'] as const) {
      const list = eligible.filter((e) => e.role === role)
        .map((e) => ({ num: e.num, s: score(e.num) }))
        .sort((a, b) => b.s - a.s);
      let lastScore: number | null = null;
      let lastRank = 0;
      for (let i = 0; i < list.length; i++) {
        const item = list[i];
        if (item.s === -Infinity) continue;
        if (lastScore == null || item.s !== lastScore) {
          lastRank = i + 1;
          lastScore = item.s;
        }
        r.set(item.num, lastRank);
      }
    }
    return r;
  }, [eligible, totals, isFinal]);

  // Per-judge column aggregates — O counts split by role + pass-rate hint
  const judgeColAgg = useMemo(() => {
    const m = new Map<string, { leaderO: number; followerO: number; total: number; cnt: number }>();
    for (const j of judges) {
      let leaderO = 0, followerO = 0, total = 0, cnt = 0;
      for (const e of eligible) {
        // 헬퍼는 통과 정원 대상이 아니므로 O 카운트(=투표수 제한 기준)에서 제외.
        if (e.isHelper) continue;
        const v = voteMap.get(`${j.id}:${e.num}`);
        if (!v) continue;
        if (!isFinal) {
          if (v.vote_mark === 'O') {
            if (e.role === 'leader') leaderO++;
            else if (e.role === 'follower') followerO++;
          }
        } else {
          const agg = aggregateScores(v, activeKeys);
          total += agg.sum; cnt += agg.cnt;
        }
      }
      m.set(j.id, { leaderO, followerO, total, cnt });
    }
    return m;
  }, [judges, voteMap, eligible, isFinal, activeKeys]);

  // 정규 참가자(leader/follower) 카운트 — 헬퍼는 별도 집계.
  const eligibleLeaders = eligible.filter((e) => e.role === 'leader' && !e.isHelper).length;
  const eligibleFollowers = eligible.filter((e) => e.role === 'follower' && !e.isHelper).length;
  const eligibleHelpers = eligible.filter((e) => e.isHelper).length;

  // 현재 O/X 상태 기준 라이브 통과 인원 — rank ≤ maxPerRole (= 행 하이라이트 기준)
  // boundary tie 가 있으면 정원을 초과할 수 있다 (e.g. 24 정원에 25명 통과).
  const liveInQuota = useMemo(() => {
    let leaders = 0, followers = 0;
    for (const e of eligible) {
      const rank = rankMap.get(e.num);
      if (rank == null || rank > maxPerRole) continue;
      if (e.role === 'leader') leaders++;
      else if (e.role === 'follower') followers++;
    }
    return { leaders, followers };
  }, [eligible, rankMap, maxPerRole]);

  // 확정(commit/추려내기) 이 있으면 카운터·배지는 라이브(원표 Olympic, 동점 전원 포함)가 아니라
  // 실제 확정 통과자(confirmed) 를 보여준다 → 추려내기 결과가 즉시 반영.
  const isCommitted = confirmed.leaders + confirmed.followers > 0;
  const passDisplay = isCommitted ? confirmed : liveInQuota;
  const overQuota = !isCommitted && (liveInQuota.leaders > maxPerRole || liveInQuota.followers > maxPerRole);

  // Reset 진입점 — 인페이지 모달을 띄워 한 번 더 확인받는다.
  function requestReset() {
    setResetModalOpen(true);
  }

  async function performReset() {
    setResetModalOpen(false);
    setError(null);
    setActionMsg(null);
    startTransition(async () => {
      const res = await fetch(`${apiBase}/reset`, { method: 'POST' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? `Reset failed (${res.status})`);
        return;
      }
      const j = await res.json();
      setVotes([]);
      setActionMsg(t('matrix.resetDone').replace('{N}', String(j.data?.deleted ?? 0)));
      router.refresh();
    });
  }

  async function refreshData() {
    setError(null);
    setActionMsg(null);
    startTransition(async () => {
      try {
        const res = await fetch(apiBase, { cache: 'no-store' });
        if (!res.ok) throw new Error(`Refresh failed (${res.status})`);
        const j = await res.json();
        const data = j.data ?? {};
        if (Array.isArray(data.judges)) setJudges(data.judges as JudgeRow[]);
        if (Array.isArray(data.votes)) setVotes(data.votes as JudgeVoteRow[]);
        setActionMsg(
          t('matrix.refreshedDone')
            .replace('{J}', String(Array.isArray(data.judges) ? data.judges.length : 0))
            .replace('{V}', String(Array.isArray(data.votes) ? data.votes.length : 0))
        );
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Refresh failed');
      }
    });
  }

  // 자동 새로고침 — refreshData 최신 클로저를 ref로 보관해 setInterval이 항상 최신 함수 호출.
  const refreshRef = useRef(refreshData);
  useEffect(() => {
    refreshRef.current = refreshData;
  });
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => {
      refreshRef.current();
    }, 5000);
    return () => clearInterval(id);
  }, [autoRefresh]);

  async function performUncommit() {
    setUncommitModalOpen(false);
    setError(null);
    setActionMsg(null);
    startTransition(async () => {
      const res = await fetch(`${apiBase}/uncommit`, { method: 'POST' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? `Uncommit failed (${res.status})`);
        return;
      }
      const j = await res.json();
      setConfirmed({ leaders: 0, followers: 0 });
      setActionMsg(t('matrix.uncommittedDone').replace('{N}', String(j.data?.deleted ?? 0)));
      router.refresh();
    });
  }

  // 실제 commit 실행 — tieExclude(탈락시킬 동점자 num) 가 있으면 본문에 실어 보낸다.
  function runCommit(tieExclude?: string[]) {
    setError(null);
    setActionMsg(null);
    const hasExclude = Array.isArray(tieExclude) && tieExclude.length > 0;
    startTransition(async () => {
      const res = await fetch(`${apiBase}/commit`, {
        method: 'POST',
        headers: hasExclude ? { 'Content-Type': 'application/json' } : undefined,
        body: hasExclude ? JSON.stringify({ tieExclude }) : undefined,
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? `Commit failed (${res.status})`);
        return;
      }
      const j = await res.json();
      const lc = j.data?.confirmedLeaders ?? 0;
      const fc = j.data?.confirmedFollowers ?? 0;
      setConfirmed({ leaders: lc, followers: fc });
      setActionMsg(
        t('matrix.committedDone')
          .replace('{L}', String(lc))
          .replace('{F}', String(fc))
      );
      router.refresh();
    });
  }

  function commitToQualifiers() {
    // 결승은 final_results 테이블 갱신, 예선/본선은 qualifiers 테이블 갱신.
    // 두 경우 모두 같은 commit 엔드포인트가 처리 (서버 측 분기).
    if (!confirm(
      t('matrix.confirmCommit')
        .replace('{ROUND}', roundLabel)
        .replace('{MAX}', String(maxPerRole))
    )) return;
    runCommit();
  }

  // 동점 추려내기 모달 — 열기/선택/적용.
  // 헤드(타이브레이커) 심사위원이 지정돼 있으면, 동점자 중 헤드가 O 준 사람을 우선 자동 선택.
  // 부족분은 정원 안(rank) 순 → 남으면 앞에서부터 채운다. 운영자는 확인 후 저장.
  const headJudge = useMemo(() => judges.find((j) => j.is_head) ?? null, [judges]);
  function openTieModal() {
    const init: Record<string, boolean> = {};
    for (const g of tieGroups) {
      let n = 0;
      // 1) 헤드가 O 준 동점자 우선
      if (headJudge) {
        for (const c of g.candidates) {
          if (n >= g.slots) break;
          if (voteMap.get(`${headJudge.id}:${c.num}`)?.vote_mark === 'O') { init[c.num] = true; n++; }
        }
      }
      // 2) 부족분은 정원 안(rank ≤ maxPerRole) 순으로 보강
      for (const c of g.candidates) {
        if (n >= g.slots) break;
        if (init[c.num]) continue;
        if ((rankMap.get(c.num) ?? 999) <= maxPerRole) { init[c.num] = true; n++; }
      }
      // 3) 그래도 부족하면 앞에서부터
      for (const c of g.candidates) {
        if (n >= g.slots) break;
        if (init[c.num]) continue;
        init[c.num] = true; n++;
      }
    }
    setTiePick(init);
    setError(null);
    setTieModalOpen(true);
  }
  function selectedInGroup(g: (typeof tieGroups)[number], pick: Record<string, boolean>): number {
    return g.candidates.filter((c) => pick[c.num]).length;
  }
  function toggleTiePick(g: (typeof tieGroups)[number], num: string) {
    setTiePick((s) => {
      const cur = !!s[num];
      if (!cur && selectedInGroup(g, s) >= g.slots) return s; // slots 초과 방지
      return { ...s, [num]: !cur };
    });
  }
  function applyTieResolution() {
    // 선택되지 않은 동점자 = 탈락 → tieExclude 로 commit.
    const exclude: string[] = [];
    for (const g of tieGroups) for (const c of g.candidates) if (!tiePick[c.num]) exclude.push(c.num);
    setTieModalOpen(false);
    runCommit(exclude);
  }

  // 최신 votes/judges 를 다시 받아 로컬 state 갱신 (refreshData 의 awaitable 버전).
  async function reloadVotes() {
    try {
      const res = await fetch(apiBase, { cache: 'no-store' });
      if (res.ok) {
        const j = await res.json();
        const data = j.data ?? {};
        if (Array.isArray(data.judges)) setJudges(data.judges as JudgeRow[]);
        if (Array.isArray(data.votes)) setVotes(data.votes as JudgeVoteRow[]);
      }
    } catch { /* ignore */ }
    router.refresh();
  }

  // 시뮬레이션 적용 — 리더/팔로워 동점자 수를 받아 자동 투표 생성.
  async function applySimulation() {
    const clamp = (n: number) => Math.max(0, Math.min(200, Math.round(n) || 0));
    const tieLeader = clamp(simTieLeader);
    const tieFollower = clamp(simTieFollower);
    setSimModalOpen(false);
    setError(null);
    setActionMsg(null);
    setSimBusy(true);
    try {
      const res = await fetch(`${apiBase}/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tieLeader, tieFollower }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? `Simulation failed (${res.status})`);
        return;
      }
      const j = await res.json();
      // 시뮬레이션은 기존 확정(qualifiers)을 무효화 → 카운터가 새 투표 라이브를 보이도록 초기화.
      setConfirmed({ leaders: 0, followers: 0 });
      setActionMsg(
        t('matrix.simDone')
          .replace('{L}', String(tieLeader))
          .replace('{F}', String(tieFollower))
          .replace('{V}', String(j.data?.votes ?? 0))
      );
      await reloadVotes();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Simulation failed');
    } finally {
      setSimBusy(false);
    }
  }

  async function addJudge() {
    if (!newJudgeName.trim()) return;
    setError(null);
    startTransition(async () => {
      // mirror create → prelim/semi/final 3 라운드에 동시 생성
      const res = await fetch(judgesApiBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newJudgeName.trim() }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? `Add failed (${res.status})`);
        return;
      }
      const j = await res.json();
      // 현재 라운드에 해당하는 row 만 view 에 추가
      const myRow = Array.isArray(j.group)
        ? j.group.find((r: JudgeRow) => r.round === round)
        : (j.data?.round === round ? j.data : null);
      if (myRow) setJudges((s) => [...s, myRow].sort((a, b) => a.display_order - b.display_order));
      setNewJudgeName('');
      router.refresh();
    });
  }

  async function renameJudge(id: string, name: string) {
    startTransition(async () => {
      // mirror patch → 같은 display_order 의 3 라운드 row 모두 갱신
      const res = await fetch(`${judgesApiBase}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) { setError(`Rename failed (${res.status})`); router.refresh(); return; }
      const j = await res.json();
      const myRow = Array.isArray(j.group)
        ? j.group.find((r: JudgeRow) => r.round === round)
        : j.data;
      if (myRow) setJudges((s) => s.map((x) => (x.id === myRow.id ? myRow : x)));
    });
  }

  async function deleteJudge(id: string, name: string) {
    if (!confirm(t('matrix.confirmDeleteJudge').replace('{NAME}', name))) return;
    startTransition(async () => {
      // mirror delete → 같은 display_order 의 3 라운드 row 모두 제거 (votes cascade)
      const res = await fetch(`${judgesApiBase}/${id}`, { method: 'DELETE' });
      if (!res.ok) { setError(`Delete failed (${res.status})`); return; }
      setJudges((s) => s.filter((x) => x.id !== id));
      setVotes((s) => s.filter((v) => v.judge_id !== id));
      router.refresh();
    });
  }

  // 채점 "제출 완료" 토글 — 이 라운드의 해당 심사위원 row 만 갱신(미러 X).
  // submitted_at 값이 있으면 관리자 매트릭스에서 해당 컬럼 전체가 녹색으로 표시된다.
  // 점수 입력 자체는 막지 않는다(시야 표시 용도). 다시 누르면 제출 해제.
  async function toggleSubmit(id: string, next: boolean) {
    const submitted_at = next ? new Date().toISOString() : null;
    // Optimistic
    setJudges((s) => s.map((x) => (x.id === id ? { ...x, submitted_at } : x)));
    startTransition(async () => {
      const res = await fetch(`${apiBase}/judges/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submitted_at }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? `Submit toggle failed (${res.status})`);
        router.refresh();
        return;
      }
      const j = await res.json();
      if (j.data) setJudges((s) => s.map((x) => (x.id === j.data.id ? j.data : x)));
    });
  }

  async function setVote(judgeId: string, num: string, patch: Partial<JudgeVoteRow>) {
    // Optimistic local update first
    const key = `${judgeId}:${num}`;
    const current = voteMap.get(key);
    const merged: JudgeVoteRow = {
      id: current?.id ?? '',
      judge_id: judgeId,
      participant_num: num,
      vote_mark: 'vote_mark' in patch ? (patch.vote_mark ?? null) : current?.vote_mark ?? null,
      basic_score: 'basic_score' in patch ? (patch.basic_score ?? null) : current?.basic_score ?? null,
      connectivity_score: 'connectivity_score' in patch ? (patch.connectivity_score ?? null) : current?.connectivity_score ?? null,
      musicality_score: 'musicality_score' in patch ? (patch.musicality_score ?? null) : current?.musicality_score ?? null,
      creativity_score: 'creativity_score' in patch ? (patch.creativity_score ?? null) : current?.creativity_score ?? null,
      crowd_reaction_score: 'crowd_reaction_score' in patch ? (patch.crowd_reaction_score ?? null) : current?.crowd_reaction_score ?? null,
      showmanship_score: 'showmanship_score' in patch ? (patch.showmanship_score ?? null) : current?.showmanship_score ?? null,
      updated_at: new Date().toISOString(),
    };
    setVotes((s) => {
      const out = s.filter((v) => !(v.judge_id === judgeId && v.participant_num === num));
      out.push(merged);
      return out;
    });
    startTransition(async () => {
      const res = await fetch(`${apiBase}/votes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ judge_id: judgeId, participant_num: num, ...patch }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? `Save failed (${res.status})`);
        router.refresh();
      } else {
        const j = await res.json();
        setVotes((s) => {
          const out = s.filter((v) => !(v.judge_id === judgeId && v.participant_num === num));
          out.push(j.data);
          return out;
        });
      }
    });
  }

  function cycleMark(judgeId: string, num: string) {
    const cur = voteMap.get(`${judgeId}:${num}`)?.vote_mark ?? null;
    const next: VoteMark | null = cur == null ? 'O' : cur === 'O' ? 'X' : null;
    // O 투표 개수 제한 — 각 심사위원의 'O'(통과) 표를 역할별 통과 정원(maxPerRole)까지만 허용.
    // prelim/semi 에서만 적용(final 은 점수제), 헬퍼는 정원 비대상이라 제외.
    if (!isFinal && next === 'O') {
      const target = eligible.find((e) => e.num === num);
      if (target && !target.isHelper) {
        const a = judgeColAgg.get(judgeId);
        const count = target.role === 'leader' ? (a?.leaderO ?? 0) : (a?.followerO ?? 0);
        if (count >= maxPerRole) {
          setError(
            t('matrix.voteLimitReached')
              .replace('{MAX}', String(maxPerRole))
              .replace('{ROLE}', target.role === 'leader' ? L : F)
          );
          return;
        }
      }
    }
    setError(null);
    setVote(judgeId, num, { vote_mark: next });
  }

  // 현재 화면 상태(아직 commit 안 한 라이브 결정)를 엑셀로 내보낸다.
  // 행: 역할(L→F) → rank 오름차순. 컬럼: #, TEAM, ROLE, 심사위원별 O/X(또는 결승 점수),
  //     O/X 합계, RANK, RESULT(PASS / TIE / -). 헬퍼는 순위 없이 맨 아래.
  async function exportExcel() {
    setExporting(true);
    setError(null);
    try {
      const XLSX = await import('xlsx');

      // 정렬: leader 먼저, follower 다음. 각 역할 안에서는 rank 오름차순(미배정·헬퍼는 맨 뒤).
      const roleOrder = (r: 'leader' | 'follower') => (r === 'leader' ? 0 : 1);
      const sorted = [...eligible].sort((a, b) => {
        if (roleOrder(a.role) !== roleOrder(b.role)) return roleOrder(a.role) - roleOrder(b.role);
        const ra = rankMap.get(a.num) ?? Number.POSITIVE_INFINITY;
        const rb = rankMap.get(b.num) ?? Number.POSITIVE_INFINITY;
        if (ra !== rb) return ra - rb;
        return a.num.localeCompare(b.num, undefined, { numeric: true });
      });

      const judgeNames = judges.map((j) => j.name);
      const data = sorted.map((e) => {
        const row: Record<string, string | number> = {
          '#': e.num,
          TEAM: e.team_name,
          ROLE: e.isHelper
            ? (e.role === 'leader' ? `${L} (Helper)` : `${F} (Helper)`)
            : (e.role === 'leader' ? L : F),
        };
        // 심사위원별 셀
        for (const j of judges) {
          const v = voteMap.get(`${j.id}:${e.num}`);
          if (isFinal) {
            const agg = v ? aggregateScores(v, activeKeys) : { sum: 0, cnt: 0 };
            row[j.name] = agg.cnt > 0 ? agg.sum : '';
          } else {
            row[j.name] = v?.vote_mark ?? '';
          }
        }
        const tot = totals.get(e.num);
        const rank = rankMap.get(e.num);
        if (isFinal) {
          row['TOTAL'] = tot?.total ?? 0;
          row['AVG'] = tot?.avg != null ? Number(tot.avg.toFixed(2)) : '';
        } else {
          row['O'] = tot?.o ?? 0;
          row['X'] = tot?.x ?? 0;
        }
        row['RANK'] = e.isHelper ? '' : (rank ?? '');
        const inQuota = !e.isHelper && rank != null && rank <= maxPerRole;
        const tie = boundaryTieNums.has(e.num);
        row['RESULT'] = e.isHelper
          ? 'HELPER'
          : inQuota
          ? (tie ? 'PASS (TIE)' : 'PASS')
          : (tie ? 'TIE' : '-');
        return row;
      });

      const tailCols = isFinal ? ['TOTAL', 'AVG', 'RANK', 'RESULT'] : ['O', 'X', 'RANK', 'RESULT'];
      const header = ['#', 'TEAM', 'ROLE', ...judgeNames, ...tailCols];
      const ws = XLSX.utils.json_to_sheet(data, { header });
      ws['!cols'] = [
        { wch: 6 },
        { wch: 28 },
        { wch: 14 },
        ...judgeNames.map(() => ({ wch: 8 })),
        ...tailCols.map(() => ({ wch: 8 })),
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Results');
      const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
      const blob = new Blob([buf], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${contestId}-${round}-results.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Excel export failed');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <div className="text-sm text-ink2 flex items-center gap-3 flex-wrap">
          <span>{roundLabel}</span>
          <span>
            · {eligible.length} {t('matrix.eligible')} ({eligibleLeaders} {L} / {eligibleFollowers} {F}
            {eligibleHelpers > 0 && <> + {eligibleHelpers} {t('matrix.helperShort')}</>})
          </span>
          <span>· {judges.length} {t('matrix.judges')}</span>
          <Badge tone="warn">
            {t('matrix.passQuota')}: {maxPerRole * 2} {t('matrix.couples')} ({maxPerRole} {L} / {maxPerRole} {F})
          </Badge>
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-semibold ${
              overQuota ? 'border-danger/60 bg-danger/10 text-danger' : 'border-ok/60 bg-ok/10 text-ok'
            }`}
            title={t('matrix.tooltipLiveCounter')}
          >
            <span className="font-normal opacity-70">{isCommitted ? t('matrix.passingConfirmed') : isFinal ? t('matrix.podium') : t('matrix.currentlyPassing')}:</span>
            <span className={`font-mono ${!isCommitted && passDisplay.leaders > maxPerRole ? 'text-danger font-bold' : ''}`}>{passDisplay.leaders}</span>
            <span className="opacity-60">{L}</span>
            <span className="opacity-40">/</span>
            <span className={`font-mono ${!isCommitted && passDisplay.followers > maxPerRole ? 'text-danger font-bold' : ''}`}>{passDisplay.followers}</span>
            <span className="opacity-60">{F}</span>
            {overQuota && (
              <span className="ml-1 font-normal">({t('matrix.tieOverQuota')})</span>
            )}
          </span>
          {boundaryTieNums.size > 0 && (
            <Badge tone="danger">
              {t('matrix.boundaryTie')} — {boundaryTieNums.size} {t('matrix.boundaryTieDetail')}
            </Badge>
          )}
          {tieGroups.length > 0 && (
            <Button variant="primary" onClick={openTieModal} disabled={pending}>
              {t('matrix.tieResolve')}
            </Button>
          )}
          {isFinal && (
            <Badge tone="info">
              {activeDefs.length} {t('matrix.activeItems')} · {activeDefs.map((d) => d.label).join(' / ')}
            </Badge>
          )}
          {!isFinal && <Badge tone="info">{t('matrix.clickToToggle')}</Badge>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Input
            value={newJudgeName}
            onChange={(e) => setNewJudgeName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addJudge(); } }}
            placeholder={t('matrix.newJudgeName')}
            className="w-48"
          />
          <Button variant="primary" onClick={addJudge} disabled={pending || !newJudgeName.trim()}>
            {t('matrix.addJudge')}
          </Button>
          <Button onClick={refreshData} disabled={pending}>
            {t('matrix.refresh')}
          </Button>
          <label
            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border text-xs cursor-pointer select-none transition ${
              autoRefresh
                ? 'border-ok/60 bg-ok/10 text-ok'
                : 'border-border bg-bg2/40 text-ink2 hover:border-accent'
            }`}
            title={autoRefresh ? t('matrix.autoRefreshOn') : t('matrix.autoRefreshOff')}
          >
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="accent-ok"
            />
            {t('matrix.autoRefresh')}
          </label>
          <Button variant="danger" onClick={requestReset} disabled={pending || votes.length === 0}>
            {t('matrix.reset')}
          </Button>
          {/* Uncommit 은 prelim/semi qualifiers 테이블만 대상 — final 에선 비노출. */}
          {!isFinal && (
            <Button
              variant="danger"
              onClick={() => setUncommitModalOpen(true)}
              disabled={pending || (confirmed.leaders === 0 && confirmed.followers === 0)}
              title={t('matrix.uncommitTooltip')}
            >
              {t('matrix.uncommit')}
            </Button>
          )}
          <Button variant="primary" onClick={commitToQualifiers} disabled={pending}>
            {isFinal ? t('matrix.commitToFinalResults') : t('matrix.commitToQualifiers')}
          </Button>
          <Button
            variant="secondary"
            onClick={exportExcel}
            disabled={exporting || eligible.length === 0}
            title={t('matrix.exportExcelTooltip')}
          >
            {exporting ? 'Exporting…' : '⬇ Excel'}
          </Button>
          {/* 시뮬레이션 — prep 단계에서만. 예선/본선은 O 표, 결승은 항목 점수를 생성. */}
          {roundStatus === 'prep' && (
            <Button
              variant="primary"
              onClick={() => setSimModalOpen(true)}
              disabled={pending || simBusy || judges.length === 0}
              title={t('matrix.simTooltip')}
            >
              {simBusy ? '…' : t('matrix.simulate')}
            </Button>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-danger mb-3" role="alert">{error}</p>}
      {actionMsg && (
        <p className="text-sm text-ok mb-3 rounded border border-ok/40 bg-ok/5 px-3 py-2">
          ✓ {actionMsg}
        </p>
      )}

      {eligible.length === 0 ? (
        <div className="rounded border border-border bg-panel p-8 text-center text-sm text-ink2">
          {round === 'prelim' ? t('matrix.noParticipants') : t('matrix.noQualifiers')}
        </div>
      ) : (
        // 높이를 제한해 표를 내부 스크롤 → sticky 헤더(심사위원명)·고정 컬럼이 스크롤 중에도 보이게.
        <div className="rounded border border-border bg-panel overflow-auto max-h-[calc(100vh-240px)]">
          <table className="text-sm min-w-full">
            <thead className="bg-bg2 text-ink2 text-xs uppercase tracking-wider sticky top-0 z-10">
              <tr>
                <th className="text-left px-3 py-2 sticky left-0 bg-bg2 z-20 w-20">{t('matrix.numSign')}</th>
                <th className="text-left px-3 py-2 sticky left-20 bg-bg2 z-20 w-48">{t('matrix.team')}</th>
                {judges.map((j) => (
                  <th
                    key={j.id}
                    className={`text-left px-2 py-2 border-l ${j.submitted_at ? 'border-ok/40 bg-ok/20' : 'border-border'}`}
                    style={isFinal ? { minWidth: `${Math.max(8, activeDefs.length * 2.5)}rem` } : { minWidth: '5rem' }}
                  >
                    <JudgeHeader
                      judge={j}
                      onRename={renameJudge}
                      onDelete={deleteJudge}
                      onToggleSubmit={toggleSubmit}
                      submitted={j.submitted_at != null}
                      pending={pending}
                      leaderShort={L}
                      followerShort={F}
                      allShort={t('matrix.judgeAllShort')}
                      submitLabel={t('matrix.judgeSubmit')}
                      submittedLabel={t('matrix.judgeSubmitted')}
                      submitTitle={t('matrix.judgeSubmitTitle')}
                      unsubmitTitle={t('matrix.judgeUnsubmitTitle')}
                      tooltips={{
                        leader: t('matrix.judgeTargetLeader'),
                        follower: t('matrix.judgeTargetFollower'),
                        both: t('matrix.judgeTargetBoth'),
                      }}
                    />
                  </th>
                ))}
                <th className="text-left px-3 py-2 border-l border-border min-w-[6rem]">
                  {isFinal ? t('matrix.totalAvg') : t('matrix.oCount')}
                </th>
                <th className="text-center px-3 py-2 border-l border-border min-w-[5rem]">{t('matrix.rank')}</th>
              </tr>
            </thead>
            <tbody>
              {eligible.map((e) => {
                const agg = totals.get(e.num);
                const rank = rankMap.get(e.num);
                const inQuota = rank != null && rank <= maxPerRole;
                const tie = boundaryTieNums.has(e.num);
                const rowBg = tie ? 'bg-danger/[0.10]' : inQuota ? 'bg-ok/[0.04]' : '';
                const stickyBg = tie ? 'bg-[#2a1718]' : inQuota ? 'bg-[#1a221d]' : 'bg-panel';
                return (
                  <tr key={e.num} className={`border-t border-border ${rowBg}`}>
                    <td className={`px-3 py-1 font-mono sticky left-0 ${stickyBg}`}>{e.num}</td>
                    <td className={`px-3 py-1 sticky left-20 w-48 ${stickyBg}`}>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Badge tone={e.role === 'leader' ? 'info' : 'neutral'}>
                          {e.role === 'leader' ? L : F}
                        </Badge>
                        {e.isHelper && (
                          <Badge tone="warn" title={t('matrix.helperTooltip')}>
                            {t('matrix.helperShort')}
                          </Badge>
                        )}
                        <span className="truncate">{e.team_name}</span>
                      </div>
                    </td>
                    {judges.map((j) => {
                      const v = voteMap.get(`${j.id}:${e.num}`);
                      // 제출 완료 컬럼 → 셀 전체 녹색 틴트(행 배경 위에 덧입혀짐).
                      const subCell = j.submitted_at ? 'border-ok/40 bg-ok/[0.12]' : 'border-border';
                      if (isFinal) {
                        return (
                          <td key={j.id} className={`px-1 py-1 border-l ${subCell}`}>
                            <FinalScoreCell
                              v={v}
                              defs={activeDefs}
                              onChange={(col, val) => setVote(j.id, e.num, { [col]: val } as Partial<JudgeVoteRow>)}
                            />
                          </td>
                        );
                      }
                      return (
                        <td key={j.id} className={`px-1 py-1 border-l text-center ${subCell}`}>
                          <MarkCell mark={v?.vote_mark ?? null} onClick={() => cycleMark(j.id, e.num)} />
                        </td>
                      );
                    })}
                    <td className="px-3 py-1 border-l border-border text-xs text-ink2">
                      {isFinal ? (
                        <span>
                          {agg && agg.total > 0 ? agg.total.toFixed(1) : '—'}
                          {agg && agg.avg != null && (
                            <span className="text-ink2/60"> · {agg.avg.toFixed(2)}</span>
                          )}
                        </span>
                      ) : (
                        <span>
                          <span className="text-ok">{agg?.o ?? 0}</span>
                          <span className="mx-1">/</span>
                          <span className="text-danger">{agg?.x ?? 0}</span>
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-1 border-l border-border text-center">
                      {rank == null ? (
                        <span className="text-ink2/40">—</span>
                      ) : (
                        <span
                          className={`font-mono ${
                            tie ? 'text-danger font-semibold' :
                            inQuota ? 'text-accent font-semibold' :
                            'text-ink2'
                          }`}
                          title={tie ? 'Boundary tie — manual decision required' : undefined}
                        >
                          <span className="text-ink2/60 mr-0.5">
                            {e.role === 'leader' ? L : F}
                          </span>
                          {rank}
                          {tie && <span className="ml-0.5">⚠</span>}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {!isFinal && judges.length > 0 && (
              <tfoot className="bg-bg2 border-t-2 border-accent/40 sticky bottom-0">
                <tr>
                  <td className="px-3 py-2 sticky left-0 bg-bg2 text-xs font-semibold text-accent">{t('matrix.leaderO')}</td>
                  <td className="px-3 py-2 sticky left-20 bg-bg2 text-xs text-ink2">
                    {t('matrix.passQuotaShort')} {maxPerRole}
                  </td>
                  {judges.map((j) => {
                    const c = judgeColAgg.get(j.id)?.leaderO ?? 0;
                    const full = c >= maxPerRole;
                    return (
                      <td key={j.id} className={`px-2 py-2 border-l text-center text-sm font-mono ${j.submitted_at ? 'border-ok/40 bg-ok/20' : 'border-border'}`}>
                        <span className={full ? 'text-danger font-semibold' : c > 0 ? 'text-ok' : 'text-ink2/40'}>
                          {c}/{maxPerRole}
                        </span>
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 border-l border-border" colSpan={2}></td>
                </tr>
                <tr className="border-t border-border">
                  <td className="px-3 py-2 sticky left-0 bg-bg2 text-xs font-semibold text-accent">{t('matrix.followerO')}</td>
                  <td className="px-3 py-2 sticky left-20 bg-bg2 text-xs text-ink2">
                    {t('matrix.passQuotaShort')} {maxPerRole}
                  </td>
                  {judges.map((j) => {
                    const c = judgeColAgg.get(j.id)?.followerO ?? 0;
                    const full = c >= maxPerRole;
                    return (
                      <td key={j.id} className={`px-2 py-2 border-l text-center text-sm font-mono ${j.submitted_at ? 'border-ok/40 bg-ok/20' : 'border-border'}`}>
                        <span className={full ? 'text-danger font-semibold' : c > 0 ? 'text-ok' : 'text-ink2/40'}>
                          {c}/{maxPerRole}
                        </span>
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 border-l border-border" colSpan={2}></td>
                </tr>
                <tr className="border-t border-border">
                  <td className="px-3 py-2 sticky left-0 bg-bg2 text-xs font-semibold text-accent" colSpan={2 + judges.length + 2}>
                    {t('matrix.passQuotaFull')} <span className="text-accent">{maxPerRole * 2}</span>{' '}
                    {t('matrix.couplesFull').replace('{LEADERS}', String(maxPerRole)).replace('{FOLLOWERS}', String(maxPerRole))}
                    <span className="ml-3 text-ink2 normal-case font-normal">
                      — {t('matrix.rowsHighlighted').replace('{MAX}', String(maxPerRole))}
                    </span>
                    <span className="ml-3 normal-case font-normal">
                      {t('matrix.currentlyPassing')} →{' '}
                      <span className={`font-mono font-semibold ${liveInQuota.leaders > maxPerRole ? 'text-danger' : 'text-ok'}`}>
                        {liveInQuota.leaders} {L}
                      </span>
                      <span className="text-ink2 mx-1">/</span>
                      <span className={`font-mono font-semibold ${liveInQuota.followers > maxPerRole ? 'text-danger' : 'text-ok'}`}>
                        {liveInQuota.followers} {F}
                      </span>
                    </span>
                  </td>
                </tr>
              </tfoot>
            )}
            {isFinal && judges.length > 0 && (
              <tfoot className="bg-bg2 border-t-2 border-accent/40 sticky bottom-0">
                <tr>
                  <td className="px-3 py-2 sticky left-0 bg-bg2 text-xs font-semibold text-accent">{t('matrix.judgeAvg')}</td>
                  <td className="px-3 py-2 sticky left-20 bg-bg2 text-xs text-ink2">
                    {t('matrix.avgOfEntered')}
                  </td>
                  {judges.map((j) => {
                    const a = judgeColAgg.get(j.id);
                    const avg = a && a.cnt > 0 ? a.total / a.cnt : null;
                    return (
                      <td key={j.id} className={`px-2 py-2 border-l text-center text-xs font-mono ${j.submitted_at ? 'border-ok/40 bg-ok/20' : 'border-border'}`}>
                        <span className={avg != null ? 'text-ok' : 'text-ink2/40'}>
                          {avg != null ? avg.toFixed(2) : '—'}
                        </span>
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 border-l border-border" colSpan={2}></td>
                </tr>
                <tr className="border-t border-border">
                  <td className="px-3 py-2 sticky left-0 bg-bg2 text-xs font-semibold text-accent" colSpan={2 + judges.length + 2}>
                    {t('matrix.podiumTop')} <span className="text-accent">{maxPerRole}</span> {t('matrix.perRole')}
                    <span className="ml-3 text-ink2 normal-case font-normal">
                      — {t('matrix.rowsHighlighted').replace('{MAX}', String(maxPerRole))}
                    </span>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      <p className="text-xs text-ink2 mt-3">
        {isFinal ? t('matrix.tooltipFinal') : t('matrix.tooltipPrelim')}
      </p>

      {/* Reset 확인 모달 — native confirm 대체. ESC / 백드롭 클릭으로 취소. */}
      {resetModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-modal-title"
          onClick={() => setResetModalOpen(false)}
          onKeyDown={(e) => { if (e.key === 'Escape') setResetModalOpen(false); }}
        >
          <div
            className="max-w-md w-[min(28rem,calc(100vw-2rem))] rounded-xl border-2 border-danger/60 bg-panel p-6 shadow-2xl shadow-black/60"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="reset-modal-title" className="text-lg font-semibold text-danger mb-3">
              ⚠ {t('matrix.resetModalTitle')}
            </h3>
            <p className="text-sm text-ink2 mb-5 whitespace-pre-line">
              {t('matrix.confirmReset').replace('{ROUND}', roundLabel)}
            </p>
            <div className="flex items-center justify-end gap-2">
              <Button onClick={() => setResetModalOpen(false)} disabled={pending}>
                {t('matrix.cancel')}
              </Button>
              <Button variant="danger" onClick={performReset} disabled={pending}>
                {t('matrix.resetModalConfirm')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Uncommit 확인 모달 — qualifiers 행 전체 삭제 경고. */}
      {uncommitModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="uncommit-modal-title"
          onClick={() => setUncommitModalOpen(false)}
          onKeyDown={(e) => { if (e.key === 'Escape') setUncommitModalOpen(false); }}
        >
          <div
            className="max-w-md w-[min(28rem,calc(100vw-2rem))] rounded-xl border-2 border-danger/60 bg-panel p-6 shadow-2xl shadow-black/60"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="uncommit-modal-title" className="text-lg font-semibold text-danger mb-3">
              ⚠ {t('matrix.uncommitModalTitle')}
            </h3>
            <p className="text-sm text-ink2 mb-5 whitespace-pre-line">
              {t('matrix.confirmUncommit').replace('{ROUND}', roundLabel)}
            </p>
            <div className="flex items-center justify-end gap-2">
              <Button onClick={() => setUncommitModalOpen(false)} disabled={pending}>
                {t('matrix.cancel')}
              </Button>
              <Button variant="danger" onClick={performUncommit} disabled={pending}>
                {t('matrix.uncommitModalConfirm')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 동점 추려내기 모달 — 경계 동점 후보 중 올릴 사람 선택 → commit(tieExclude) */}
      {tieModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tie-modal-title"
          onClick={() => setTieModalOpen(false)}
          onKeyDown={(e) => { if (e.key === 'Escape') setTieModalOpen(false); }}
        >
          <div
            className="max-w-2xl w-[min(42rem,calc(100vw-2rem))] max-h-[calc(100vh-4rem)] overflow-auto rounded-xl border-2 border-accent/60 bg-panel p-6 shadow-2xl shadow-black/60"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="tie-modal-title" className="text-lg font-semibold text-accent mb-1">
              ⚖ {t('matrix.tieModalTitle')}
            </h3>
            <p className="text-sm text-ink2 mb-4 whitespace-pre-line">{t('matrix.tieModalHelp')}</p>

            <div className="space-y-5">
              {tieGroups.map((g) => {
                const selected = selectedInGroup(g, tiePick);
                const roleLabel = g.role === 'leader' ? L : F;
                return (
                  <div key={g.role} className="rounded border border-border bg-bg2/40 p-3">
                    <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                      <span className="text-sm font-semibold">
                        {roleLabel} · {t('matrix.tieScore')} {g.tieScore} {isFinal ? t('matrix.tiePts') : 'O'}
                      </span>
                      <span className={`text-xs font-mono ${selected === g.slots ? 'text-ok' : 'text-danger'}`}>
                        {t('matrix.tieAdvance')} {selected} / {g.slots}
                      </span>
                    </div>
                    <ul className="space-y-1">
                      {g.candidates.map((c, ci) => {
                        const checked = !!tiePick[c.num];
                        const atCap = !checked && selected >= g.slots;
                        const headO = !!headJudge && voteMap.get(`${headJudge.id}:${c.num}`)?.vote_mark === 'O';
                        return (
                          <li key={c.num}>
                            <label
                              className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer ${
                                checked ? 'bg-ok/10 border border-ok/40' : 'border border-transparent hover:bg-bg2'
                              } ${atCap ? 'opacity-40 cursor-not-allowed' : ''}`}
                            >
                              <span className="font-mono text-ink2/50 w-6 text-right">{ci + 1}</span>
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={atCap}
                                onChange={() => toggleTiePick(g, c.num)}
                                className="w-4 h-4 accent-ok"
                              />
                              <span className="font-mono text-ink2 w-12">{c.num}</span>
                              <span className="truncate">{c.team_name}</span>
                              {headO && (
                                <span className="text-accent text-xs" title={t('matrix.tieHeadPick')}>👑 O</span>
                              )}
                              <span className={`ml-auto text-xs ${checked ? 'text-ok' : 'text-danger'}`}>
                                {checked ? t('matrix.tieKeep') : t('matrix.tieDrop')}
                              </span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-2 mt-5">
              <Button onClick={() => setTieModalOpen(false)} disabled={pending}>
                {t('matrix.cancel')}
              </Button>
              <Button variant="primary" onClick={applyTieResolution} disabled={pending}>
                {t('matrix.tieApply')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 시뮬레이션 모달 — 동점자 수 설정 후 자동 투표 */}
      {simModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sim-modal-title"
          onClick={() => setSimModalOpen(false)}
          onKeyDown={(e) => { if (e.key === 'Escape') setSimModalOpen(false); }}
        >
          <div
            className="max-w-md w-[min(28rem,calc(100vw-2rem))] rounded-xl border-2 border-accent/60 bg-panel p-6 shadow-2xl shadow-black/60"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="sim-modal-title" className="text-lg font-semibold text-accent mb-1">
              🎲 {t('matrix.simModalTitle')}
            </h3>
            <p className="text-sm text-ink2 mb-4 whitespace-pre-line">{t('matrix.simModalHelp')}</p>
            <div className="grid grid-cols-2 gap-3 mb-5">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-ink2">{L} · {t('matrix.simTieCount')}</span>
                <Input
                  type="number"
                  min={0}
                  max={200}
                  value={simTieLeader}
                  onChange={(e) => setSimTieLeader(Number(e.target.value))}
                  className="font-mono text-center"
                  autoFocus
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-ink2">{F} · {t('matrix.simTieCount')}</span>
                <Input
                  type="number"
                  min={0}
                  max={200}
                  value={simTieFollower}
                  onChange={(e) => setSimTieFollower(Number(e.target.value))}
                  className="font-mono text-center"
                />
              </label>
            </div>
            <p className="text-xs text-ink2/70 mb-5">{t('matrix.simTieHint')}</p>
            <div className="flex items-center justify-end gap-2">
              <Button onClick={() => setSimModalOpen(false)} disabled={simBusy}>
                {t('matrix.cancel')}
              </Button>
              <Button variant="primary" onClick={applySimulation} disabled={simBusy}>
                {simBusy ? '…' : t('matrix.simApply')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 스크롤 위치와 무관하게 항상 보이는 라이브 통과 인원 카운터 */}
      <div
        className="fixed bottom-6 right-6 z-50 pointer-events-none select-none"
        aria-live="polite"
      >
        <div className="rounded-xl border-2 border-ok/60 bg-bg/95 backdrop-blur px-6 py-4 shadow-2xl shadow-black/50">
          <div className="text-sm uppercase tracking-wider text-ink2 mb-2">
            {isCommitted ? t('matrix.passingConfirmed') : isFinal ? t('matrix.podiumLive') : t('matrix.passingLive')}
          </div>
          <div className="flex items-center gap-5 font-mono text-3xl">
            <span className="flex items-baseline gap-2">
              <span className={`font-bold ${!isCommitted && passDisplay.leaders > maxPerRole ? 'text-danger' : 'text-ok'}`}>
                {passDisplay.leaders}
              </span>
              <span className="text-ink2 text-base">/ {maxPerRole} {L}</span>
            </span>
            <span className="text-ink2/40">·</span>
            <span className="flex items-baseline gap-2">
              <span className={`font-bold ${!isCommitted && passDisplay.followers > maxPerRole ? 'text-danger' : 'text-ok'}`}>
                {passDisplay.followers}
              </span>
              <span className="text-ink2 text-base">/ {maxPerRole} {F}</span>
            </span>
          </div>
          {overQuota && (
            <div className="text-sm text-danger mt-2">⚠ {t('matrix.tieOverQuota')}</div>
          )}
          {isCommitted && (
            <div className="text-xs text-ok/70 mt-2">✓ {t('matrix.passingConfirmedNote')}</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Judge header (name + rename + delete) ──────────────────────────────

function JudgeHeader({
  judge, onRename, onDelete, onToggleSubmit, submitted, pending,
  leaderShort, followerShort, allShort,
  submitLabel, submittedLabel, submitTitle, unsubmitTitle, tooltips,
}: {
  judge: JudgeRow;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string, name: string) => void;
  onToggleSubmit: (id: string, next: boolean) => void;
  submitted: boolean;
  pending: boolean;
  leaderShort: string;
  followerShort: string;
  allShort: string;
  submitLabel: string;
  submittedLabel: string;
  submitTitle: string;
  unsubmitTitle: string;
  tooltips: { leader: string; follower: string; both: string };
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(judge.name);
  function commit() {
    setEditing(false);
    if (name.trim() && name.trim() !== judge.name) onRename(judge.id, name.trim());
    else setName(judge.name);
  }
  // target_role 짧은 배지 — 매트릭스에서 한눈에 누가 어느 역할을 심사하는지 알 수 있게.
  const target = judge.target_role;
  const badge =
    target === 'leader'   ? { label: leaderShort,   tone: 'border-info/40 text-info',     title: tooltips.leader }   :
    target === 'follower' ? { label: followerShort, tone: 'border-border text-ink2',      title: tooltips.follower } :
                            { label: allShort,      tone: 'border-accent/40 text-accent', title: tooltips.both };
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <span className="text-ink2/70 font-mono text-xs">{judge.display_order}.</span>
        <span
          className={`inline-flex items-center px-1 py-0 rounded border text-[10px] leading-tight font-mono ${badge.tone}`}
          title={badge.title}
        >
          {badge.label}
        </span>
        {editing ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setName(judge.name); setEditing(false); } }}
            className="flex-1 min-w-0 px-1 py-0.5 text-xs bg-bg border border-accent rounded"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className={`flex-1 min-w-0 text-left text-xs hover:text-accent truncate ${submitted ? 'text-ok font-semibold' : 'text-ink'}`}
            title="Click to rename"
          >
            {judge.name}
          </button>
        )}
        <button
          type="button"
          onClick={() => onDelete(judge.id, judge.name)}
          disabled={pending}
          className="text-ink2 hover:text-danger text-xs px-1"
          title="Delete judge"
        >
          ✕
        </button>
      </div>
      {/* 채점 제출 토글 — 누르면 컬럼 전체가 녹색으로(관리자 시야 편의). 다시 누르면 해제. */}
      <button
        type="button"
        onClick={() => onToggleSubmit(judge.id, !submitted)}
        disabled={pending}
        title={submitted ? unsubmitTitle : submitTitle}
        className={`w-full rounded border px-1 py-0.5 text-[10px] leading-tight font-semibold transition ${
          submitted
            ? 'border-ok/60 bg-ok/25 text-ok hover:bg-ok/35'
            : 'border-border text-ink2 hover:border-ok/50 hover:text-ok'
        }`}
      >
        {submitted ? `✓ ${submittedLabel}` : submitLabel}
      </button>
    </div>
  );
}

// ─── Cell variants ─────────────────────────────────────────────────────

function MarkCell({ mark, onClick }: { mark: VoteMark | null; onClick: () => void }) {
  const tone =
    mark === 'O' ? 'bg-ok/15 text-ok border-ok/40' :
    mark === 'X' ? 'bg-danger/15 text-danger border-danger/40' :
    'bg-bg2/40 text-ink2/40 border-border hover:border-accent';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-12 h-7 rounded border font-mono text-sm transition ${tone}`}
    >
      {mark ?? '·'}
    </button>
  );
}

function FinalScoreCell({
  v,
  defs,
  onChange,
}: {
  v: JudgeVoteRow | undefined;
  defs: ScoringItemDef[];
  onChange: (column: ScoringItemDef['column'], value: number | null) => void;
}) {
  return (
    <div className="flex items-center gap-0.5">
      {defs.map((d) => (
        <ScoreInput
          key={d.key}
          value={(v?.[d.column] as number | null | undefined) ?? null}
          title={d.label}
          placeholder={d.shortLabel.slice(0, 1)}
          onCommit={(n) => onChange(d.column, n)}
        />
      ))}
    </div>
  );
}

function ScoreInput({
  value,
  title,
  placeholder,
  onCommit,
}: {
  value: number | null;
  title: string;
  placeholder?: string;
  onCommit: (v: number | null) => void;
}) {
  const [v, setV] = useState<string>(value == null ? '' : String(value));
  const focusedRef = useRef(false);
  // 외부에서 갱신된 value(Refresh 버튼/자동 새로고침으로 fetch한 새 점수)와 로컬 입력 동기화.
  // 사용자가 입력 중일 때는 덮어쓰지 않는다 — 편집 도중 fetch가 끼어들어도 입력이 사라지지 않게.
  useEffect(() => {
    if (focusedRef.current) return;
    setV(value == null ? '' : String(value));
  }, [value]);
  return (
    <input
      title={title}
      placeholder={placeholder ?? title[0]}
      value={v}
      onFocus={() => { focusedRef.current = true; }}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        focusedRef.current = false;
        const s = v.trim();
        if (s === '') {
          if (value != null) onCommit(null);
        } else {
          const n = Number(s);
          if (Number.isFinite(n) && n !== value) onCommit(n);
          else setV(value == null ? '' : String(value));
        }
      }}
      inputMode="decimal"
      className="w-9 h-7 rounded border border-border bg-bg2 text-center text-xs focus:outline-none focus:border-accent"
    />
  );
}
