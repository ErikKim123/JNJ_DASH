// Design Ref: §4.2 — 대회 미존재 시 404 화면
import Link from 'next/link';

export default function DashboardNotFound() {
  return (
    <main className="min-h-screen p-8 max-w-3xl mx-auto flex items-center justify-center">
      <div className="text-center space-y-4">
        <p className="text-xs font-mono text-ink2 tracking-widest">404</p>
        <h1 className="text-2xl font-semibold tracking-tight">대회를 찾을 수 없습니다</h1>
        <p className="text-sm text-ink2">
          대회목록 시트에 등록된 contestId만 접근 가능합니다.
        </p>
        <Link
          href="/"
          className="inline-block px-4 py-2 rounded border border-border text-sm text-ink2 hover:text-ink hover:border-accent2"
        >
          대회 목록으로
        </Link>
      </div>
    </main>
  );
}
