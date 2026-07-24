// MC 모바일 — 대회 선택 (관리자 로그인 뒤, middleware 보호).
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface ContestLite {
  contestId: string;
  name: string;
  startDate?: string;
  endDate?: string;
  status?: string;
}

export default function McHomePage() {
  const [contests, setContests] = useState<ContestLite[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/contests', { cache: 'no-store' });
        const json = (await res.json()) as { data: ContestLite[] | null; error: string | null };
        if (json.error || !json.data) throw new Error(json.error ?? 'load failed');
        setContests(json.data);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, []);

  return (
    <main className="min-h-screen bg-bg text-ink px-4 py-6 max-w-md mx-auto">
      <header className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight">
          MC <span className="text-accent">Console</span>
        </h1>
        <p className="text-xs text-ink2 mt-1">진행할 대회를 선택하세요 / Select a competition</p>
      </header>

      {error ? (
        <p className="text-sm text-danger break-all">{error}</p>
      ) : !contests ? (
        <p className="text-sm text-ink2 py-8 text-center">불러오는 중…</p>
      ) : contests.length === 0 ? (
        <p className="text-sm text-ink2 py-8 text-center">등록된 대회가 없습니다.</p>
      ) : (
        <ul className="space-y-2">
          {contests.map((c) => (
            <li key={c.contestId}>
              <Link
                href={`/mc/${encodeURIComponent(c.contestId)}`}
                className="block rounded-xl border border-border bg-panel px-4 py-3.5 active:bg-bg2 transition"
              >
                <span className="block font-mono text-[10px] tracking-widest text-ink2 uppercase">
                  {c.contestId}
                </span>
                <span className="block text-base font-semibold mt-0.5">{c.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6 text-center">
        <Link href="/" className="text-xs text-ink2 hover:text-ink">← 홈 / Home</Link>
      </div>
    </main>
  );
}
