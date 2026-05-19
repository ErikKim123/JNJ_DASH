// /admin/* 와 /api/admin/*(로그인 API 제외) 진입 시 admin_session 쿠키 검증.
// Phase 2 에서 /admin 자료운영 UI 가 추가되면 즉시 보호되도록 Phase 1 단계에서 미리 등록.
//
// 인증 실패 시:
//   - /admin/*  → /admin/login 으로 리다이렉트
//   - /api/admin/* → 401 JSON 반환
import { NextResponse, type NextRequest } from 'next/server';
import { verifySession, getCookieName } from '@/lib/auth/admin';

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};

const LOGIN_PATH = '/admin/login';
const LOGIN_API_PREFIX = '/api/admin/login';

// 응답에 현재 경로를 헤더로 전달 — 서버 컴포넌트(layout)가 RSC 단계에서
// referer 같은 불안정한 폴백 없이 정확한 pathname 을 얻을 수 있게 함.
function withPathname(req: NextRequest, res: NextResponse): NextResponse {
  res.headers.set('x-pathname', req.nextUrl.pathname);
  return res;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 로그인 페이지/API 는 우회.
  if (pathname.startsWith(LOGIN_PATH) || pathname.startsWith(LOGIN_API_PREFIX)) {
    return withPathname(req, NextResponse.next());
  }

  const token = req.cookies.get(getCookieName())?.value;
  const ok = await verifySession(token);
  if (ok) return withPathname(req, NextResponse.next());

  if (pathname.startsWith('/api/admin/')) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  // /admin/* 미인증 → 로그인 페이지로 리다이렉트 (next 쿼리에 원래 경로 보관)
  const url = req.nextUrl.clone();
  url.pathname = LOGIN_PATH;
  url.searchParams.set('next', pathname);
  return NextResponse.redirect(url);
}
