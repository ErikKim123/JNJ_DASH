// Brevo (구 Sendinblue) Transactional Email — 서버 사이드 전용.
// 외부 SDK 없이 REST API (https://api.brevo.com/v3/smtp/email) 를 fetch 로 호출.
//
// 환경변수:
//   BREVO_API_KEY     — Brevo 대시보드 → SMTP & API → API Keys 에서 발급
//   BREVO_FROM_EMAIL  — Brevo 에서 검증된 발신자 이메일 (예: bandnara123@gmail.com)
//                       검증되지 않은 주소면 Brevo 가 거절.
//   BREVO_FROM_NAME   — 선택. 발신자 표시 이름. 기본 'JNJ JOIN'.
//
// 키 미설정 시 throw 하지 않고 null 반환 → 호출부에서 skip 처리.

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

export function getBrevoApiKey(): string | null {
  const key = (process.env.BREVO_API_KEY ?? '').trim();
  if (!key) {
    console.warn('[email] BREVO_API_KEY 미설정 — 메일 발송 비활성화');
    return null;
  }
  return key;
}

export interface BrevoSender {
  name: string;
  email: string;
}

/**
 * 발신자 — BREVO_FROM_EMAIL 우선.
 * placeholder 값(`your-domain.com` 등) 이 들어있으면 null 반환 → 호출부에서 NO_API_KEY 와 동급으로 skip.
 */
export function getFromAddress(): BrevoSender | null {
  const raw = (process.env.BREVO_FROM_EMAIL ?? '').trim();
  if (!raw) return null;
  if (/\b(your-domain\.com|example\.com|example\.org|example\.net)\b/i.test(raw)) {
    console.warn(`[email] BREVO_FROM_EMAIL 에 placeholder 값(${raw}) 이 들어있음 — 발송 skip`);
    return null;
  }
  const name = (process.env.BREVO_FROM_NAME ?? 'JNJ JOIN').trim() || 'JNJ JOIN';
  return { name, email: raw };
}

export interface BrevoSendPayload {
  sender: BrevoSender;
  to: { email: string; name?: string }[];
  subject: string;
  htmlContent: string;
  textContent?: string;
}

export interface BrevoSendResponse {
  ok: boolean;
  status: number;
  messageId?: string;
  error?: string;
}

export async function sendViaBrevo(
  apiKey: string,
  payload: BrevoSendPayload
): Promise<BrevoSendResponse> {
  let res: Response;
  try {
    res = await fetch(BREVO_ENDPOINT, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    return { ok: false, status: 0, error: e instanceof Error ? e.message : String(e) };
  }

  // Brevo: 201 Created → { messageId: "..." }, 그 외 → { code, message }
  const json = (await res.json().catch(() => ({}))) as {
    messageId?: string;
    message?: string;
    code?: string;
  };
  if (!res.ok) {
    const msg = json.message ? `${json.code ?? 'BREVO'}: ${json.message}` : `HTTP ${res.status}`;
    return { ok: false, status: res.status, error: msg };
  }
  return { ok: true, status: res.status, messageId: json.messageId };
}
