// Design Ref: §11.2 — HOME (대회 선택)
import Link from 'next/link';
import { Suspense } from 'react';
import { ContestList } from '@/components/home/ContestList';

export const dynamic = 'force-dynamic';

export default function HomePage() {
  return (
    <main className="min-h-screen p-8 max-w-6xl mx-auto">
      <header className="mb-8 pb-6 border-b border-border flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            JNJ <span className="text-accent">Dash</span>
          </h1>
          <p className="text-sm text-ink2 mt-1">대회를 선택하세요 / Select a Competition</p>
        </div>
        <div className="flex items-center gap-4">
          <p className="text-xs text-ink2 font-mono tracking-widest uppercase">
            DANCE · COMPETITION · DASHBOARD
          </p>
          <Link
            href="/join"
            target="_blank"
            rel="noopener"
            className="text-xs font-mono tracking-widest uppercase px-3 py-1.5 rounded border border-border text-ink2 hover:text-ink hover:border-ink transition"
          >
            Join App ↗
          </Link>
          <Link
            href="/admin"
            target="_blank"
            rel="noopener"
            className="text-xs font-mono tracking-widest uppercase px-3 py-1.5 rounded border border-accent/40 text-accent hover:bg-accent/10 hover:border-accent transition"
          >
            Admin ↗
          </Link>
        </div>
      </header>

      <Suspense
        fallback={
          <div className="text-center text-sm text-ink2 py-12">대회 목록 로딩 중…</div>
        }
      >
        <ContestList />
      </Suspense>
    </main>
  );
}
