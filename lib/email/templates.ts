// 이메일 본문 템플릿 — 한국어/영어. (라이트 테마 — JOIN 확인 카드와 동일한 룩)
// 외부 의존성 없이 inline-style HTML 로 작성 (메일 클라이언트 호환성).
//
// 언어는 참가자가 신청 폼에서 고른 쪽을 따른다. 고른 기록이 없으면(어드민 재발송 등)
// 국가로 정한다 — 신청 폼의 국가 선택은 나라 '이름' 을 그대로 저장하므로 'Korea' 면 한국어.

import { formatArrivalLead } from '@/lib/join/arrival';

export type MailLang = 'ko' | 'en';

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
  /** 참가비 결제 페이지 링크. 빈 문자열이면 결제 버튼 숨김. */
  paymentUrl?: string;
  /** 본문 언어. 미지정이면 영어. */
  lang?: MailLang;
  /** 도착 안내 시간(분) — 대회 설정값. 미지정이면 60분. */
  arrivalMinutes?: number;
}

/** 신청 폼의 국가 선택에서 한국을 가리키는 표기들. */
const KOREA = /^(korea|south korea|republic of korea|kr|kor|대한민국|한국)$/i;

/**
 * 이 참가자에게 보낼 메일 언어.
 *   1) 신청 폼에서 고른 언어가 있으면 그대로 — 본인이 그 언어로 폼을 채웠다는 게 가장 확실한 신호다.
 *   2) 없으면 국가로 — 어드민 재발송에는 폼 언어가 남아 있지 않다.
 */
export function pickMailLang(opts: { formLang?: string | null; country?: string | null }): MailLang {
  const f = (opts.formLang ?? '').trim();
  if (f === 'ko' || f === 'en') return f;
  return KOREA.test((opts.country ?? '').trim()) ? 'ko' : 'en';
}

/** 메일에 나가는 모든 문구 — 두 언어를 나란히 둬서 한쪽만 고쳐지는 일이 없게 한다. */
const COPY = {
  subject: {
    en: (v: ConfirmationVars) => `[${v.contestName}] Entry confirmed - No. ${v.num}`,
    ko: (v: ConfirmationVars) => `[${v.contestName}] 참가 접수 완료 - ${v.num}번`,
  },
  title: { en: 'Entry Confirmed.', ko: '참가 접수 완료' },
  numberLabel: { en: 'PARTICIPANT NUMBER', ko: '참가 번호' },
  hello: {
    en: (name: string) => `Hello <strong>${name}</strong>,`,
    ko: (name: string) => `<strong>${name}</strong>님, 안녕하세요.`,
  },
  received: {
    en: (contest: string) => `Your entry to <strong>${contest}</strong> has been received.`,
    ko: (contest: string) => `<strong>${contest}</strong> 참가 신청이 접수되었습니다.`,
  },
  arrive: {
    en: (num: string, lead: string) =>
      `Please arrive <strong>${lead}</strong> before the competition starts. Your participant number is <strong>${num}</strong>.`,
    ko: (num: string, lead: string) =>
      `대회 시작 <strong>${lead} 전</strong>까지 도착해 주세요. 참가 번호는 <strong>${num}</strong>번입니다.`,
  },
  payLead: {
    en: 'To complete your registration, please make your participation-fee payment below.',
    ko: '참가 신청을 마치려면 아래에서 참가비를 결제해 주세요.',
  },
  payButton: { en: 'Make Your Payment', ko: '참가비 결제하기' },
  snsLead: {
    en: 'Join the group chat for schedule updates and more info.',
    ko: '일정 안내와 추가 정보는 단체 채팅방에서 받아보실 수 있습니다.',
  },
  snsButton: { en: 'Join the Group Chat', ko: '단체 채팅방 참여하기' },
  footer: { en: 'JNJ DASH · Automated message', ko: 'JNJ DASH · 자동 발송 메일' },

  // 순수 텍스트 본문용 — 태그 없는 같은 문장.
  textHello: { en: (n: string) => `Hello ${n},`, ko: (n: string) => `${n}님, 안녕하세요.` },
  textReceived: {
    en: (c: string) => `Your entry to ${c} has been received.`,
    ko: (c: string) => `${c} 참가 신청이 접수되었습니다.`,
  },
  textArrive: {
    en: (num: string, lead: string) =>
      `Please arrive ${lead} before the competition starts. Your participant number is ${num}.`,
    ko: (num: string, lead: string) => `대회 시작 ${lead} 전까지 도착해 주세요. 참가 번호는 ${num}번입니다.`,
  },
  textPay: {
    en: 'To complete your registration, please make your participation-fee payment here:',
    ko: '참가 신청을 마치려면 아래에서 참가비를 결제해 주세요:',
  },
  textSns: { en: 'Join the group chat for more info:', ko: '자세한 안내는 단체 채팅방에서:' },
} as const;

const langOf = (v: ConfirmationVars): MailLang => (v.lang === 'ko' ? 'ko' : 'en');
const leadOf = (v: ConfirmationVars): string =>
  formatArrivalLead(v.arrivalMinutes ?? 60, langOf(v));

export function buildSubject(v: ConfirmationVars): string {
  // 제목에 '·'(U+00B7) 같은 기호는 쓰지 않는다 — 일부 메일 클라이언트에서 글자가 깨진다.
  // 한글 제목은 Brevo 가 UTF-8 로 인코딩해 내보내므로 그대로 써도 안전하다.
  return COPY.subject[langOf(v)](v);
}

export function buildTextBody(v: ConfirmationVars): string {
  const L = langOf(v);
  const sns = isValidUrl(v.snsUrl);
  const pay = isValidUrl(v.paymentUrl);
  return [
    COPY.textHello[L](v.displayName),
    ``,
    COPY.textReceived[L](v.contestName),
    COPY.textArrive[L](v.num, leadOf(v)),
    ...(pay ? ['', COPY.textPay[L], v.paymentUrl as string] : []),
    ...(sns ? ['', COPY.textSns[L], v.snsUrl as string] : []),
    ``,
    `JNJ JOIN`,
  ]
    .filter((line) => line !== '')
    .join('\n');
}

export function buildHtmlBody(v: ConfirmationVars): string {
  // 메일 클라이언트는 <link>, <style> 차단이 흔해 inline style 만 사용.
  const L = langOf(v);
  const sns = isValidUrl(v.snsUrl);
  const pay = isValidUrl(v.paymentUrl);
  return /* html */ `<!doctype html>
<html lang="${L}">
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
                  ${COPY.title[L]}
                </h1>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 28px 0 28px;">
                <div style="font-size:13px;color:#707072;letter-spacing:0.05em;text-transform:uppercase;font-weight:600;margin-bottom:6px;">
                  ${COPY.numberLabel[L]}
                </div>
                <div style="font-family:Oswald,'Helvetica Neue',Arial,sans-serif;font-size:64px;line-height:1;color:#111111;letter-spacing:-0.02em;font-weight:600;">
                  No. ${escapeHtml(v.num)}
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 28px 0 28px;">
                <p style="margin:0 0 12px 0;font-size:16px;line-height:1.6;color:#111111;">
                  ${COPY.hello[L](escapeHtml(v.displayName))}
                </p>
                <p style="margin:0 0 12px 0;font-size:16px;line-height:1.6;color:#111111;">
                  ${COPY.received[L](escapeHtml(v.contestName))}
                </p>
                <p style="margin:0 0 4px 0;font-size:16px;line-height:1.6;color:#111111;">
                  ${COPY.arrive[L](escapeHtml(v.num), leadOf(v))}
                </p>
              </td>
            </tr>
            ${
              pay
                ? /* html */ `<!-- 결제 버튼 -->
            <tr>
              <td style="padding:20px 28px 28px 28px;">
                <p style="margin:0 0 12px 0;font-size:14px;line-height:1.6;color:#707072;">
                  ${COPY.payLead[L]}
                </p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center" bgcolor="#E11D2A" style="border-radius:9999px;">
                      <a href="${escapeHtml(v.paymentUrl as string)}" target="_blank" rel="noopener noreferrer"
                         style="display:block;color:#FFFFFF;text-align:center;text-decoration:none;font-size:16px;font-weight:700;padding:16px 20px;border-radius:9999px;">
                        ${COPY.payButton[L]}
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>`
                : ''
            }
            ${
              sns
                ? /* html */ `<!-- SNS 방(커뮤니티 채팅) 버튼 -->
            <tr>
              <td style="padding:0 28px 28px 28px;">
                <p style="margin:0 0 12px 0;font-size:14px;line-height:1.6;color:#707072;">
                  ${COPY.snsLead[L]}
                </p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center" bgcolor="#111111" style="border-radius:9999px;">
                      <a href="${escapeHtml(v.snsUrl as string)}" target="_blank" rel="noopener noreferrer"
                         style="display:block;color:#FFFFFF;text-align:center;text-decoration:none;font-size:16px;font-weight:700;padding:16px 20px;border-radius:9999px;">
                        ${COPY.snsButton[L]}
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
            ${COPY.footer[L]}
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
