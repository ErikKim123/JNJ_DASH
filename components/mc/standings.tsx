// MC 순위/동점 폴링 Provider — 5초마다 standings 를 조회해 배너·심사탭·동점 모달에 공급한다.
//   "심사위원이 점수를 넣으면 MC 화면에 저절로 반영" 이 목적 (수동 ↻ 조회도 유지).
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RoundKey } from '@/lib/sheets/types';
import type { RoleStanding } from '@/lib/judging/standings';
import { adminFetch } from './ui';
import { StandingsCtx, type StandingsCtxValue, type StandingsResp } from './standingsContext';
import { TieResolveModal } from './TieResolveModal';

const POLL_MS = 5000;

export function StandingsProvider({
  contestId,
  round,
  children,
}: {
  contestId: string;
  round: RoundKey;
  children: React.ReactNode;
}) {
  const [data, setData] = useState<StandingsResp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [auto, setAuto] = useState(true);
  const [tieOpen, setTieOpen] = useState(false);

  // 라운드가 바뀐 뒤 도착한 이전 라운드 응답을 버리기 위한 최신값 참조.
  const roundRef = useRef(round);
  roundRef.current = round;

  const reload = useCallback(async (): Promise<StandingsResp | null> => {
    const want = round;
    setLoading(true);
    try {
      const d = await adminFetch<StandingsResp>(
        `/api/admin/contests/${encodeURIComponent(contestId)}/judging/${want}/standings`
      );
      if (roundRef.current !== want) return null; // 늦게 온 이전 라운드 응답 — 폐기
      setData(d);
      setError(null);
      setUpdatedAt(Date.now());
      return d;
    } catch (e) {
      if (roundRef.current === want) setError(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      setLoading(false);
    }
  }, [contestId, round]);

  // 라운드 전환 — 이전 라운드 숫자가 잠깐이라도 보이지 않게 비우고 즉시 재조회.
  useEffect(() => {
    setData(null);
    setUpdatedAt(null);
    setTieOpen(false);
    void reload();
  }, [reload]);

  // 자동 조회 — 최신 reload 를 ref 로 잡아 interval 재생성 없이 최신 클로저 호출.
  const reloadRef = useRef(reload);
  reloadRef.current = reload;
  useEffect(() => {
    if (!auto) return;
    const id = setInterval(() => { void reloadRef.current(); }, POLL_MS);
    return () => clearInterval(id);
  }, [auto]);

  // 화면이 다시 앞으로 오면(탭 전환·잠금 해제) 즉시 한 번 조회.
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') void reloadRef.current(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const value = useMemo<StandingsCtxValue>(() => {
    const roles: RoleStanding[] = data ? [data.leader, data.follower] : [];
    const ties = roles.filter((r) => r.tie && r.tie.candidates.length > 1);
    const count = (r?: RoleStanding) => ({
      live: r ? r.entries.filter((e) => e.scored && e.inQuota).length : 0,
      confirmed: r ? r.entries.filter((e) => e.passed).length : 0,
    });
    const counts = { leader: count(data?.leader), follower: count(data?.follower) };
    const max = data?.maxPerRole ?? 0;
    return {
      round,
      data,
      error,
      loading,
      updatedAt,
      auto,
      setAuto,
      reload,
      ties,
      tieCount: ties.reduce((n, r) => n + (r.tie?.candidates.length ?? 0), 0),
      counts,
      overQuota: !!data && !data.committed && (counts.leader.live > max || counts.follower.live > max),
      tieOpen,
      openTie: () => setTieOpen(true),
      closeTie: () => setTieOpen(false),
    };
  }, [round, data, error, loading, updatedAt, auto, reload, tieOpen]);

  return (
    <StandingsCtx.Provider value={value}>
      {children}
      {tieOpen && <TieResolveModal contestId={contestId} />}
    </StandingsCtx.Provider>
  );
}
