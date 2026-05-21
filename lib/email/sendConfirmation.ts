// 참가 접수 확인 메일 발송 — submit API 에서 fire-and-forget 으로 호출.
// 메일 실패가 등록 트랜잭션을 깨면 안 되므로 throw 하지 않고 boolean 으로 결과만 반환.
import { getResend, getFromAddress } from './client';
import { buildSubject, buildHtmlBody, buildTextBody, type ConfirmationVars } from './templates';

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

export interface SendResult {
  sent: boolean;
  reason?: 'NO_API_KEY' | 'INVALID_TO' | 'PROVIDER_ERROR';
  error?: string;
  id?: string;
}

export async function sendConfirmationEmail(
  to: string,
  vars: ConfirmationVars
): Promise<SendResult> {
  if (!to || !EMAIL_RE.test(to.trim())) {
    return { sent: false, reason: 'INVALID_TO' };
  }
  const client = getResend();
  if (!client) return { sent: false, reason: 'NO_API_KEY' };

  try {
    const { data, error } = await client.emails.send({
      from: getFromAddress(),
      to: [to.trim()],
      subject: buildSubject(vars),
      html: buildHtmlBody(vars),
      text: buildTextBody(vars),
    });
    if (error) {
      return { sent: false, reason: 'PROVIDER_ERROR', error: error.message };
    }
    return { sent: true, id: data?.id };
  } catch (e) {
    return {
      sent: false,
      reason: 'PROVIDER_ERROR',
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
