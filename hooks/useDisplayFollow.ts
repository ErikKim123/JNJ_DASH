// MC 표출 포인터 폴링 — 프로젝터(대시보드)가 MC 폰이 기록한 라운드/스텝을 따라가게 한다.
// enabled 일 때 2.5초 간격으로 공개 GET /api/contests/[id]/display-state 를 조회하고,
// updatedAt 이 바뀌면(= MC가 화면을 넘기면) onPointer 로 알린다. 같은 변경은 한 번만 적용.
'use client';

import { useEffect, useRef } from 'react';
import type { RoundKey, StepKey } from '@/lib/sheets/types';
import { ROUND_KEYS, STEP_KEYS } from '@/lib/sheets/types';

const POLL_MS = 2500;

interface Pointer { round: RoundKey; step: StepKey; updatedAt: string }

function parsePointer(d: unknown): Pointer | null {
  if (!d || typeof d !== 'object') return null;
  const o = d as { round?: unknown; step?: unknown; updatedAt?: unknown };
  if (
    typeof o.round === 'string' && (ROUND_KEYS as readonly string[]).includes(o.round) &&
    typeof o.step === 'string' && (STEP_KEYS as readonly string[]).includes(o.step) &&
    typeof o.updatedAt === 'string' && o.updatedAt
  ) {
    return { round: o.round as RoundKey, step: o.step as StepKey, updatedAt: o.updatedAt };
  }
  return null;
}

export function useDisplayFollow({
  contestId,
  enabled,
  onPointer,
}: {
  contestId: string;
  enabled: boolean;
  onPointer: (round: RoundKey, step: StepKey) => void;
}) {
  const lastApplied = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    // 켤 때마다 현재 포인터로 즉시 스냅(직전 적용값 초기화) — 운영자가 수동 이동 후
    // 다시 따라가기를 켜면 MC 화면으로 맞춰지도록.
    lastApplied.current = null;

    const poll = async () => {
      try {
        const res = await fetch(`/api/contests/${encodeURIComponent(contestId)}/display-state`, {
          cache: 'no-store',
        });
        const json = (await res.json()) as { data?: unknown };
        const ptr = parsePointer(json?.data);
        if (alive && ptr && ptr.updatedAt !== lastApplied.current) {
          lastApplied.current = ptr.updatedAt;
          onPointer(ptr.round, ptr.step);
        }
      } catch {
        // best-effort — 네트워크 실패 시 다음 폴링에서 재시도
      }
      if (alive) timer = setTimeout(poll, POLL_MS);
    };
    poll();

    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [contestId, enabled, onPointer]);
}
