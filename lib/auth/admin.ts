// ADMIN_PIN 기반 단순 인증. Phase 2 의 /admin 자료운영 UI 보호용.
//
// 동작:
//   1) POST /api/admin/login { pin } → ADMIN_PIN 일치 시 서명된 쿠키(admin_session) 발급
//   2) middleware.ts 가 /admin/* 와 /api/admin/* (login 제외) 진입 시 쿠키 검증
//   3) 쿠키는 HMAC-SHA256 서명 + 만료시각 → JWT 의존성 없이 위변조 방지
//
// 런타임 호환:
//   middleware 는 Edge runtime 이라 node:crypto 사용 불가 → Web Crypto (SubtleCrypto) 사용.
//   Node 20+ 와 Edge 모두 globalThis.crypto.subtle 가 있어 같은 함수가 양쪽에서 동작.

const COOKIE_NAME = 'admin_session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h

export function getCookieName(): string {
  return COOKIE_NAME;
}

function getSecret(): string {
  // PIN 자체를 secret 으로 사용 → PIN 변경 시 모든 세션 자동 만료. 의도된 동작.
  const pin = process.env.ADMIN_PIN;
  if (!pin) throw new Error('ADMIN_PIN env is required');
  const extra = process.env.ADMIN_SESSION_SECRET ?? '';
  return `${pin}::${extra}`;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  // btoa 는 Edge/브라우저/Node 18+ 전부 동작.
  return btoa(bin).replace(/=+$/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function hmacSign(payload: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return bytesToBase64Url(new Uint8Array(sig));
}

/** 길이 무관 timing-safe 비교 (문자열 동등). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * PIN 검증. 일치하면 쿠키 값(서명된 토큰) 반환. 불일치면 null.
 */
export async function verifyPin(input: string): Promise<string | null> {
  const pin = process.env.ADMIN_PIN;
  if (!pin) throw new Error('ADMIN_PIN env is required');
  if (!safeEqual(pin, input || '')) return null;
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = `v1:${expiresAt}`;
  const sig = await hmacSign(payload, getSecret());
  return `${payload}:${sig}`;
}

/**
 * 쿠키 값 검증. 만료/서명오류/포맷오류는 false.
 */
export async function verifySession(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const parts = token.split(':');
  if (parts.length !== 3) return false;
  const [version, expStr, sig] = parts;
  if (version !== 'v1') return false;
  const exp = Number.parseInt(expStr, 10);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  const expected = await hmacSign(`${version}:${expStr}`, getSecret());
  return safeEqual(sig, expected);
}

export function buildSessionCookie(token: string, opts?: { secure?: boolean }): string {
  const secure = opts?.secure ?? process.env.NODE_ENV === 'production';
  const maxAgeSec = Math.floor(SESSION_TTL_MS / 1000);
  const flags = [
    `${COOKIE_NAME}=${token}`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Max-Age=${maxAgeSec}`,
  ];
  if (secure) flags.push('Secure');
  return flags.join('; ');
}

export function buildClearCookie(opts?: { secure?: boolean }): string {
  const secure = opts?.secure ?? process.env.NODE_ENV === 'production';
  const flags = [
    `${COOKIE_NAME}=`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Max-Age=0`,
  ];
  if (secure) flags.push('Secure');
  return flags.join('; ');
}
