// Design Ref: §11.1 #12, §11.2 — Live 스텝에서만 노출. "마지막 갱신 N초 전".
'use client';

import { useEffect, useState } from 'react';

export function LiveIndicator({
  loading,
  lastUpdated,
}: {
  loading: boolean;
  lastUpdated: number | null;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const secondsAgo = lastUpdated == null ? null : Math.max(0, Math.round((now - lastUpdated) / 1000));

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-bg2 border border-border text-xs font-mono text-ink2">
      <span
        className={`inline-block w-2 h-2 rounded-full ${
          loading ? 'bg-danger animate-pulse' : 'bg-ok'
        }`}
        aria-hidden
      />
      {loading ? (
        <span>refreshing…</span>
      ) : secondsAgo == null ? (
        <span>—</span>
      ) : (
        <span>updated {secondsAgo}s ago</span>
      )}
    </div>
  );
}
