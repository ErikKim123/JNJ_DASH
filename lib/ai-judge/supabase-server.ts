// 서버 전용 Supabase 클라이언트 — Auth 세션(쿠키) + ai_judge 스키마 접근.
//
// 기존 lib/db/client.ts 는 service_role/anon 싱글턴이라 '사용자별 세션'이 없다.
// AI Judge 는 참가자 개인 데이터를 다루므로 반드시 사용자 JWT 로 접근해 RLS 를 태운다.
//
// ⚠️ next/headers 를 쓰므로 클라이언트 컴포넌트에서 import 하면 빌드가 깨진다.
//    브라우저용은 supabase-browser.ts.
//
// ⚠️ 사전 작업 (1회, Supabase Dashboard):
//    Settings → API → "Exposed schemas" 에 `ai_judge` 추가.
//    없으면 PostgREST 가 스키마를 노출하지 않아 아래 쿼리가 실패한다.

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { AI_JUDGE_SCHEMA } from './constants';

export { AI_JUDGE_SCHEMA, MEDIA_BUCKET } from './constants';

function requirePublicEnv(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 필요합니다.'
    );
  }
  return { url, anonKey };
}

async function cookieAdapter() {
  const store = await cookies();
  return {
    getAll: () => store.getAll(),
    setAll: (list: { name: string; value: string; options: CookieOptions }[]) => {
      try {
        list.forEach(({ name, value, options }) => store.set(name, value, options));
      } catch {
        // 서버 컴포넌트에서는 쿠키를 쓸 수 없다. 세션 갱신은 middleware 가 담당한다.
      }
    },
  };
}

/**
 * 서버 컴포넌트 / Route Handler 용. `db.schema` 를 ai_judge 로 고정하므로
 * `.from('jobs')` 처럼 스키마 없이 쓴다.
 *
 * 반환 타입은 추론에 맡긴다 — schema 를 바꾸면 SupabaseClient 의 제네릭이
 * 'public' 고정형과 달라져 명시 애노테이션이 오히려 타입 오류를 낸다.
 */
export async function createClientServer() {
  const { url, anonKey } = requirePublicEnv();
  return createServerClient(url, anonKey, {
    db: { schema: AI_JUDGE_SCHEMA },
    cookies: await cookieAdapter(),
  });
}

/** auth 스키마 접근용(로그인 사용자 조회). ai_judge 스키마 고정이 없다. */
export async function createAuthServer() {
  const { url, anonKey } = requirePublicEnv();
  return createServerClient(url, anonKey, { cookies: await cookieAdapter() });
}

/**
 * middleware 용 세션 갱신. 액세스 토큰이 만료되면 갱신하고 쿠키를 다시 심는다.
 * 기존 /admin PIN 세션 로직과 완전히 분리해서 동작한다.
 */
export async function updateAiJudgeSession(req: NextRequest): Promise<NextResponse> {
  const { url, anonKey } = requirePublicEnv();
  let res = NextResponse.next({ request: req });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });

  // getUser() 를 호출해야 토큰 갱신이 일어난다. getSession() 은 검증하지 않으므로 쓰지 않는다.
  const { data } = await supabase.auth.getUser();

  const { pathname } = req.nextUrl;
  // 세션 발급 라우트는 세션 없이 들어와야 하므로 공개다.
  const isPublic = pathname.startsWith('/ajudge/auth');

  if (!data.user && !isPublic) {
    if (pathname.startsWith('/api/ajudge/')) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }
    // 로그인 화면이 없다. 세션이 없으면 곧바로 기기 계정을 발급받고 원래 경로로 돌아온다.
    const to = new URL('/ajudge/auth/enter', req.url);
    to.searchParams.set('next', `${pathname}${req.nextUrl.search}`);
    return NextResponse.redirect(to);
  }

  return res;
}
