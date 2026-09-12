// WOLF ↔ J&J Dash 관객 심사 SSO 토큰 검증.
//
// WOLF(worldoflatinfestivals.com) 회원은 이름·연락처·이메일을 이미 그쪽에 등록해 두었다.
// 그 사실을 WOLF 가 서명해 보내 주면, 여기서 등록 폼과 PIN 입력을 건너뛰고 바로 채점으로 보낸다.
//
// 토큰에는 '누구인지' 만 들어 있다. PIN 은 오지 않는다 — 링크가 새면 그 사람 이름으로
// 채점할 수 있게 되기 때문이다. 계정 생성·PIN 발급은 이 앱이 자기 쪽에서 한다.
//
// 이 파일은 WOLF 저장소(packages/shared/src/jnj-sso.ts)와 같은 규칙이어야 한다.
// 한쪽만 고치면 서명이 어긋나 전부 BAD_SIGNATURE 가 된다.
import { createHmac, timingSafeEqual } from 'node:crypto';

/** 토큰이 살아 있는 시간. 클릭 직후 한 번 쓰이고 버려지는 값이라 짧게 잡는다. */
export const JNJ_SSO_TTL_SEC = 120;

export interface JnjSsoPayload {
  /** 계정을 찾는 열쇠 — audience_judges.email_key 와 맞춘다. */
  email: string;
  /** 전체 이름 그대로 — 성/이름 분리는 이 앱의 규칙(splitFullName)으로 한다. */
  name: string;
  phone: string;
  /** 국가 표기 — audience_judges.representative 로 들어간다. */
  country: string;
  photoUrl: string;
  /** 어느 대회로 들어가는지 — 토큰을 다른 대회에 돌려쓰지 못하게 서명에 포함돼 있다. */
  contestId: string;
  /** 발급 시각(초). 만료 판정용. */
  iat: number;
}

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64url(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function sign(body: string, secret: string): string {
  return base64url(createHmac('sha256', secret).update(body).digest());
}

export type JnjSsoResult =
  | { ok: true; payload: JnjSsoPayload }
  | { ok: false; reason: 'MALFORMED' | 'BAD_SIGNATURE' | 'EXPIRED' | 'CONTEST_MISMATCH' };

/**
 * 토큰 검증 — 서명·만료·대회 일치까지 본다.
 *
 * 같은 토큰을 만료 전에 두 번 써도 막지 않는다(일회용 저장소 없음):
 * 하는 일이 '계정 찾거나 만들고 참여 붙이기' 라 여러 번 해도 결과가 같다.
 */
export function verifyJnjSsoToken(
  token: string,
  secret: string,
  contestId: string,
  nowSec = Math.floor(Date.now() / 1000)
): JnjSsoResult {
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return { ok: false, reason: 'MALFORMED' };
  const body = token.slice(0, dot);
  const given = token.slice(dot + 1);

  const expected = sign(body, secret);
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: 'BAD_SIGNATURE' };

  let payload: JnjSsoPayload;
  try {
    payload = JSON.parse(fromBase64url(body).toString('utf8')) as JnjSsoPayload;
  } catch {
    return { ok: false, reason: 'MALFORMED' };
  }
  if (!payload?.email || typeof payload.iat !== 'number') return { ok: false, reason: 'MALFORMED' };
  // 시계가 조금 앞서 있을 수 있어 미래 쪽으로 30초 여유를 준다.
  if (payload.iat > nowSec + 30 || nowSec - payload.iat > JNJ_SSO_TTL_SEC) {
    return { ok: false, reason: 'EXPIRED' };
  }
  if (payload.contestId !== contestId) return { ok: false, reason: 'CONTEST_MISMATCH' };
  return { ok: true, payload };
}
