'use client';

// 클라이언트 전용 locale 컨텍스트.
// - 저장: 쿠키 (`jnj.admin.locale`) — 서버에서도 읽혀 SSR 단계부터 올바른 언어로 렌더.
// - 쓰기는 (a) Server Action 으로 응답 헤더 set-cookie + (b) document.cookie 직접 쓰기 이중 보호.
// - 마운트 시 useEffect 가 쿠키 값을 재확인하여 state 동기화 — provider 가 어떤 이유로
//   remount 되어 state 가 초기화되어도 쿠키 기준으로 회복.
// - 기본값: 'en'. 쿠키 미설정 시 영어로 표시.
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { MESSAGES, type Locale, type MessageKey, LOCALES } from './messages';
import { setLocaleCookie } from './actions';

// 쿠키 이름에 '.' 가 있으면 일부 환경에서 도메인 구분자처럼 해석되는 호환 이슈 — underscore 사용.
export const LOCALE_COOKIE = 'jnj_admin_locale';
const DEFAULT_LOCALE: Locale = 'en';
const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 365; // 1 year

interface LocaleContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: MessageKey) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

/** 브라우저 document.cookie 에서 locale 값 추출. 서버는 next/headers cookies() 사용. */
export function readLocaleFromDocument(): Locale {
  if (typeof document === 'undefined') return DEFAULT_LOCALE;
  const m = document.cookie.match(/(?:^|;\s*)jnj_admin_locale=([^;]+)/);
  const v = m?.[1];
  if (v && (LOCALES as readonly string[]).includes(v)) return v as Locale;
  return DEFAULT_LOCALE;
}

function writeCookieClient(l: Locale) {
  if (typeof document === 'undefined') return;
  document.cookie = `${LOCALE_COOKIE}=${l}; Path=/; Max-Age=${COOKIE_MAX_AGE_SEC}; SameSite=Lax`;
}

export function LocaleProvider({
  initialLocale,
  children,
}: {
  /** 서버에서 쿠키 읽어 넘기는 초기값. 미지정 시 'en'. */
  initialLocale?: Locale;
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale ?? DEFAULT_LOCALE);

  // 마운트 시 쿠키 재확인 — provider 가 remount 되어 initialLocale 이 stale 일 때 대비.
  useEffect(() => {
    const fromCookie = readLocaleFromDocument();
    if (fromCookie !== locale) {
      setLocaleState(fromCookie);
    }
    // 쿠키 자체가 없으면(처음 방문 등) 현재 state 값으로 쿠키 작성 — 다음 SSR 에서 확정.
    const m = typeof document !== 'undefined'
      ? document.cookie.match(/(?:^|;\s*)jnj_admin_locale=([^;]+)/)
      : null;
    if (!m) writeCookieClient(locale);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    // 1) 클라이언트 즉시 쓰기 — 같은 페이지의 다른 탭/창에서도 즉시 보이도록.
    writeCookieClient(l);
    // 2) Server Action — 응답 헤더로 set-cookie 가 확실히 적용되도록.
    //    void 처리: state 갱신은 await 없이 즉시 반영. 쿠키 영속화는 백그라운드.
    void setLocaleCookie(l);
  }, []);

  const t = useCallback(
    (key: MessageKey): string => {
      const dict = MESSAGES[locale] ?? MESSAGES[DEFAULT_LOCALE];
      return dict[key] ?? MESSAGES[DEFAULT_LOCALE][key] ?? key;
    },
    [locale]
  );

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error('useLocale must be used inside <LocaleProvider>');
  }
  return ctx;
}

/** 짧은 별칭 — `const t = useT();` 패턴이 더 흔함. */
export function useT(): (key: MessageKey) => string {
  return useLocale().t;
}
