// /admin/* 공용 레이아웃 — 미들웨어가 이미 인증 검증 후 라우팅하므로 여기서는 보조 가드만.
// /admin/login 자식 경로는 본 레이아웃 영향을 받음 → 로그인 페이지 자체는 사이드바 없이 노출하기 위해
// AdminShell 적용을 분리. (login 경로 감지 후 children 그대로 렌더)
import { headers } from 'next/headers';
import { AdminShell } from '@/components/admin/AdminShell';
import { listContestSummaries } from '@/lib/db/queries';
import { getServerLocale } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // 현재 경로 추출 — middleware 가 모든 /admin/* 응답에 x-pathname 헤더를 세팅.
  // Vercel 운영에서 next-url 헤더는 RSC 요청에만 있고, referer 폴백은
  // 로그인 직후처럼 referer 가 /admin/login 일 때 오판이 생기므로 제거.
  const h = await headers();
  const currentPath = h.get('x-pathname') ?? h.get('next-url') ?? '';
  const isLogin = /\/admin\/login(\?|$|\/)/.test(currentPath);

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
