// MC 동점 추려내기 모달 — 경계 동점 후보를 "통과 / 탈락" 버튼으로 정하고 그대로 확정한다.
//   (관리자 JudgingMatrix 동점 모달의 모바일판)
//   심사위원끼리 말로 합의된 결과를 MC 가 이 화면에서 눌러 확정 → commit(tieExclude) 로 전송.
'use client';

import { useMemo, useState } from 'react';
import type { StandingEntry } from '@/lib/judging/standings';
import { adminFetch } from './ui';
import { roleLabel, tieUnit, useStandings } from './standingsContext';

export function TieResolveModal({ contestId }: { contestId: string }) {
  const { round, ties, reload, closeTie } = useStandings();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  // 열릴 때의 추천안(헤드 심사 O → num 순)으로 초기 선택. 이후는 운영자 손끝이 진실.
  const [pick, setPick] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const role of ties) for (const num of role.tie!.suggested) init[num] = true;
    return init;
  });

  const groups = useMemo(
    () =>
      ties.map((role) => ({
        role: role.role,
        candidates: role.entries.filter((e) => e.boundaryTie),
        slots: role.tie!.slots,
      })),
    [ties]
  );

  const selectedIn = (g: { candidates: StandingEntry[] }) =>
    g.candidates.filter((c) => pick[c.num]).length;

  const toggle = (g: { candidates: StandingEntry[]; slots: number }, num: string) => {
    setDone(null);
    setPick((prev) => {
      const on = !!prev[num];
      if (!on && g.candidates.filter((c) => prev[c.num]).length >= g.slots) return prev; // 자리 초과 방지
      return { ...prev, [num]: !on };
    });
  };

  const apply = async () => {
    setPending(true);
    setError(null);
    try {
      // 선택되지 않은 동점 후보 = 탈락 → tieExclude 로 확정.
      const tieExclude: string[] = [];
      for (const g of groups) for (const c of g.candidates) if (!pick[c.num]) tieExclude.push(c.num);
      const res = await adminFetch<{ confirmedLeaders?: number; confirmedFollowers?: number }>(
        `/api/admin/contests/${encodeURIComponent(contestId)}/judging/${round}/commit`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tieExclude }),
        }
      );
      await reload();
      setDone(
        round === 'final'
          ? '결승 시상 확정 완료'
          : `통과 확정 — 리더 ${res?.confirmedLeaders ?? 0} · 팔로워 ${res?.confirmedFollowers ?? 0}`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  };

  const unit = tieUnit(round);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mc-tie-title"
      onClick={() => { if (!pending) closeTie(); }}
    >
      <div
        className="w-full sm:max-w-md max-h-[92vh] overflow-auto rounded-t-2xl sm:rounded-2xl border-2 border-accent/60 bg-panel p-4 pb-6 shadow-2xl shadow-black/60"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="mc-tie-title" className="text-base font-semibold text-accent">
          ⚖ 경계 동점 추려내기
        </h3>
        <p className="text-[11px] text-ink2 mt-1 mb-3 leading-relaxed">
          {round === 'final' ? '결승 시상(top 3)' : '통과 정원'} 경계에서 같은 {unit}로 묶여 자리보다 인원이 많습니다.
          합의된 사람을 <span className="text-ok font-semibold">통과</span>로 두고 저장하면 그대로 확정됩니다.
        </p>

        {groups.length === 0 && (
          <p className="text-sm text-ink2 py-6 text-center">동점이 해소되었습니다.</p>
        )}

        <div className="space-y-4">
          {groups.map((g) => {
            const sel = selectedIn(g);
            const tieScore = g.candidates[0]?.value ?? 0;
            return (
              <div key={g.role} className="rounded-xl border border-border bg-bg2/40 p-3">
                <div className="flex items-center justify-between mb-2 gap-2">
                  <span className="text-sm font-semibold">
                    {roleLabel(g.role)} · 동점 {tieScore}
                    {unit}
                  </span>
                  <span className={`text-[11px] font-mono ${sel === g.slots ? 'text-ok' : 'text-danger'}`}>
                    통과 {sel} / {g.slots}
                  </span>
                </div>
                <ul className="space-y-1.5">
                  {g.candidates.map((c, i) => {
                    const on = !!pick[c.num];
                    const atCap = !on && sel >= g.slots;
                    return (
                      <li
                        key={c.num}
                        className={`flex items-center gap-2 rounded-lg border px-2 py-2 ${
                          on ? 'border-ok/50 bg-ok/10' : 'border-border bg-bg2/60'
                        }`}
                      >
                        <span className="w-4 text-center font-mono text-[11px] text-ink2/60">{i + 1}</span>
                        <span className="font-mono text-xs text-ink2 w-9">{c.num}</span>
                        <span className="flex-1 truncate text-sm">{c.name}</span>
                        {c.headO && (
                          <span className="text-accent text-[11px]" title="헤드(타이브레이커) 심사위원 O">
                            👑O
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => toggle(g, c.num)}
                          disabled={pending || atCap}
                          aria-pressed={on}
                          className={`min-h-[40px] w-[76px] shrink-0 rounded-lg border text-xs font-semibold transition disabled:opacity-30 ${
                            on
                              ? 'border-ok bg-ok/20 text-ok active:bg-ok/30'
                              : 'border-border bg-panel text-danger active:bg-bg2'
                          }`}
                        >
                          {on ? '✓ 통과' : '탈락'}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {sel < g.slots && (
                  <p className="text-[10px] text-danger mt-2">
                    자리가 {g.slots - sel}개 남았습니다 — 통과시킬 사람을 더 고르세요
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {error && <p className="text-xs text-danger mt-3">{error}</p>}
        {done && <p className="text-xs text-ok mt-3">✓ {done}</p>}

        <div className="flex gap-2 mt-4">
          <button
            type="button"
            onClick={closeTie}
            disabled={pending}
            className="flex-1 min-h-[52px] rounded-xl border border-border bg-panel text-sm font-semibold text-ink2 active:bg-bg2 disabled:opacity-40"
          >
            {done ? '닫기' : '취소'}
          </button>
          {!done && (
            <button
              type="button"
              onClick={apply}
              disabled={pending || groups.length === 0}
              className="flex-[1.4] min-h-[52px] rounded-xl border border-accent bg-accent text-[#1A1612] text-sm font-semibold active:bg-accent2 disabled:opacity-40"
            >
              {pending ? '저장 중…' : '✓ 통과 확정 (저장)'}
            </button>
          )}
        </div>
        {!done && (
          <p className="text-[10px] text-ink2 mt-2 text-center">
            저장하면 통과로 둔 사람만 {round === 'final' ? '시상' : '통과자'}에 반영되고 나머지는 탈락 처리됩니다
          </p>
        )}
      </div>
    </div>
  );
}
