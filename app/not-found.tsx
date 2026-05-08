import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-screen p-8 max-w-3xl mx-auto flex items-center justify-center">
      <div className="text-center space-y-4">
        <p className="text-xs font-mono text-ink2 tracking-widest">404</p>
        <h1 className="text-2xl font-semibold tracking-tight">페이지를 찾을 수 없습니다</h1>
        <Link
          href="/"
          className="inline-block px-4 py-2 rounded border border-border text-sm text-ink2 hover:text-ink hover:border-accent2"
        >
          홈으로
        </Link>
      </div>
    </main>
  );
}
