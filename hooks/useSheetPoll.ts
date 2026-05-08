// Design Ref: §6, §11.1 #12 — Live 스텝일 때만 폴링. Plan SC7 — 시트 변경 10초 내 반영.
'use client';

import { useEffect, useRef, useState } from 'react';
import { fetchStepData, type StepFetchResult } from '@/lib/api/client';
import type { RoundKey, StepKey } from '@/lib/sheets/types';

export interface SheetPollState {
  result: StepFetchResult | null;
  loading: boolean;
  error: string | null;
  /** 마지막 갱신 시각(epoch ms). LiveIndicator에서 "N초 전" 계산에 사용 */
  lastUpdated: number | null;
  /** 페어링 스냅샷을 무시하고 시트에서 재로드. Pairing 스텝에서만 의미 있음. */
  refresh: () => void;
}

export interface UseSheetPollOptions {
  contestId: string;
  round: RoundKey;
  step: StepKey;
  /** Live 스텝일 때 폴링 주기(ms). 기본 5초 (NFR-2 + SC7: 시트 변경 10초 내 반영 보장) */
  pollIntervalMs?: number;
}

// Plan SC7 — 폴링 5s + 캐시 5s = 최대 10s 반영 (정확히 명세 충족)
const DEFAULT_POLL_MS = 5000;

export function useSheetPoll({ contestId, round, step, pollIntervalMs = DEFAULT_POLL_MS }: UseSheetPollOptions): SheetPollState {
  const [state, setState] = useState<Omit<SheetPollState, 'refresh'>>({
    result: null,
    loading: true,
    error: null,
    lastUpdated: null,
  });

  // round/step이 자주 바뀌므로 effect cleanup 시 fetch abort
  const abortRef = useRef<AbortController | null>(null);
  // 수동 refresh 트리거 — 변경 시 useEffect 재실행
  const [refreshTick, setRefreshTick] = useState(0);
  const refreshOnceRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    setState((s) => ({ ...s, loading: true, error: null }));

    async function load() {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      // 첫 번째 load 호출에 한해 refresh 플래그 적용 (폴링 후속 호출은 적용 안 함)
      const doRefresh = refreshOnceRef.current;
      refreshOnceRef.current = false;
      try {
        const result = await fetchStepData(contestId, round, step, controller.signal, {
          refresh: doRefresh,
        });
        if (!mounted) return;
        setState({
          result,
          loading: false,
          error: null,
          lastUpdated: Date.now(),
        });
      } catch (e) {
        if (!mounted || controller.signal.aborted) return;
        setState((s) => ({
          ...s,
          loading: false,
          error: e instanceof Error ? e.message : String(e),
        }));
      }
    }

    load();

    // Live 스텝일 때만 폴링 — 다른 스텝은 1회 fetch (Design §4.4, §6)
    let intervalId: ReturnType<typeof setInterval> | null = null;
    if (step === 'live') {
      intervalId = setInterval(load, pollIntervalMs);
    }

    return () => {
      mounted = false;
      abortRef.current?.abort();
      if (intervalId) clearInterval(intervalId);
    };
  }, [contestId, round, step, pollIntervalMs, refreshTick]);

  const refresh = () => {
    refreshOnceRef.current = true;
    setRefreshTick((n) => n + 1);
  };

  return { ...state, refresh };
}
