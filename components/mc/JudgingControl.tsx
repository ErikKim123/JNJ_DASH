// 심사·확정 컨트롤 (예선/본선 공용) — 실시간 순위 + 경계 동점 추려내기 + 통과자 확정. (요구 3·5)
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Btn, Card, StatusLine, adminFetch, useMcAction } from './ui';
import type { RoleStanding, StandingEntry } from '@/lib/judging/standings';

type PairRound = 'prelim' | 'semi';

interface StandingsResp {
  round: PairRound;
  maxPerRole: number;
  leader: RoleStanding;
  follower: RoleStanding;
  committed: boolean;
}

export function JudgingControl({ contestId, round }: { contestId: string; round: PairRound }) {
  const [data, setData] = useState<StandingsResp | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { pending, error, message, run } = useMcAction();
  const cbase = `/api/admin/contests/${encodeURIComponent(contestId)}/judging/${round}`;

  const load = useCallback(async () => {
    const d = await adminFetch<StandingsResp>(`${cbase}/standings`);
    setData(d);
    // 동점 후보의 추천 preselect 로 선택 초기화.
    const init = new Set<string>();
    for (const role of [d.leader, d.follower]) {
      if (role.tie) role.tie.suggested.forEach((n) => init.add(n));
    }
    setSelected(init);
    return d;
  }, [cbase]);

  useEffect(() => {
    load().catch(() => setData(null));
  }, [load]);

  const ties = useMemo(() => {
    if (!data) return [];
    return ([data.leader, data.follower] as RoleStanding[]).filter((r) => r.tie);
  }, [data]);

  const toggle = (num: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(num)) next.delete(num);
      else next.add(num);
      return next;
    });

  const commit = () =>
    run(async () => {
      const tieExclude: string[] = [];
      for (const role of [data!.leader, data!.follower]) {
        if (role.tie) role.tie.candidates.forEach((n) => { if (!selected.has(n)) tieExclude.push(n); });
      }
      const res = await adminFetch<{ confirmedLeaders: number; confirmedFollowers: number }>(
        `${cbase}/commit`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tieExclude }),
        }
      );
      await load();
      return `통과 확정 — 리더 ${res.confirmedLeaders} · 팔로워 ${res.confirmedFollowers}`;
    });

  const uncommit = () =>
    run(async () => {
      await adminFetch(`${cbase}/uncommit`, { method: 'POST' });
      await load();
      return '확정 취소 완료';
    });

  if (!data) {
    return <Card title="심사 순위">{error ? <StatusLine tone="danger">{error}</StatusLine> : <p className="text-sm text-ink2">불러오는 중…</p>}</Card>;
  }

  return (
    <>
      <Card
        title={`심사 순위 · 정원 역할별 ${data.maxPerRole}`}
        right={
          <button type="button" onClick={() => load().catch(() => {})} className="text-[11px] text-accent font-mono active:opacity-60">
            ↻ 조회
          </button>
        }
      >
        <RoleTable label="리더 / Leader" role={data.leader} />
        <div className="h-3" />
        <RoleTable label="팔로워 / Follower" role={data.follower} />
      </Card>

      {/* 동점 추려내기 */}
      {ties.length > 0 && (
        <Card title="동점 추려내기 / Tie-break">
          {ties.map((role) => (
            <div key={role.role} className="mb-3 last:mb-0">
              <p className="text-xs text-ink2 mb-2">
                {role.role === 'leader' ? '리더' : '팔로워'} — 동점 {role.tie!.candidates.length}명 중{' '}
                <span className="text-accent font-semibold">{role.tie!.slots}자리</span> · 선택{' '}
                <span className={selectedCountFor(role, selected) === role.tie!.slots ? 'text-ok' : 'text-danger'}>
                  {selectedCountFor(role, selected)}
                </span>
              </p>
              <div className="flex flex-wrap gap-2">
                {role.entries
                  .filter((e) => e.boundaryTie)
                  .map((e) => {
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
                        {e.headO ? <span className="ml-1" title="헤드 심사 O">★</span> : null}
                        <span className="ml-1 text-[10px] opacity-80">({e.value}표)</span>
                      </button>
                    );
                  })}
              </div>
            </div>
          ))}
          <p className="text-[10px] text-ink2 mt-1">★ = 헤드(타이브레이커) 심사위원이 O를 준 후보</p>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-2">
        <Btn variant="primary" onClick={commit} disabled={pending}>
          ✓ 통과자 확정 (Commit){ties.length ? ' · 동점 반영' : ''}
        </Btn>
        {data.committed && (
          <Btn variant="danger" onClick={uncommit} disabled={pending}>
            확정 취소 (Uncommit)
          </Btn>
        )}
      </div>

      {pending && <StatusLine>처리 중…</StatusLine>}
      {message && !error && <StatusLine tone="ok">{message}</StatusLine>}
      {error && <StatusLine tone="danger">{error}</StatusLine>}
    </>
  );
}

function selectedCountFor(role: RoleStanding, selected: Set<string>): number {
  if (!role.tie) return 0;
  return role.tie.candidates.filter((n) => selected.has(n)).length;
}

function RoleTable({ label, role }: { label: string; role: RoleStanding }) {
  const passedCount = role.entries.filter((e) => e.passed).length;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold">{label}</span>
        <span className="text-[10px] text-ink2">통과 {passedCount}</span>
      </div>
      <div className="space-y-0.5">
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
      {e.headO ? <span className="text-accent" title="헤드 심사 O">★</span> : null}
      <span className="font-mono w-10 text-right">{e.value}표</span>
      {e.passed ? (
        <span className="text-ok text-[10px] font-semibold w-8 text-right">통과</span>
      ) : e.boundaryTie ? (
        <span className="text-accent text-[10px] font-semibold w-8 text-right">동점</span>
      ) : (
        <span className="w-8" />
      )}
    </div>
  );
}
