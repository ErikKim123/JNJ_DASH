// 서버 컴포넌트에서 locale 쿠키 읽기.
// AdminLayout 같은 server 컴포넌트가 호출해 LocaleProvider 에 initialLocale 로 전달.
import { cookies } from 'next/headers';
import { LOCALES, type Locale } from './messages';
import { LOCALE_COOKIE } from './LocaleContext';

export async function getServerLocale(): Promise<Locale> {
  try {
    const c = await cookies();
    const v = c.get(LOCALE_COOKIE)?.value;
    if (v && (LOCALES as readonly string[]).includes(v)) return v as Locale;
  } catch {
    /* cookies() 미지원 컨텍스트 — 기본값 폴백 */
  }
  return 'en';
}
