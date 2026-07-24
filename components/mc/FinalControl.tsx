// 결승 컨트롤 — 결승 채점 확정(시상 동점 추려내기) + 1·2·3위 결과 + 결과/시상 표출. (요구 6·7)
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FinalResultRow } from '@/lib/db/types';
import type { RoleStanding, StandingEntry } from '@/lib/judging/standings';
import { Btn, Card, StatusLine, adminFetch, useMcAction } from './ui';

interface StandingsResp {
  round: 'final';
  maxPerRole: number;
  leader: RoleStanding;
  follower: RoleStanding;
  committed: boolean;
}

const RANK_MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

export function FinalControl({ contestId }: { contestId: string }) {
  const [standings, setStandings] = useState<StandingsResp | null>(null);
  const [results, setResults] = useState<FinalResultRow[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { pending, error, message, run } = useMcAction();

  const cbase = `/api/admin/contests/${encodeURIComponent(contestId)}/judging/final`;
  const finalsUrl = `/api/admin/contests/${encodeURIComponent(contestId)}/finals`;
  const dispUrl = `/api/admin/contests/${encodeURIComponent(contestId)}/display-state`;

  const load = useCallback(async () => {
    const [s, fr] = await Promise.all([
      adminFetch<StandingsResp>(`${cbase}/standings`),
      adminFetch<FinalResultRow[]>(finalsUrl),
    ]);
    setStandings(s);
    setResults(fr);
    const init = new Set<string>();
    for (const role of [s.leader, s.follower]) if (role.tie) role.tie.suggested.forEach((n) => init.add(n));
    setSelected(init);
  }, [cbase, finalsUrl]);

  useEffect(() => {
    load().catch(() => { setStandings(null); setResults([]); });
  }, [load]);

  const ties = useMemo(
    () => (standings ? ([standings.leader, standings.follower] as RoleStanding[]).filter((r) => r.tie) : []),
    [standings]
  );

  const toggle = (num: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(num)) next.delete(num); else next.add(num);
      return next;
    });

  const commit = () =>
    run(async () => {
      const tieExclude: string[] = [];
      for (const role of [standings!.leader, standings!.follower]) {
        if (role.tie) role.tie.candidates.forEach((n) => { if (!selected.has(n)) tieExclude.push(n); });
      }
      await adminFetch(`${cbase}/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tieExclude }),
      });
      await load();
      return '결승 결과 확정 완료';
    });

  const project = (step: 'result' | 'ceremony', doneMsg: string) =>
    run(async () => {
      await adminFetch(dispUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ round: 'final', step }),
      });
      return doneMsg;
    });

  const podium = (role: 'leader' | 'follower') =>
    (results ?? [])
      .filter((r) => r.role === role && r.final_rank != null)
      .sort((a, b) => (a.final_rank ?? 99) - (b.final_rank ?? 99));

  return (
    <>
      {/* 결과 (1·2·3위) */}
      <Card
        title="결승 결과 / Final"
        right={
          <button type="button" onClick={() => load().catch(() => {})} className="text-[11px] text-accent font-mono active:opacity-60">
            ↻ 조회
          </button>
        }
      >
        {!results ? (
          <p className="text-sm text-ink2">불러오는 중…</p>
        ) : results.length === 0 ? (
          <p className="text-sm text-ink2">아직 확정된 결과가 없습니다. 아래에서 확정하세요.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {(['leader', 'follower'] as const).map((role) => (
              <div key={role}>
                <p className="text-[10px] uppercase tracking-widest text-ink2 mb-1">
                  {role === 'leader' ? '리더' : '팔로워'}
                </p>
                <div className="space-y-1">
                  {podium(role).slice(0, 5).map((r) => (
                    <div key={r.id} className="flex items-center gap-1.5 text-xs">
                      <span className="w-5 text-center">{RANK_MEDAL[r.final_rank!] ?? r.final_rank}</span>
                      <span className="font-mono text-ink2">{r.participant_num}</span>
                      <span className="flex-1 truncate">{r.team_name}</span>
                      {r.total_score != null && <span className="font-mono text-ink2">{r.total_score}</span>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* 동점 추려내기 (시상 경계) */}
      {ties.length > 0 && (
        <Card title="시상 동점 추려내기">
          {ties.map((role) => (
            <div key={role.role} className="mb-3 last:mb-0">
              <p className="text-xs text-ink2 mb-2">
                {role.role === 'leader' ? '리더' : '팔로워'} — 동점 {role.tie!.candidates.length}명 중{' '}
                <span className="text-accent font-semibold">{role.tie!.slots}자리</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {role.entries.filter((e) => e.boundaryTie).map((e) => {
                  const on = selected.has(e.num);
                  return (
                    <button
                      key={e.num}
                      type="button"
                      onClick={() => toggle(e.num)}
                      className={`min-h-[44px] rounded-lg border px-3 text-xs font-semibold transition ${
                        on ? 'bg-accent text-[#1A1612] border-accent' : 'bg-bg2 text-ink2 border-border active:text-ink'
                      }`}
                    >
                      <span className="font-mono mr-1">{e.num}</span>
                      {e.name}
                      <span className="ml-1 text-[10px] opacity-80">({e.value}점)</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* 표준 순위 (점수) */}
      {standings && (
        <Card title="결승 점수 순위">
          <RoleTable label="리더 / Leader" role={standings.leader} />
          <div className="h-3" />
          <RoleTable label="팔로워 / Follower" role={standings.follower} />
        </Card>
      )}

      {/* 액션 */}
      <div className="grid grid-cols-1 gap-2">
        <Btn variant="primary" onClick={commit} disabled={pending || !standings}>
          ✓ 결승 결과 확정 (Commit){ties.length ? ' · 동점 반영' : ''}
        </Btn>
        <div className="grid grid-cols-2 gap-2">
          <Btn variant="ghost" onClick={() => project('result', '결과 화면 표출')} disabled={pending}>
            결과 표출
          </Btn>
          <Btn variant="ghost" onClick={() => project('ceremony', '시상 화면 표출')} disabled={pending}>
            시상 표출
          </Btn>
        </div>
      </div>

      {pending && <StatusLine>처리 중…</StatusLine>}
      {message && !error && <StatusLine tone="ok">{message}</StatusLine>}
      {error && <StatusLine tone="danger">{error}</StatusLine>}
    </>
  );
}

function RoleTable({ label, role }: { label: string; role: RoleStanding }) {
  return (
    <div>
      <span className="text-xs font-semibold">{label}</span>
      <div className="space-y-0.5 mt-1.5">
        {role.entries.map((e) => (
          <Row key={e.num} e={e} />
        ))}
        {role.entries.length === 0 && <p className="text-xs text-ink2 py-2">후보 없음</p>}
      </div>
    </div>
  );
}

function Row({ e }: { e: StandingEntry }) {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs ${
        e.boundaryTie ? 'bg-accent/10 border border-accent/40' : e.inQuota ? 'bg-bg2' : 'opacity-60'
      }`}
    >
      <span className="w-6 text-center font-mono text-ink2">{e.rank || '–'}</span>
      <span className="font-mono text-ink2 w-8">{e.num}</span>
      <span className="flex-1 truncate">{e.name}</span>
      <span className="font-mono w-12 text-right">{e.scored ? `${e.value}점` : '–'}</span>
    </div>
  );
}
