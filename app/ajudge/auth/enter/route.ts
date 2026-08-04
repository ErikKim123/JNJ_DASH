// GET /ajudge/auth/enter — 로그인 화면 없이 바로 들어가기.
//
// AI Judge 는 대회 참가자가 즉석에서 영상만 올려보는 도구다. 이메일 링크를 받아
// 메일함을 열게 만드는 단계는 이 제품에서 순수한 이탈 요인이라 없앴다.
// 대신 첫 방문 때 이 라우트가 '기기 계정'을 하나 만들고 세션 쿠키를 심는다.
//
// 왜 Supabase 익명 로그인(signInAnonymously)이 아닌가:
//   이 프로젝트는 Anonymous sign-ins 가 꺼져 있고(대시보드 토글), 켜는 것은 코드로
//   할 수 없다. service_role 의 admin.createUser 는 설정 변경 없이 지금 동작한다.
//   나중에 대시보드에서 익명 로그인을 켜면 이 파일만 signInAnonymously 로 갈아끼우면 된다.
//
// 계정은 auth.users 의 정상 사용자이므로 jobs.user_id FK · RLS(auth.uid()) ·
// Storage 경로 정책({user_id}/...)이 전부 기존 그대로 동작한다.
//
// 이 경로는 middleware 에서 공개 경로다(lib/ai-judge/supabase-server.ts).
// 세션이 없는 상태로 들어와야 하기 때문이다.
import { NextResponse, type NextRequest } from 'next/server';
import { randomUUID, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

// service_role 키를 쓰므로 Edge 가 아닌 Node 런타임에서 돈다.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** 오픈 리다이렉트 방지 — 우리 앱 안쪽 경로만 허용한다. */
function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith('/ajudge')) return '/ajudge';
  if (raw.startsWith('//')) return '/ajudge';
  // 진입 라우트로 되돌아가면 무한 루프가 된다.
  if (raw.startsWith('/ajudge/auth')) return '/ajudge';
  return raw;
}

/** 세션 발급에 실패했을 때 리다이렉트로 돌려보내면 무한 루프가 된다. 화면으로 끝낸다. */
function failure(detail: string): NextResponse {
  const html = `<!doctype html><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AI Judge — 접속 실패</title>
<body style="margin:0;background:#0B0B0C;color:#EDEDED;font:15px/1.6 system-ui,-apple-system,'Segoe UI',sans-serif">
<main style="max-width:420px;margin:0 auto;padding:80px 24px">
  <h1 style="font-size:22px;margin:0 0 12px">접속에 실패했습니다</h1>
  <p style="color:#9A9A9A;margin:0 0 20px">잠시 후 다시 시도해 주세요. 계속되면 관리자에게 알려 주세요.</p>
  <p style="color:#6A6A6A;font:12px/1.5 ui-monospace,monospace;word-break:break-all">${detail
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')}</p>
  <a href="/ajudge/auth/enter" style="display:block;margin-top:24px;padding:14px;text-align:center;background:#EDEDED;color:#0B0B0C;border-radius:10px;text-decoration:none;font-weight:600">다시 시도</a>
</main>`;
  return new NextResponse(html, {
    status: 503,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export async function GET(req: NextRequest) {
  const { origin } = req.nextUrl;
  const next = safeNext(req.nextUrl.searchParams.get('next'));

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) {
    return failure('Supabase 환경변수(NEXT_PUBLIC_SUPABASE_URL / ANON_KEY / SERVICE_ROLE_KEY)가 없습니다.');
  }

  // 세션 쿠키를 리다이렉트 응답에 실어 보내야 하므로 res 를 먼저 만든다.
  const res = NextResponse.redirect(`${origin}${next}`);
  res.headers.set('cache-control', 'no-store');

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });

  // 이미 세션이 있으면 계정을 새로 만들지 않는다(새로고침·중복 진입 방어).
  const { data: existing } = await supabase.auth.getUser();
  if (existing.user) return res;

  // 기기 계정. 이메일은 실제로 발송되지 않는 예약 도메인(.local)을 쓰고,
  // 비밀번호는 즉시 로그인에만 쓰고 버린다 — 이후 접속은 refresh token 이 이어간다.
  const email = `device-${randomUUID()}@ajudge.local`;
  const password = randomBytes(24).toString('hex');

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { ajudge_device: true },
  });
  if (createErr) return failure(`계정 생성 실패: ${createErr.message}`);

  const { data: signed, error: signErr } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (signErr || !signed.user) {
    return failure(`세션 발급 실패: ${signErr?.message ?? 'no session'}`);
  }

  // 프로필 행을 만들어 둔다(히스토리/알림에서 쓴다).
  await supabase
    .schema('ai_judge')
    .from('profiles')
    .upsert({ id: signed.user.id, email: '' }, { onConflict: 'id', ignoreDuplicates: true });

  return res;
}
