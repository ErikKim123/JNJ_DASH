'use client';

// /admin 공용 레이아웃 — 좌측 사이드(컨테스트 선택) + 우측 본문.
// 사용자가 어디로 가든 상단에 [언어전환] [표시화면] [로그아웃] 표시.
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { LocaleProvider, useT } from '@/lib/i18n/LocaleContext';
import type { Locale } from '@/lib/i18n/messages';
import { LocaleSwitcher } from './LocaleSwitcher';

export interface AdminContestSummary {
  id: string;
  name: string;
}

export function AdminShell({
  contests,
  initialLocale,
  children,
}: {
  contests: AdminContestSummary[];
  /** 서버에서 쿠키 읽어 넘긴 초기 locale. SSR/CSR 깜빡임 방지. */
  initialLocale?: Locale;
  children: React.ReactNode;
}) {
  // LocaleProvider 가 가장 바깥에서 모든 자식에게 t() 제공.
  return (
    <LocaleProvider initialLocale={initialLocale}>
      <AdminShellInner contests={contests}>{children}</AdminShellInner>
    </LocaleProvider>
  );
}

function AdminShellInner({
  contests,
  children,
}: {
  contests: AdminContestSummary[];
  children: React.ReactNode;
}) {
  const t = useT();
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function logout() {
    startTransition(async () => {
      await fetch('/api/admin/login', { method: 'DELETE' });
      router.replace('/admin/login');
      router.refresh();
    });
  }

  // 현재 선택된 contestId 추출
  const m = pathname.match(/^\/admin\/contests\/([^/]+)/);
  const activeContestId = m ? decodeURIComponent(m[1]) : null;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border bg-bg2 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin" className="text-lg font-semibold tracking-tight">
            JNJ <span className="text-accent">{t('header.brand')}</span>
          </Link>
          <span className="text-xs text-ink2 font-mono uppercase tracking-widest">{t('header.dataOps')}</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <LocaleSwitcher />
          <Link
            href="/join"
            target="_blank"
            rel="noopener"
            className="px-3 py-1 rounded border border-border text-ink2 hover:text-ink hover:border-ink transition font-mono text-xs uppercase tracking-widest"
            title="참가자 셀프 등록 페이지를 새 창으로 엽니다"
          >
            Join App ↗
          </Link>
          <Link href="/" className="text-ink2 hover:text-ink transition">
            {t('header.display')}
          </Link>
          <button
            type="button"
            onClick={logout}
            disabled={pending}
            className="px-3 py-1 rounded border border-border hover:border-danger hover:text-danger transition disabled:opacity-50"
          >
            {pending ? t('header.loggingOut') : t('header.logout')}
          </button>
        </div>
      </header>

      <div className="flex-1 flex">
        <aside className="w-60 shrink-0 border-r border-border bg-bg2 p-4 overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs uppercase tracking-widest text-ink2">{t('sidebar.contests')}</span>
            <Link
              href="/admin/contests/new"
              className="text-xs text-accent hover:underline"
            >
              {t('sidebar.new')}
            </Link>
          </div>
          <nav className="flex flex-col gap-1">
            {contests.length === 0 && (
              <p className="text-xs text-ink2">{t('sidebar.noContests')}</p>
            )}
            {contests.map((c) => {
              const active = c.id === activeContestId;
              return (
                <Link
                  key={c.id}
                  href={`/admin/contests/${encodeURIComponent(c.id)}`}
                  className={`block rounded px-3 py-2 text-sm border ${
                    active
                      ? 'border-accent bg-accent/10 text-ink'
                      : 'border-transparent hover:border-border text-ink2 hover:text-ink'
                  }`}
                >
                  <span className="font-mono text-xs text-ink2 block">{c.id}</span>
                  <span className="block truncate">{c.name}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="flex-1 p-6 overflow-x-auto">{children}</main>
      </div>
    </div>
  );
}
