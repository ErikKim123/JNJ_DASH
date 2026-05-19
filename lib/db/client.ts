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

export function getSupabaseAnon(): SupabaseClient {
  if (anonClient) return anonClient;
  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const key = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  anonClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return anonClient;
}

// 테스트/스크립트 재실행용
export function _resetSupabaseClientsForTests(): void {
  adminClient = null;
  anonClient = null;
}
