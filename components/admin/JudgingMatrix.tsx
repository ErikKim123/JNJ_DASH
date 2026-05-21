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

  async function commitToQualifiers() {
    // 결승은 final_results 테이블 갱신, 예선/본선은 qualifiers 테이블 갱신.
    // 두 경우 모두 같은 commit 엔드포인트가 처리 (서버 측 분기).
    if (!confirm(
      t('matrix.confirmCommit')
        .replace('{ROUND}', roundLabel)
        .replace('{MAX}', String(maxPerRole))
    )) return;
    setError(null);
    setActionMsg(null);
    startTransition(async () => {
      const res = await fetch(`${apiBase}/commit`, { method: 'POST' });
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
    setVote(judgeId, num, { vote_mark: next });
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
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-ok/60 bg-ok/10 text-ok text-xs font-semibold"
            title={t('matrix.tooltipLiveCounter')}
          >
            <span className="text-ok/70 font-normal">{isFinal ? t('matrix.podium') : t('matrix.currentlyPassing')}:</span>
            <span className="font-mono">{liveInQuota.leaders}</span>
            <span className="text-ok/60">{L}</span>
            <span className="text-ok/40">/</span>
            <span className="font-mono">{liveInQuota.followers}</span>
            <span className="text-ok/60">{F}</span>
            {(liveInQuota.leaders > maxPerRole || liveInQuota.followers > maxPerRole) && (
              <span className="ml-1 text-danger font-normal">({t('matrix.tieOverQuota')})</span>
            )}
          </span>
          {boundaryTieNums.size > 0 && (
            <Badge tone="danger">
              {t('matrix.boundaryTie')} — {boundaryTieNums.size} {t('matrix.boundaryTieDetail')}
            </Badge>
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
        <div className="rounded border border-border bg-panel overflow-auto">
          <table className="text-sm min-w-full">
            <thead className="bg-bg2 text-ink2 text-xs uppercase tracking-wider sticky top-0 z-10">
              <tr>
                <th className="text-left px-3 py-2 sticky left-0 bg-bg2 z-20 w-20">{t('matrix.numSign')}</th>
                <th className="text-left px-3 py-2 sticky left-20 bg-bg2 z-20 w-48">{t('matrix.team')}</th>
                {judges.map((j) => (
                  <th
                    key={j.id}
                    className="text-left px-2 py-2 border-l border-border"
                    style={isFinal ? { minWidth: `${Math.max(8, activeDefs.length * 2.5)}rem` } : { minWidth: '5rem' }}
                  >
                    <JudgeHeader
                      judge={j}
                      onRename={renameJudge}
                      onDelete={deleteJudge}
                      pending={pending}
                      leaderShort={L}
                      followerShort={F}
                      allShort={t('matrix.judgeAllShort')}
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
                      if (isFinal) {
                        return (
                          <td key={j.id} className="px-1 py-1 border-l border-border">
                            <FinalScoreCell
                              v={v}
                              defs={activeDefs}
                              onChange={(col, val) => setVote(j.id, e.num, { [col]: val } as Partial<JudgeVoteRow>)}
                            />
                          </td>
                        );
                      }
                      return (
                        <td key={j.id} className="px-1 py-1 border-l border-border text-center">
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
                    const a = judgeColAgg.get(j.id);
                    return (
                      <td key={j.id} className="px-2 py-2 border-l border-border text-center text-sm font-mono">
                        <span className={a && a.leaderO > 0 ? 'text-ok' : 'text-ink2/40'}>
                          {a?.leaderO ?? 0}
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
                    const a = judgeColAgg.get(j.id);
                    return (
                      <td key={j.id} className="px-2 py-2 border-l border-border text-center text-sm font-mono">
                        <span className={a && a.followerO > 0 ? 'text-ok' : 'text-ink2/40'}>
                          {a?.followerO ?? 0}
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
                      <td key={j.id} className="px-2 py-2 border-l border-border text-center text-xs font-mono">
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

      {/* 스크롤 위치와 무관하게 항상 보이는 라이브 통과 인원 카운터 */}
      <div
        className="fixed bottom-6 right-6 z-50 pointer-events-none select-none"
        aria-live="polite"
      >
        <div className="rounded-xl border-2 border-ok/60 bg-bg/95 backdrop-blur px-6 py-4 shadow-2xl shadow-black/50">
          <div className="text-sm uppercase tracking-wider text-ink2 mb-2">
            {isFinal ? t('matrix.podiumLive') : t('matrix.passingLive')}
          </div>
          <div className="flex items-center gap-5 font-mono text-3xl">
            <span className="flex items-baseline gap-2">
              <span className={`font-bold ${liveInQuota.leaders > maxPerRole ? 'text-danger' : 'text-ok'}`}>
                {liveInQuota.leaders}
              </span>
              <span className="text-ink2 text-base">/ {maxPerRole} {L}</span>
            </span>
            <span className="text-ink2/40">·</span>
            <span className="flex items-baseline gap-2">
              <span className={`font-bold ${liveInQuota.followers > maxPerRole ? 'text-danger' : 'text-ok'}`}>
                {liveInQuota.followers}
              </span>
              <span className="text-ink2 text-base">/ {maxPerRole} {F}</span>
            </span>
          </div>
          {(liveInQuota.leaders > maxPerRole || liveInQuota.followers > maxPerRole) && (
            <div className="text-sm text-danger mt-2">⚠ {t('matrix.tieOverQuota')}</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Judge header (name + rename + delete) ──────────────────────────────

function JudgeHeader({
  judge, onRename, onDelete, pending,
  leaderShort, followerShort, allShort, tooltips,
}: {
  judge: JudgeRow;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string, name: string) => void;
  pending: boolean;
  leaderShort: string;
  followerShort: string;
  allShort: string;
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
          className="text-ink text-xs hover:text-accent truncate"
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
