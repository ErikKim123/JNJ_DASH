// Design Ref: §11.2 — HOME (대회 선택)
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
          <p className="text-sm text-ink2 mt-1">대회를 선택하세요</p>
        </div>
        <p className="text-xs text-ink2 font-mono tracking-widest uppercase">
          DANCE · COMPETITION · DASHBOARD
        </p>
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
