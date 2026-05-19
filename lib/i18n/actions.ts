'use server';

// 클라이언트 측 document.cookie 만으로는 일부 환경에서 다음 RSC 네비게이션에
// 쿠키가 반영되지 않는 케이스가 있어, 서버 액션을 통해 응답 헤더로 직접 set-cookie.
// 액션 응답 후 다음 navigation 요청에는 확실히 쿠키가 포함된다.
//
// revalidatePath('/admin', 'layout') 호출로 admin 트리의 layout 캐시까지 무효화 →
// 다음 페이지 SSR 이 새 쿠키 값으로 다시 실행되어 EN→KO 깜빡임을 막는다.
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { LOCALES, type Locale } from './messages';
import { LOCALE_COOKIE } from './LocaleContext';

const MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export async function setLocaleCookie(l: Locale): Promise<void> {
  if (!(LOCALES as readonly string[]).includes(l)) return;
  const c = await cookies();
  c.set({
    name: LOCALE_COOKIE,
    value: l,
    path: '/',
    maxAge: MAX_AGE,
    sameSite: 'lax',
    // httpOnly 미설정 — 클라이언트에서도 document.cookie 로 읽을 수 있어야 함.
  });
  // admin 영역의 모든 layout 캐시를 무효화 → 다음 네비게이션 시 새 쿠키로 SSR.
  revalidatePath('/admin', 'layout');
}
