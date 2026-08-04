// 브라우저 전용 Supabase 클라이언트 — Auth(로그인/로그아웃)와 Storage 직접 업로드에 쓴다.
//
// ⚠️ 이 파일은 클라이언트 컴포넌트에서 import 되므로 next/headers 등
//    서버 전용 모듈을 절대 끌어오면 안 된다. 서버용은 supabase-server.ts.
import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

export { AI_JUDGE_SCHEMA, MEDIA_BUCKET } from './constants';

export function createClientBrowser(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 필요합니다.'
    );
  }
  return createBrowserClient(url, anonKey);
}
