// /admin/* 공용 레이아웃 — 미들웨어가 이미 인증 검증 후 라우팅하므로 여기서는 보조 가드만.
// /admin/login 자식 경로는 본 레이아웃 영향을 받음 → 로그인 페이지 자체는 사이드바 없이 노출하기 위해
// AdminShell 적용을 분리. (login 경로 감지 후 children 그대로 렌더)
import { headers } from 'next/headers';
import { AdminShell } from '@/components/admin/AdminShell';
import { listContestSummaries } from '@/lib/db/queries';
import { getServerLocale } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // 현재 경로 추출 (next/headers 의 'x-pathname' 은 미들웨어가 안 채우니 referer 도 폴백).
  const h = await headers();
  // Next 가 매 요청마다 RSC 헤더 'next-url' 을 자동 주입 — App Router 표준 경로 추출.
  const nextUrl = h.get('next-url') ?? h.get('referer') ?? '';
  const isLogin = /\/admin\/login(\?|$|\/)/.test(nextUrl);

  if (isLogin) return <>{children}</>;

  let contests: { id: string; name: string }[] = [];
  try {
    contests = await listContestSummaries();
  } catch (e) {
    // DB 미설정 시에도 레이아웃은 그려서 사용자가 새 대회 만들 수 있게.
    console.warn('[admin layout] listContestSummaries failed:', e);
  }

  // 쿠키에서 locale 읽어 SSR 단계부터 올바른 언어로 렌더. EN ↔ KO 깜빡임 방지.
  const initialLocale = await getServerLocale();

  return (
    <AdminShell contests={contests} initialLocale={initialLocale}>
      {children}
    </AdminShell>
  );
}
