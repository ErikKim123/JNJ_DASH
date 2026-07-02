'use client';

// 온라인 결승 심사 매트릭스 — 온라인 심사위원(행) × 결승 진출자(열).
//   결승 심사 매트릭스와 동일한 운영 버튼: 새로고침 · 자동 5초 · 초기화 · Excel.
//   · 온라인 심사위원은 최대 ~1000명이라 행(심사위원)을 페이지로 나눠 표시 + 이름 검색.
//   · 각 셀은 활성 채점 항목별 점수 입력(blur 저장). 저장은 votes upsert API.
//   · 상단 요약 행 = 진출자별 온라인 평균 / 우측 열 = 심사위원별 평균.
//   · 심사위원 추가/삭제·결과 확정은 여기서 하지 않음(등록은 조인앱, 결과는 결승 결과 탭).
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button, Input } from './ui';
import { resolveActiveDefs, type ScoringItemDef } from '@/lib/db/scoring';
import { fullName } from '@/lib/participants/name';
import type { OnlineJudgeRow, OnlineJudgeVoteRow, ScoringItemKey } from '@/lib/db/types';

type Finalist = { num: string; team_name: string; role: 'leader' | 'follower' };

const JUDGES_PER_PAGE = 20;

// 제출 시각 표시 — 로케일/타임존 독립 포맷(YYYY-MM-DD HH:mm). toLocaleString 은
// 서버(오후)/클라(PM) 표기가 달라 hydration 불일치를 일으키므로 사용하지 않는다.
function fmtTs(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

type TieGroup = { role: 'leader' | 'follower'; tieScore: number; slots: number; candidates: { num: string; name: string }[] };

export function OnlineFinalJudgingMatrix({
  contestId,
  finalists,
  judges: initialJudges,
  votes: initialVotes,
  scoringItems,
  onlineEnabled,
  finalStatus,
}: {
  contestId: string;
  finalists: Finalist[];
  judges: OnlineJudgeRow[];
  votes: OnlineJudgeVoteRow[];
  scoringItems?: readonly ScoringItemKey[];
  onlineEnabled: boolean;
  finalStatus: string;
}) {
  const router = useRouter();
  const [judges, setJudges] = useState<OnlineJudgeRow[]>(initialJudges);
  const [votes, setVotes] = useState<OnlineJudgeVoteRow[]>(initialVotes);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [busy, startTransition] = useTransition();
  // 동점 추려내기 모달 + 시상 포함 선택(체크된 후보 = 시상 포함).
  const [tieModal, setTieModal] = useState<TieGroup[] | null>(null);
  const [tiePick, setTiePick] = useState<Record<string, boolean>>({});

  const activeDefs: ScoringItemDef[] = useMemo(() => resolveActiveDefs(scoringItems), [scoringItems]);
  const apiBase = `/api/admin/contests/${encodeURIComponent(contestId)}/online-final-judging`;

  // voteMap[`${judgeId}:${num}`] = row
  const voteMap = useMemo(() => {
    const m = new Map<string, OnlineJudgeVoteRow>();
    for (const v of votes) m.set(`${v.online_judge_id}:${v.participant_num}`, v);
    return m;
  }, [votes]);

  const judgeLabel = (j: OnlineJudgeRow) =>
    fullName(j.first_name, j.last_name) || j.name || j.email || `#${j.display_order}`;

  const cols = activeDefs.map((d) => d.column);

  // 한 vote row 의 평균(비어있는 항목 제외). 채점된 항목이 없으면 null.
  const rowAvg = useCallback((v: OnlineJudgeVoteRow | undefined): number | null => {
    if (!v) return null;
    let s = 0, c = 0;
    for (const col of cols) { const val = v[col]; if (val != null) { s += Number(val); c++; } }
    return c > 0 ? s / c : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cols.join(',')]);

  // 이름/번호 검색 필터 (행 = 심사위원).
  const filteredJudges = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return judges;
    return judges.filter((j) => judgeLabel(j).toLowerCase().includes(q) || String(j.display_order) === q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [judges, query]);

  const totalPages = Math.max(1, Math.ceil(filteredJudges.length / JUDGES_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pageJudges = filteredJudges.slice((safePage - 1) * JUDGES_PER_PAGE, safePage * JUDGES_PER_PAGE);

  // 진출자별 온라인 평균(전체 심사위원 기준) + 채점 인원수.
  const finalistStats = useMemo(() => {
    const acc = new Map<string, { sum: number; n: number }>();
    for (const v of votes) {
      const a = rowAvg(v);
      if (a == null) continue;
      const cur = acc.get(v.participant_num) ?? { sum: 0, n: 0 };
      cur.sum += a; cur.n += 1;
      acc.set(v.participant_num, cur);
    }
    return acc;
  }, [votes, rowAvg]);

  const submittedCount = useMemo(() => judges.filter((j) => j.final_submitted_at).length, [judges]);
  const submitPct = judges.length > 0 ? Math.round((submittedCount / judges.length) * 100) : 0;

  function saveCell(judgeId: string, num: string, column: ScoringItemDef['column'], raw: string) {
    const value = raw.trim() === '' ? null : Number(raw);
    if (value != null && (!Number.isFinite(value) || value < 0 || value > 999)) {
      setError('점수는 0–999 사이 숫자여야 합니다.'); return;
    }
    setError(null);
    setVotes((s) => {
      const key = `${judgeId}:${num}`;
      const idx = s.findIndex((v) => `${v.online_judge_id}:${v.participant_num}` === key);
      if (idx === -1) {
        const blank: OnlineJudgeVoteRow = {
          id: `tmp-${key}`, online_judge_id: judgeId, participant_num: num,
          basic_score: null, connectivity_score: null, musicality_score: null,
          creativity_score: null, crowd_reaction_score: null, showmanship_score: null, updated_at: '',
        };
        return [...s, { ...blank, [column]: value }];
      }
      const next = [...s]; next[idx] = { ...next[idx], [column]: value }; return next;
    });
    void (async () => {
      const res = await fetch(`${apiBase}/votes`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ online_judge_id: judgeId, participant_num: num, [column]: value }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? `저장 실패 (${res.status})`);
        return;
      }
      const j = await res.json();
      if (j.data) {
        setVotes((s) => {
          const key = `${judgeId}:${num}`;
          const idx = s.findIndex((v) => `${v.online_judge_id}:${v.participant_num}` === key);
          if (idx === -1) return [...s, j.data as OnlineJudgeVoteRow];
          const next = [...s]; next[idx] = j.data as OnlineJudgeVoteRow; return next;
        });
      }
    })();
  }

  // ── 운영 버튼 ──────────────────────────────────────────────
  const refreshData = useCallback(async () => {
    setError(null); setActionMsg(null);
    try {
      const res = await fetch(apiBase, { cache: 'no-store' });
      if (!res.ok) throw new Error(`새로고침 실패 (${res.status})`);
      const j = await res.json();
      const data = j.data ?? {};
      if (Array.isArray(data.judges)) setJudges(data.judges as OnlineJudgeRow[]);
      if (Array.isArray(data.votes)) setVotes(data.votes as OnlineJudgeVoteRow[]);
      setActionMsg(
        `새로고침 완료 — 심사위원 ${Array.isArray(data.judges) ? data.judges.length : 0}명 · 점수 ${Array.isArray(data.votes) ? data.votes.length : 0}건`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : '새로고침 실패');
    }
  }, [apiBase]);

  const refreshRef = useRef(refreshData);
  useEffect(() => { refreshRef.current = refreshData; });
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => { refreshRef.current(); }, 5000);
    return () => clearInterval(id);
  }, [autoRefresh]);

  function resetAll() {
    if (!confirm('온라인 결승 채점을 모두 초기화할까요?\n\n이 대회 온라인 심사위원의 모든 점수와 제출 상태가 삭제됩니다. (되돌릴 수 없음)')) return;
    setError(null); setActionMsg(null);
    startTransition(async () => {
      const res = await fetch(`${apiBase}/reset`, { method: 'POST' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? `초기화 실패 (${res.status})`);
        return;
      }
      const j = await res.json();
      setVotes([]);
      setJudges((s) => s.map((x) => ({ ...x, final_submitted_at: null })));
      setActionMsg(`초기화 완료 — 점수 ${j.data?.deleted ?? 0}건 삭제`);
      router.refresh();
    });
  }

  async function exportExcel() {
    setExporting(true); setError(null);
    try {
      const XLSX = await import('xlsx');
      const header = ['#', 'JUDGE', ...finalists.map((f) => `${f.num} ${f.team_name}`), 'AVG', 'SUBMITTED'];
      const data = judges.map((j) => {
        const row: Record<string, string | number> = { '#': j.display_order, JUDGE: judgeLabel(j) };
        let sum = 0, n = 0;
        for (const f of finalists) {
          const a = rowAvg(voteMap.get(`${j.id}:${f.num}`));
          row[`${f.num} ${f.team_name}`] = a == null ? '' : Number(a.toFixed(2));
          if (a != null) { sum += a; n++; }
        }
        row['AVG'] = n > 0 ? Number((sum / n).toFixed(2)) : '';
        row['SUBMITTED'] = j.final_submitted_at ? 'Y' : '';
        return row;
      });
      // 진출자별 온라인 평균 요약 행.
      const avgRow: Record<string, string | number> = { '#': '', JUDGE: '온라인 평균' };
      for (const f of finalists) {
        const st = finalistStats.get(f.num);
        avgRow[`${f.num} ${f.team_name}`] = st && st.n > 0 ? Number((st.sum / st.n).toFixed(2)) : '';
      }
      avgRow['AVG'] = ''; avgRow['SUBMITTED'] = '';

      const ws = XLSX.utils.json_to_sheet([avgRow, ...data], { header });
      ws['!cols'] = [{ wch: 6 }, { wch: 20 }, ...finalists.map(() => ({ wch: 12 })), { wch: 8 }, { wch: 10 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'OnlineFinal');
      const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${contestId}-online-final-results.xlsx`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Excel export 실패');
    } finally {
      setExporting(false);
    }
  }

  // ── 결승 결과 확정 (판정단+온라인 가중 결합) ──────────────
  function runCommit(tieExclude?: string[]) {
    setError(null); setActionMsg(null);
    const hasExclude = Array.isArray(tieExclude) && tieExclude.length > 0;
    startTransition(async () => {
      const res = await fetch(`${apiBase}/commit`, {
        method: 'POST',
        headers: hasExclude ? { 'Content-Type': 'application/json' } : undefined,
        body: hasExclude ? JSON.stringify({ tieExclude }) : undefined,
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? `확정 실패 (${res.status})`);
        return;
      }
      const j = await res.json();
      const lc = j.data?.confirmedLeaders ?? 0;
      const fc = j.data?.confirmedFollowers ?? 0;
      const src = [j.data?.usedPanel ? '판정단' : null, j.data?.usedOnline ? '온라인' : null].filter(Boolean).join('+') || '없음';
      setActionMsg(`결승 결과 확정 완료 — 시상 리더 ${lc} · 팔로워 ${fc} (반영: ${src})`);
    });
  }

  function commitFinal() {
    if (!confirm('결승 결과를 확정할까요?\n\n판정단 + 온라인 심사위원 점수를 가중 결합해 결승 결과(1~3위)를 산출합니다. 기존 결과는 덮어씁니다.')) return;
    runCommit();
  }

  // 동점 추려내기 — dryRun 으로 시상 경계 동점 그룹을 받아 모달로 선택.
  function openTieModal() {
    setError(null); setActionMsg(null);
    startTransition(async () => {
      const res = await fetch(`${apiBase}/commit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dryRun: true }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); setError(j.error ?? `조회 실패 (${res.status})`); return; }
      const j = await res.json();
      const groups = (j.data?.groups ?? []) as TieGroup[];
      if (groups.length === 0) {
        setActionMsg('시상(1~3위) 경계 동점이 없습니다. [결승 결과 확정]을 바로 눌러도 됩니다.');
        return;
      }
      const pick: Record<string, boolean> = {};
      for (const g of groups) g.candidates.forEach((c, i) => { pick[c.num] = i < g.slots; });
      setTiePick(pick);
      setTieModal(groups);
    });
  }

  function applyTie() {
    if (!tieModal) return;
    const exclude: string[] = [];
    for (const g of tieModal) for (const c of g.candidates) if (!tiePick[c.num]) exclude.push(c.num);
    setTieModal(null);
    runCommit(exclude);
  }

  // 시뮬레이션 (Prep 전용) — 온라인 심사위원 × 진출자 랜덤 점수 자동 채움.
  function simulate() {
    if (!confirm('온라인 심사위원 전원에게 결승 진출자 랜덤 점수를 자동 입력할까요? (테스트용 · 기존 온라인 점수 덮어씀)')) return;
    setError(null); setActionMsg(null);
    startTransition(async () => {
      const res = await fetch(`${apiBase}/simulate`, { method: 'POST' });
      if (!res.ok) { const j = await res.json().catch(() => ({})); setError(j.error ?? `시뮬레이션 실패 (${res.status})`); return; }
      const j = await res.json();
      setActionMsg(`시뮬레이션 완료 — ${j.data?.judges ?? 0}명 × ${j.data?.finalists ?? 0}명 = ${j.data?.cells ?? 0}칸 입력`);
      await refreshData();
    });
  }

  // 제출 해제 — 관리자가 특정 온라인 심사위원의 제출 잠금을 푼다.
  function releaseSubmit(judgeId: string) {
    if (!confirm('이 온라인 심사위원의 제출을 해제할까요? (심사위원이 다시 수정/제출할 수 있습니다)')) return;
    setError(null); setActionMsg(null);
    startTransition(async () => {
      const res = await fetch(`${apiBase}/submit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ judgeId, submitted: false }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? `제출 해제 실패 (${res.status})`);
        return;
      }
      setJudges((s) => s.map((x) => (x.id === judgeId ? { ...x, final_submitted_at: null } : x)));
      setActionMsg('제출을 해제했습니다.');
    });
  }

  const setPageClamped = (p: number) => setPage(Math.max(1, Math.min(totalPages, p)));

  // 제출 완료 행의 녹색 톤 — sticky 셀은 불투명이어야 스크롤 시 뒤가 안 비침.
  const SUBMITTED_STICKY_BG = '#16261C'; // panel(#1F2030) 위 녹색 틴트(불투명)

  return (
    <div className="space-y-4">
      {!onlineEnabled && (
        <div className="rounded border border-accent/40 bg-accent/5 px-4 py-2 text-sm text-accent">
          이 대회는 “온라인 심사위원 사용”이 꺼져 있습니다. 대회 정보에서 켜면 최종 결과에 반영됩니다. (점수 입력은 가능)
        </div>
      )}

      <section className="rounded border border-border bg-panel">
        <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-bg2/50 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold mr-1">Online Final Judging</h3>
            <Badge tone="info">{judges.length} online judges</Badge>
            <Badge tone="neutral">{finalists.length} finalists</Badge>
            {submittedCount > 0 && <Badge tone="ok">{submittedCount} 제출완료</Badge>}
            <Badge tone="neutral">
              {activeDefs.length} 활성 항목 · {activeDefs.map((d) => d.label).join(' / ')}
            </Badge>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* 제출률 — submit 한 심사위원 비율(%) */}
            <div
              className="flex items-center gap-2 rounded border border-border bg-bg2/40 px-3 py-1.5"
              title={`제출 완료 ${submittedCount}명 / 전체 ${judges.length}명`}
            >
              <span className="text-[10px] uppercase tracking-wider text-ink2">제출률</span>
              <span className={`font-mono text-base font-semibold ${submittedCount > 0 ? 'text-ok' : 'text-ink2'}`}>
                {submitPct}%
              </span>
              <span className="font-mono text-xs text-ink2/70">{submittedCount}/{judges.length}</span>
            </div>
            <Input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(1); }}
              placeholder="심사위원 이름/번호 검색"
              className="w-44"
            />
            <Button onClick={refreshData} disabled={busy}>↻ 새로고침</Button>
            <label
              className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded border cursor-pointer ${
                autoRefresh ? 'border-accent text-accent' : 'border-border text-ink2'
              }`}
              title={autoRefresh ? '자동 새로고침 켜짐 (5초)' : '자동 새로고침 꺼짐'}
            >
              <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
              자동 5초
            </label>
            {finalStatus === 'prep' && (
              <Button onClick={simulate} disabled={busy || judges.length === 0 || finalists.length === 0}>🎲 시뮬레이션</Button>
            )}
            <Button onClick={openTieModal} disabled={busy || finalists.length === 0}>🏳 동점 추려내기</Button>
            <Button variant="primary" onClick={commitFinal} disabled={busy || finalists.length === 0}>✓ 결승 결과 확정</Button>
            <Button variant="danger" onClick={resetAll} disabled={busy || votes.length === 0}>↺ 초기화</Button>
            <Button onClick={exportExcel} disabled={exporting || judges.length === 0 || finalists.length === 0}>
              {exporting ? 'Exporting…' : '⬇ Excel'}
            </Button>
          </div>
        </header>

        <div className="px-4 py-1.5 text-xs text-ink2 border-b border-border bg-bg2/20">
          행 = 온라인 심사위원 · 열 = 결승 진출자 · 셀 = 항목별 점수(입력 시 자동 저장)
        </div>

        {error && (
          <div className="px-4 py-2 text-sm text-danger bg-danger/5 border-b border-danger/20" role="alert">{error}</div>
        )}
        {actionMsg && (
          <div className="px-4 py-2 text-sm text-ok bg-ok/5 border-b border-ok/20">{actionMsg}</div>
        )}

        {finalists.length === 0 ? (
          <p className="text-center text-ink2 py-10">결승 진출자가 없습니다. 본선 통과자를 먼저 확정하세요.</p>
        ) : judges.length === 0 ? (
          <p className="text-center text-ink2 py-10">등록된 온라인 심사위원이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-sm border-collapse">
              <thead className="bg-bg2 text-ink2 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-3 py-2 sticky left-0 bg-bg2 z-10 min-w-[13rem]">Online Judge</th>
                  {finalists.map((f) => (
                    <th key={f.num} className="text-center px-3 py-2 min-w-[9rem] border-l border-border">
                      <div className="flex items-center justify-center gap-1.5">
                        <span className="font-mono text-ink2/70">{f.num}</span>
                        <span className="truncate max-w-[6rem] normal-case">{f.team_name}</span>
                        <Badge tone={f.role === 'leader' ? 'info' : 'neutral'}>{f.role === 'leader' ? 'L' : 'F'}</Badge>
                      </div>
                    </th>
                  ))}
                  <th className="text-center px-3 py-2 min-w-[5rem] border-l border-border">심사위원<br />평균</th>
                </tr>
                {/* 진출자별 온라인 평균(전체 기준) */}
                <tr className="text-ink2">
                  <th className="text-left px-3 py-1.5 sticky left-0 bg-bg2 z-10 normal-case font-normal">온라인 평균 (전체)</th>
                  {finalists.map((f) => {
                    const st = finalistStats.get(f.num);
                    return (
                      <th key={f.num} className="text-center px-3 py-1.5 border-l border-border font-mono font-normal">
                        {st && st.n > 0
                          ? <span className="text-ok">{(st.sum / st.n).toFixed(2)}</span>
                          : <span className="text-ink2/40">—</span>}
                      </th>
                    );
                  })}
                  <th className="border-l border-border" />
                </tr>
              </thead>
              <tbody>
                {pageJudges.map((j) => {
                  let jSum = 0, jN = 0;
                  for (const f of finalists) { const a = rowAvg(voteMap.get(`${j.id}:${f.num}`)); if (a != null) { jSum += a; jN++; } }
                  const submitted = Boolean(j.final_submitted_at);
                  // 제출 완료 행 전체 녹색. sticky 셀은 불투명 톤으로 별도 지정.
                  const cellBg = submitted ? 'bg-ok/10' : '';
                  return (
                    <tr key={j.id} className={`border-t ${submitted ? 'border-ok/40' : 'border-border'}`}>
                      <td
                        className={`px-3 py-2 sticky left-0 z-10 ${submitted ? '' : 'bg-panel'}`}
                        style={submitted ? { background: SUBMITTED_STICKY_BG } : undefined}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-ink2 shrink-0">#{j.display_order}</span>
                          <span className="whitespace-nowrap">{judgeLabel(j)}</span>
                          {submitted ? (
                            <button
                              type="button"
                              onClick={() => releaseSubmit(j.id)}
                              disabled={busy}
                              suppressHydrationWarning
                              className="shrink-0 ml-1 text-[10px] px-1.5 py-0.5 rounded border border-ok/60 bg-ok/15 text-ok hover:bg-ok/25 leading-none"
                              title={`제출 완료 · ${fmtTs(j.final_submitted_at as string)} — 클릭하면 해제`}
                            >
                              ✓ 제출완료 · 해제
                            </button>
                          ) : (
                            <span className="shrink-0 ml-1 text-[10px] text-ink2/40">채점 중</span>
                          )}
                        </div>
                      </td>
                      {finalists.map((f) => {
                        const row = voteMap.get(`${j.id}:${f.num}`);
                        return (
                          <td key={f.num} className={`px-2 py-2 border-l border-border align-top ${cellBg}`}>
                            <div className="flex flex-col gap-1">
                              {activeDefs.map((def) => (
                                <label key={def.key} className="flex items-center gap-1 text-[10px] text-ink2/70">
                                  <span className="w-10 shrink-0">{def.shortLabel}</span>
                                  <Input
                                    type="number" min={0} max={999} step="0.1"
                                    defaultValue={row?.[def.column] ?? ''}
                                    onBlur={(e) => {
                                      const cur = row?.[def.column] ?? null;
                                      const next = e.target.value.trim() === '' ? null : Number(e.target.value);
                                      if (cur === next) return;
                                      saveCell(j.id, f.num, def.column, e.target.value);
                                    }}
                                    className="w-16 font-mono text-center"
                                  />
                                </label>
                              ))}
                            </div>
                          </td>
                        );
                      })}
                      <td className={`px-3 py-2 border-l border-border text-center font-mono ${cellBg} ${submitted ? 'text-ok' : ''}`}>
                        {jN > 0 ? (jSum / jN).toFixed(2) : <span className="text-ink2/40">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 심사위원(행) 페이지네이션 */}
        {judges.length > 0 && finalists.length > 0 && (
          <footer className="flex items-center justify-between gap-3 px-4 py-3 border-t border-border bg-bg2/30 flex-wrap">
            <span className="text-xs text-ink2 font-mono">
              심사위원 {(safePage - 1) * JUDGES_PER_PAGE + 1}–{Math.min(filteredJudges.length, safePage * JUDGES_PER_PAGE)} / {filteredJudges.length}
              {' · '}Page {safePage} / {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <Button onClick={() => setPageClamped(safePage - 1)} disabled={safePage <= 1}>‹ Prev</Button>
              <Button onClick={() => setPageClamped(safePage + 1)} disabled={safePage >= totalPages}>Next ›</Button>
            </div>
          </footer>
        )}
      </section>

      {/* 동점 추려내기 모달 — 시상(1~3위) 경계 동점자 중 시상 포함 대상 선택 */}
      {tieModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setTieModal(null)}
        >
          <div className="w-full max-w-lg rounded-lg border border-border bg-panel shadow-xl" onClick={(e) => e.stopPropagation()}>
            <header className="px-4 py-3 border-b border-border">
              <h4 className="text-sm font-semibold">🏳 동점 추려내기 — 시상(1~3위) 경계</h4>
              <p className="text-xs text-ink2 mt-1">
                같은 결합 점수로 시상 경계에 걸친 후보입니다. 시상에 포함할 후보를 체크하세요(정원만큼). 체크 안 된 후보는 순위에서 뒤로 밀립니다.
              </p>
            </header>
            <div className="max-h-[60vh] overflow-y-auto px-4 py-3 space-y-4">
              {tieModal.map((g) => {
                const picked = g.candidates.filter((c) => tiePick[c.num]).length;
                return (
                  <div key={g.role} className="rounded border border-border p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold">{g.role === 'leader' ? 'Leader' : 'Follower'}</span>
                      <span className={`text-xs font-mono ${picked === g.slots ? 'text-ok' : 'text-accent'}`}>
                        시상 포함 {picked} / {g.slots} · 동점 {g.tieScore}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {g.candidates.map((c) => (
                        <label key={c.num} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!tiePick[c.num]}
                            onChange={() => setTiePick((s) => ({ ...s, [c.num]: !s[c.num] }))}
                            className="w-4 h-4 accent-accent"
                          />
                          <span className="font-mono text-ink2">{c.num}</span>
                          <span>{c.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <footer className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border">
              <Button onClick={() => setTieModal(null)}>취소</Button>
              <Button variant="primary" onClick={applyTie}>선택대로 확정</Button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
