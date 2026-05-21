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

/** 발신자 — RESEND_FROM_EMAIL 우선, 미설정 시 Resend 샌드박스 기본값. */
export function getFromAddress(): string {
  return process.env.RESEND_FROM_EMAIL || 'JNJ JOIN <onboarding@resend.dev>';
}
