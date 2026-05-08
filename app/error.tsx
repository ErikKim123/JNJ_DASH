'use client';

// Design Ref: §10 — 루트 에러 경계 (서버 컴포넌트 예외 포함)
import { useEffect } from 'react';

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[root]', error);
  }, [error]);

  return (
    <main className="min-h-screen p-8 max-w-3xl mx-auto">
      <h1 className="text-xl font-semibold mb-3">앱을 표시할 수 없습니다</h1>
      <pre className="text-xs font-mono text-ink2 bg-panel border border-border rounded p-4 whitespace-pre-wrap break-all">
        {error.message}
        {error.digest ? `\ndigest: ${error.digest}` : ''}
      </pre>
      <p className="text-xs text-ink2 mt-3">
        환경변수 CONTEST_LIST_SHEET_ID가 설정되어 있는지 확인하세요 (로컬: .env.local · Vercel: Project Settings → Environment Variables).
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 px-4 py-2 rounded bg-accent text-[#1A1612] text-sm font-semibold"
      >
        다시 시도
      </button>
    </main>
  );
}
