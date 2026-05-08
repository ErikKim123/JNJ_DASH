'use client';

// Design Ref: §10 — 클라이언트 측 예외 경계. Next.js error boundary 규약.
import { useEffect } from 'react';
import Link from 'next/link';

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[dashboard]', error);
  }, [error]);

  return (
    <main className="min-h-screen p-8 max-w-3xl mx-auto">
      <h1 className="text-xl font-semibold mb-3">대시보드를 표시할 수 없습니다</h1>
      <pre className="text-xs font-mono text-ink2 bg-panel border border-border rounded p-4 whitespace-pre-wrap break-all">
        {error.message}
        {error.digest ? `\ndigest: ${error.digest}` : ''}
      </pre>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={reset}
          className="px-4 py-2 rounded bg-accent text-[#1A1612] text-sm font-semibold"
        >
          다시 시도
        </button>
        <Link
          href="/"
          className="px-4 py-2 rounded border border-border text-sm text-ink2 hover:text-ink"
        >
          대회 목록으로
        </Link>
      </div>
    </main>
  );
}
