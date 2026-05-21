// Resend 클라이언트 — 서버 사이드 전용.
// RESEND_API_KEY 가 없으면 throw 하지 않고 null 반환 → 호출부에서 skip 처리.
// (개발/CI 환경에서 메일 발송 없이도 흐름 진행 가능하게)
import { Resend } from 'resend';

let client: Resend | null = null;
let initialized = false;

export function getResend(): Resend | null {
  if (initialized) return client;
  initialized = true;
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn('[email] RESEND_API_KEY 미설정 — 메일 발송 비활성화');
    return null;
  }
  client = new Resend(key);
  return client;
}

const SANDBOX_FROM = 'JNJ JOIN <onboarding@resend.dev>';

/**
 * 발신자 — RESEND_FROM_EMAIL 우선, 미설정 / 빈 문자열 / placeholder 면 Resend 샌드박스 기본값.
 *
 * 가드: `your-domain.com` / `example.com` / `example.org` 등 .env 가이드에
 *  적힌 예시 값이 그대로 들어와도 사용자가 보낼 수 있도록 샌드박스로 폴백.
 *  운영팀이 도메인 인증 후 진짜 도메인을 입력하면 즉시 사용됨.
 */
export function getFromAddress(): string {
  const raw = (process.env.RESEND_FROM_EMAIL ?? '').trim();
  if (!raw) return SANDBOX_FROM;
  if (/\b(your-domain\.com|example\.com|example\.org|example\.net)\b/i.test(raw)) {
    console.warn(
      `[email] RESEND_FROM_EMAIL 에 placeholder 값(${raw}) 이 들어있음 — 샌드박스 발신자로 폴백`
    );
    return SANDBOX_FROM;
  }
  return raw;
}
