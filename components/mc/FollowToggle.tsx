// MC 콘솔 헤더의 "MC 따라가기" 원격 스위치 —
// 켜면 열려 있는 표출 화면(대시보드)이 MC 가 넘기는 라운드/스텝을 자동으로 따라간다.
'use client';

import { useCallback, useState } from 'react';
import { adminFetch } from './ui';

export function FollowToggle({
  contestId,
  initialFollow,
}: {
  contestId: string;
  initialFollow: boolean;
}) {
  const [follow, setFollow] = useState(initialFollow);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = useCallback(async () => {
    const next = !follow;
    setFollow(next);
    setPending(true);
    setError(null);
    try {
      await adminFetch(`/api/admin/contests/${encodeURIComponent(contestId)}/display-state`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ follow: next }),
      });
    } catch (e) {
      setFollow(!next); // 실패 시 원복
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  }, [contestId, follow]);

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      title={error ?? 'MC 따라가기 — 표출 화면이 MC 를 따라갑니다'}
      aria-pressed={follow}
      className={`shrink-0 rounded-lg border px-3 py-2 text-[11px] font-mono tracking-widest transition disabled:opacity-50 ${
        error
          ? 'border-danger bg-danger/15 text-danger'
          : follow
            ? 'border-ok bg-ok/20 text-ok'
            : 'border-border bg-panel text-ink2'
      }`}
    >
      {error ? '실패 ↻' : follow ? '● 따라가기' : '○ 따라가기'}
    </button>
  );
}
