// 이메일 본문 템플릿 — 영어 전용. (라이트 테마 — JOIN 확인 카드와 동일한 룩)
// 외부 의존성 없이 inline-style HTML 로 작성 (메일 클라이언트 호환성).

export interface ConfirmationVars {
  /** 참가자 표시명 (대표자/팀명 우선) */
  displayName: string;
  /** 참가 번호 */
  num: string;
  /** 대회 이름 */
  contestName: string;
  /** 대회 ID (헤더 표시용) */
  contestId: string;
  /** 대회 기간 — 'YYYY-MM-DD ~ YYYY-MM-DD' 등. 빈 문자열 허용. */
  period: string;
  /** SNS 방(커뮤니티 채팅) 링크. 빈 문자열이면 버튼 숨김. */
  snsUrl?: string;
}

// 참가비 결제 페이지 링크 (done 화면 버튼과 동일).
const PAYMENT_URL = 'https://phuquocsummerlatinfest.com/jj-competition-battle-2026';

export function buildSubject(v: ConfirmationVars): string {
  // 제목은 ASCII 문자만 사용 — '·'(U+00B7) 같은 비ASCII 문자는 일부 메일
  // 클라이언트에서 글자 깨짐(mojibake)을 유발하므로 '-' 로 표기.
  return `[${v.contestName}] Entry confirmed - No. ${v.num}`;
}

export function buildTextBody(v: ConfirmationVars): string {
  const sns = isValidUrl(v.snsUrl);
  return [
    `Hello ${v.displayName},`,
    ``,
    `Your entry to ${v.contestName} has been received.`,
    `Please arrive 30 minutes before the competition starts. Your participant number is ${v.num}.`,
    v.period ? `Schedule: ${v.period}` : '',
    ``,
    `To complete your registration, please make your participation-fee payment here:`,
    PAYMENT_URL,
    ...(sns
      ? ['', `Join the community chat for more info:`, v.snsUrl as string]
      : []),
    ``,
    `JNJ JOIN`,
  ]
    .filter((line) => line !== '')
    .join('\n');
}

export function buildHtmlBody(v: ConfirmationVars): string {
  // 메일 클라이언트는 <link>, <style> 차단이 흔해 inline style 만 사용.
  const sns = isValidUrl(v.snsUrl);
  return /* html */ `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(buildSubject(v))}</title>
  </head>
  <body style="margin:0;padding:0;background:#F5F5F5;font-family:-apple-system,'Segoe UI','Helvetica Neue',Helvetica,Arial,sans-serif;color:#111111;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F5F5;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border-radius:16px;overflow:hidden;border:1px solid #E5E5E5;">
            <tr>
              <td style="padding:28px 28px 8px 28px;">
                <div style="font-family:'Courier New',ui-monospace,monospace;font-size:11px;letter-spacing:0.1em;color:#707072;text-transform:uppercase;">
                  JNJ JOIN · ${escapeHtml(v.contestId)}
                </div>
                <h1 style="margin:12px 0 0 0;font-family:Oswald,'Helvetica Neue',Arial,sans-serif;font-size:28px;line-height:1.1;letter-spacing:-0.01em;text-transform:uppercase;color:#111111;">
                  Entry Confirmed.
                </h1>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 28px 0 28px;">
                <div style="font-size:13px;color:#707072;letter-spacing:0.05em;text-transform:uppercase;font-weight:600;margin-bottom:6px;">
                  PARTICIPANT NUMBER
                </div>
                <div style="font-family:Oswald,'Helvetica Neue',Arial,sans-serif;font-size:64px;line-height:1;color:#111111;letter-spacing:-0.02em;font-weight:600;">
                  No. ${escapeHtml(v.num)}
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 28px 0 28px;">
                <p style="margin:0 0 12px 0;font-size:16px;line-height:1.6;color:#111111;">
                  Hello <strong>${escapeHtml(v.displayName)}</strong>,
                </p>
                <p style="margin:0 0 12px 0;font-size:16px;line-height:1.6;color:#111111;">
                  Your entry to <strong>${escapeHtml(v.contestName)}</strong> has been received.
                </p>
                <p style="margin:0 0 4px 0;font-size:16px;line-height:1.6;color:#111111;">
                  Please arrive <strong>30 minutes</strong> before the competition starts.
                  Your participant number is <strong>${escapeHtml(v.num)}</strong>.
                </p>
                ${
                  v.period
                    ? `<p style="margin:8px 0 0 0;font-size:14px;color:#707072;">Schedule · ${escapeHtml(v.period)}</p>`
                    : ''
                }
              </td>
            </tr>
            <!-- 결제 버튼 -->
            <tr>
              <td style="padding:20px 28px 28px 28px;">
                <p style="margin:0 0 12px 0;font-size:14px;line-height:1.6;color:#707072;">
                  To complete your registration, please make your participation-fee payment below.
                </p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center" bgcolor="#E11D2A" style="border-radius:9999px;">
                      <a href="${escapeHtml(PAYMENT_URL)}" target="_blank" rel="noopener noreferrer"
                         style="display:block;color:#FFFFFF;text-align:center;text-decoration:none;font-size:16px;font-weight:700;padding:16px 20px;border-radius:9999px;">
                        Make Your Payment
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            ${
              sns
                ? /* html */ `<!-- SNS 방(커뮤니티 채팅) 버튼 -->
            <tr>
              <td style="padding:0 28px 28px 28px;">
                <p style="margin:0 0 12px 0;font-size:14px;line-height:1.6;color:#707072;">
                  Join the community chat for schedule updates and more info.
                </p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center" bgcolor="#111111" style="border-radius:9999px;">
                      <a href="${escapeHtml(v.snsUrl as string)}" target="_blank" rel="noopener noreferrer"
                         style="display:block;color:#FFFFFF;text-align:center;text-decoration:none;font-size:16px;font-weight:700;padding:16px 20px;border-radius:9999px;">
                        Join the Community Chat
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>`
                : ''
            }
          </table>
          <p style="font-size:11px;color:#9E9EA0;margin:16px 0 0 0;letter-spacing:0.05em;text-transform:uppercase;">
            JNJ DASH · Automated message
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

// http/https 로 시작하는 유효 URL 인지 검사 (done 화면 SNS 노출 조건과 동일).
function isValidUrl(u?: string): boolean {
  return !!u && /^https?:\/\//i.test(u.trim());
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
