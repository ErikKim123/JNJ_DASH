// 이메일 본문 템플릿 — 영어 전용. JOIN done(완료) 화면과 동일한 내용·룩(다크 테마).
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
}

// done 화면 안내와 동일한 발신자 주소.
const SENDER_DISPLAY = 'bandnara123@gmail.com';

export function buildSubject(v: ConfirmationVars): string {
  // 제목은 ASCII 문자만 사용 — '·'(U+00B7) 같은 비ASCII 문자는 일부 메일
  // 클라이언트에서 글자 깨짐(mojibake)을 유발하므로 '-' 로 표기.
  return `[${v.contestName}] Entry confirmed - No. ${v.num}`;
}

export function buildTextBody(v: ConfirmationVars): string {
  const meta = [v.contestName, v.period].filter(Boolean).join(' · ');
  return [
    `YOUR ENTRY IS CONFIRMED.`,
    `Your registration has been received.`,
    ``,
    `Your confirmation e-mail has been sent by ${SENDER_DISPLAY}. Please join the Whatsapp group chat and make your payments for J&J (if you haven't already) through the links in the e-mail.`,
    ``,
    `Participant number: No. ${v.num}`,
    meta ? meta : '',
    ``,
    `Please arrive 30 minutes before the contest starts. Tell the staff your participant number at check-in.`,
    ``,
    `JNJ JOIN`,
  ]
    .filter((line) => line !== '')
    .join('\n');
}

export function buildHtmlBody(v: ConfirmationVars): string {
  // 메일 클라이언트는 <link>, <style> 차단이 흔해 inline style 만 사용.
  const meta = [v.contestName, v.period].filter(Boolean).join(' · ');
  return /* html */ `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(buildSubject(v))}</title>
  </head>
  <body style="margin:0;padding:0;background:#17090C;font-family:-apple-system,'Segoe UI','Helvetica Neue',Helvetica,Arial,sans-serif;color:#F3E7E8;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#17090C;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
            <!-- 코드 -->
            <tr>
              <td style="padding:0 28px;">
                <div style="font-family:'Courier New',ui-monospace,monospace;font-size:11px;letter-spacing:0.12em;color:#A48E90;text-transform:uppercase;">
                  JNJ / ${escapeHtml(v.contestId)}
                </div>
              </td>
            </tr>
            <!-- 성공 배지 -->
            <tr>
              <td style="padding:28px 28px 0 28px;">
                <span style="display:inline-block;padding:8px 14px;border-radius:9999px;background:rgba(0,125,72,0.12);border:1px solid rgba(0,125,72,0.35);color:#3FCB7D;font-size:13px;font-weight:600;">
                  &#10003;&nbsp; Entry Confirmed
                </span>
              </td>
            </tr>
            <!-- 헤더 -->
            <tr>
              <td style="padding:18px 28px 0 28px;">
                <h1 style="margin:0;font-family:Oswald,'Helvetica Neue',Arial,sans-serif;font-size:44px;line-height:1.0;letter-spacing:-0.01em;text-transform:uppercase;font-weight:700;color:#F3E7E8;">
                  Your entry is<br/>confirmed.
                </h1>
                <p style="margin:14px 0 0 0;font-family:'Courier New',ui-monospace,monospace;font-size:13px;letter-spacing:0.08em;color:#A48E90;text-transform:uppercase;">
                  Your registration has been received.
                </p>
              </td>
            </tr>
            <!-- 안내: 메일/결제 -->
            <tr>
              <td style="padding:18px 28px 0 28px;">
                <p style="margin:0;font-size:14px;line-height:1.6;color:#A48E90;">
                  Your confirmation e-mail has been sent by
                  <strong style="color:#F3E7E8;">${escapeHtml(SENDER_DISPLAY)}</strong>.
                  Please join the Whatsapp group chat and make your payments
                  for J&amp;J (if you haven&apos;t already) through the links in the e-mail.
                </p>
              </td>
            </tr>
            <!-- 참가 번호 카드 -->
            <tr>
              <td style="padding:28px 28px 0 28px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#251417;border:1px solid #3A2529;border-radius:16px;">
                  <tr>
                    <td style="padding:22px 24px;">
                      <div style="font-family:'Courier New',ui-monospace,monospace;font-size:11px;color:#A48E90;letter-spacing:0.12em;font-weight:600;">
                        PARTICIPANT NUMBER
                      </div>
                      <div style="font-family:Oswald,'Helvetica Neue',Arial,sans-serif;font-size:64px;line-height:1;color:#F3E7E8;letter-spacing:-0.02em;font-weight:700;margin-top:8px;">
                        No. ${escapeHtml(v.num)}
                      </div>
                      ${
                        meta
                          ? `<div style="margin-top:12px;font-size:13px;color:#A48E90;">${escapeHtml(meta)}</div>`
                          : ''
                      }
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <!-- 체크인 안내 -->
            <tr>
              <td style="padding:22px 28px 0 28px;">
                <p style="margin:0;font-size:16px;line-height:1.7;color:#F3E7E8;">
                  Please arrive <strong>30 minutes before</strong> the contest starts.
                  <br/>
                  Tell the staff your <strong>participant number</strong> at check-in.
                </p>
              </td>
            </tr>
            <!-- 푸터 -->
            <tr>
              <td style="padding:32px 28px 0 28px;">
                <p style="margin:0;font-size:11px;color:#6E595B;letter-spacing:0.08em;text-transform:uppercase;">
                  JNJ DASH &middot; Automated message
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
