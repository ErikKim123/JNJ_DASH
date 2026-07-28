// MC 표출 포인터 폴링 — 프로젝터(대시보드)가 MC 폰이 기록한 라운드/스텝을 따라가게 한다.
// 2.5초 간격으로 공개 GET /api/contests/[id]/display-state 를 조회하고,
//   - updatedAt 이 바뀌면(= MC가 화면을 넘기면) enabled 일 때만 onPointer 로 알린다.
//   - followAt 이 바뀌면(= MC 콘솔에서 따라가기 스위치를 누르면) onRemoteFollow 로 알린다.
//     스위치는 꺼져 있을 때도 받아야 하므로 폴링 자체는 enabled 와 무관하게 항상 돈다.
// 같은 변경은 한 번만 적용.
'use client';

import { useEffect, useRef } from 'react';
import type { RoundKey, StepKey } from '@/lib/sheets/types';
import { ROUND_KEYS, STEP_KEYS } from '@/lib/sheets/types';

const POLL_MS = 2500;

interface Pointer {
  round: RoundKey | null;
  step: StepKey | null;
  updatedAt: string | null;
  follow: boolean;
  followAt: string | null;
}

function parsePointer(d: unknown): Pointer | null {
  if (!d || typeof d !== 'object') return null;
  const o = d as Record<string, unknown>;
  const roundOk = typeof o.round === 'string' && (ROUND_KEYS as readonly string[]).includes(o.round);
  const stepOk = typeof o.step === 'string' && (STEP_KEYS as readonly string[]).includes(o.step);
  return {
    round: roundOk ? (o.round as RoundKey) : null,
    step: stepOk ? (o.step as StepKey) : null,
    updatedAt: typeof o.updatedAt === 'string' && o.updatedAt ? o.updatedAt : null,
    follow: o.follow === true,
    followAt: typeof o.followAt === 'string' && o.followAt ? o.followAt : null,
  };
}

export function useDisplayFollow({
  contestId,
  enabled,
  onPointer,
  onRemoteFollow,
}: {
  contestId: string;
  enabled: boolean;
  onPointer: (round: RoundKey, step: StepKey) => void;
  onRemoteFollow?: (follow: boolean) => void;
}) {
  const lastApplied = useRef<string | null>(null);
  const lastFollowAt = useRef<string | null>(null);
  const seenFollowOnce = useRef(false);

  // 콜백/enabled 는 렌더마다 새 참조가 될 수 있다. effect 의존성에 넣으면 URL 이 바뀔 때마다
  // 폴링 타이머가 재시작되므로 ref 로 최신값만 들고 간다.
  const enabledRef = useRef(enabled);
  const onPointerRef = useRef(onPointer);
  const onRemoteFollowRef = useRef(onRemoteFollow);
  enabledRef.current = enabled;
  onPointerRef.current = onPointer;
  onRemoteFollowRef.current = onRemoteFollow;

  // 따라가기를 껐다 켜면 현재 MC 화면으로 즉시 스냅되도록 직전 적용값을 비운다.
  useEffect(() => {
    if (enabled) lastApplied.current = null;
  }, [enabled]);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      try {
        const res = await fetch(`/api/contests/${encodeURIComponent(contestId)}/display-state`, {
          cache: 'no-store',
        });
        const json = (await res.json()) as { data?: unknown };
        const ptr = parsePointer(json?.data);
        if (alive && ptr) {
          // 1) 원격 따라가기 스위치 — 첫 폴링에서는 서버가 ON 일 때만 채택한다.
          //    (표출 ↗ 로 연 ?follow=1 창이 서버 기본값 false 때문에 꺼지지 않도록)
          if (onRemoteFollowRef.current) {
            if (!seenFollowOnce.current) {
              seenFollowOnce.current = true;
              lastFollowAt.current = ptr.followAt;
              if (ptr.follow) onRemoteFollowRef.current(true);
            } else if (ptr.followAt !== lastFollowAt.current) {
              lastFollowAt.current = ptr.followAt;
              onRemoteFollowRef.current(ptr.follow);
            }
          }
          // 2) 표출 포인터 — 따라가기가 켜져 있을 때만 적용.
          if (
            enabledRef.current &&
            ptr.round &&
            ptr.step &&
            ptr.updatedAt &&
            ptr.updatedAt !== lastApplied.current
          ) {
            lastApplied.current = ptr.updatedAt;
            onPointerRef.current(ptr.round, ptr.step);
          }
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
  }, [contestId]);
}
