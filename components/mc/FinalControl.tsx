// 결승 컨트롤 — 결승 채점 확정(시상 동점 추려내기) + 1·2·3위 결과 + 결과/시상 표출. (요구 6·7)
//   순위/동점은 StandingsProvider 가 5초마다 폴링한 값을 공유한다(상단 배너와 동일).
'use client';

import { useCallback, useEffect, useState } from 'react';
import type { FinalResultRow } from '@/lib/db/types';
import type { RoleStanding, StandingEntry } from '@/lib/judging/standings';
import { Btn, Card, StatusLine, adminFetch, useMcAction } from './ui';
import { roleLabel, useStandings } from './standingsContext';

const RANK_MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

export function FinalControl({ contestId }: { contestId: string }) {
  const { data: standings, loading, updatedAt, reload, ties, tieCount, openTie } = useStandings();
  const [results, setResults] = useState<FinalResultRow[] | null>(null);
  const { pending, error, message, run } = useMcAction();

  const cbase = `/api/admin/contests/${encodeURIComponent(contestId)}/judging/final`;
  const finalsUrl = `/api/admin/contests/${encodeURIComponent(contestId)}/finals`;
  const dispUrl = `/api/admin/contests/${encodeURIComponent(contestId)}/display-state`;

  // 확정된 1·2·3위 — 순위 폴링과 별개로 final_results 를 읽는다.
  const loadResults = useCallback(async () => {
    const fr = await adminFetch<FinalResultRow[]>(finalsUrl);
    setResults(fr);
  }, [finalsUrl]);

  useEffect(() => {
    loadResults().catch(() => setResults([]));
  }, [loadResults]);

  // 순위가 갱신될 때(= 새 점수 반영/확정 직후)마다 결과표도 같이 맞춘다.
  useEffect(() => {
    if (updatedAt == null) return;
    loadResults().catch(() => {});
  }, [updatedAt, loadResults]);

  const commit = () =>
    run(async () => {
      await adminFetch(`${cbase}/commit`, { method: 'POST' });
      await Promise.all([reload(), loadResults()]);
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

  const refresh = () => run(async () => { await Promise.all([reload(), loadResults()]); return '조회 완료'; });

  const podium = (role: 'leader' | 'follower') =>
    (results ?? [])
      .filter((r) => r.role === role && r.final_rank != null)
      .sort((a, b) => (a.final_rank ?? 99) - (b.final_rank ?? 99));

  return (
    <>
      {/* 시상 동점 추려내기 — 동점이면 가장 먼저 눈에 들어오게. */}
      {ties.length > 0 && (
        <section className="rounded-2xl border-2 border-danger/60 bg-danger/10 p-4">
          <h2 className="text-sm font-semibold text-danger">⚠ 시상 경계 동점 {tieCount}명</h2>
          <div className="mt-2 space-y-1">
            {ties.map((role) => (
              <p key={role.role} className="text-xs text-ink2">
                {roleLabel(role.role)} — 동점 {role.tie!.candidates.length}명 중{' '}
                <span className="text-accent font-semibold">{role.tie!.slots}자리</span> ·{' '}
                {role.entries
                  .filter((e) => e.boundaryTie)
                  .map((e) => `${e.num} ${e.name}`)
                  .join(', ')}
              </p>
            ))}
          </div>
          <Btn variant="primary" onClick={openTie} className="w-full mt-3">
            ⚖ 동점 추려내기 (시상자 고르기)
          </Btn>
          <p className="text-[10px] text-ink2 mt-2">합의된 사람을 통과로 두고 저장하면 그대로 확정됩니다</p>
        </section>
      )}

      {/* 결과 (1·2·3위) */}
      <Card
        title="결승 결과 / Final"
        right={
          <span className="flex items-center gap-2 text-[10px] text-ink2">
            {loading ? '갱신중…' : updatedAt ? new Date(updatedAt).toLocaleTimeString('ko-KR', { hour12: false }) : ''}
            <button
              type="button"
              onClick={refresh}
              disabled={pending}
              className="text-[11px] text-accent font-mono active:opacity-60 disabled:opacity-40"
            >
              ↻ 조회
            </button>
          </span>
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
                <p className="text-[10px] uppercase tracking-widest text-ink2 mb-1">{roleLabel(role)}</p>
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
          ✓ 결승 결과 확정 (Commit){ties.length ? ' · 동점 전원 시상' : ''}
        </Btn>
        {ties.length > 0 && (
          <p className="text-[10px] text-danger text-center -mt-1">
            그냥 확정하면 동점자가 모두 시상권에 들어갑니다 — 위의 동점 추려내기를 쓰세요
          </p>
        )}
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
      {e.passed ? (
        <span className="text-ok text-[10px] font-semibold w-8 text-right">시상</span>
      ) : e.boundaryTie ? (
        <span className="text-accent text-[10px] font-semibold w-8 text-right">동점</span>
      ) : (
        <span className="w-8" />
      )}
    </div>
  );
}
