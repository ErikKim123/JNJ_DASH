// Supabase 클라이언트 — 서버 사이드 전용.
//   - getSupabaseAdmin(): service_role 키 사용. RLS 우회. 운영 API/마이그레이션용.
//   - getSupabaseAnon(): anon 키 사용. RLS 적용. 표출(read-only) 화면용.
// 서버 컴포넌트/Route Handler/스크립트 외에서는 호출하지 말 것 (service role 키 노출 위험).
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let adminClient: SupabaseClient | null = null;
let anonClient: SupabaseClient | null = null;

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env: ${key}`);
  return v;
}

export function getSupabaseAdmin(): SupabaseClient {
  if (adminClient) return adminClient;
  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const key = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  adminClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return adminClient;
}

// NEXT_PUBLIC_* 는 Next.js 가 "리터럴 표기"만 빌드 타임에 값으로 치환한다.
// process.env[변수명] 처럼 동적 접근하면 치환 대상이 아니고, Vercel 서버리스 런타임의
// process.env 에는 NEXT_PUBLIC_* 가 들어있지 않을 수 있어 undefined 가 된다.
// (실제로 display-state 공개 GET 이 "Missing env: NEXT_PUBLIC_SUPABASE_ANON_KEY" 로 500)
// → 반드시 리터럴로 읽을 것.
function publicEnv(): { url: string; anonKey: string } {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  };
}

export function getSupabaseAnon(): SupabaseClient {
  if (anonClient) return anonClient;
  const { url, anonKey } = publicEnv();
  if (!url) throw new Error('Missing env: NEXT_PUBLIC_SUPABASE_URL');
  if (!anonKey) throw new Error('Missing env: NEXT_PUBLIC_SUPABASE_ANON_KEY');
  anonClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return anonClient;
}

/**
 * 공개 읽기 전용 클라이언트.
 * anon 키가 있으면 anon(RLS 적용), 없으면 service_role 로 폴백한다.
 * 표출 포인터처럼 "MC/프로젝터가 로그인 없이 읽어야 하는" 소량의 비민감 필드용.
 * 폴백해도 서버 사이드에서만 실행되므로 키가 노출되지 않는다.
 */
export function getSupabasePublicRead(): SupabaseClient {
  const { url, anonKey } = publicEnv();
  if (url && anonKey) return getSupabaseAnon();
  return getSupabaseAdmin();
}

// 테스트/스크립트 재실행용
export function _resetSupabaseClientsForTests(): void {
  adminClient = null;
  anonClient = null;
}
