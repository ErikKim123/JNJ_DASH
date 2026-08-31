'use client';

// 관객 심사위원 VOTE 앱 세션 — 대회별로 로그인한 심사위원 정보를 localStorage 보관.
// (VOTE 앱과 동일하게 별도 인증 쿠키 없이 클라이언트 저장. judgeId 는 uuid 라 추측 불가.)

export interface OJudgeSession {
  judgeId: string;
  name: string;
  displayOrder: number;
  /** 전역 심사위원 번호(0037). 계정 없이 남은 옛 등록은 null. */
  judgeNo?: number | null;
}

const key = (contestId: string) => `ojvote.session.${contestId}`;

// 마지막으로 로그인에 쓴 번호/이메일 — 대회가 달라도 같은 계정이므로 다음 대회에서 미리 채워준다.
// PIN 은 저장하지 않는다.
const LAST_ID_KEY = 'ojvote.lastIdentifier';

export function getLastIdentifier(): string {
  try { return localStorage.getItem(LAST_ID_KEY) ?? ''; } catch { return ''; }
}

export function setLastIdentifier(identifier: string): void {
  try { localStorage.setItem(LAST_ID_KEY, identifier); } catch { /* ignore */ }
}

export function getSession(contestId: string): OJudgeSession | null {
  try {
    const raw = localStorage.getItem(key(contestId));
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (s && typeof s.judgeId === 'string') return s as OJudgeSession;
  } catch { /* ignore */ }
  return null;
}

export function setSession(contestId: string, s: OJudgeSession): void {
  try { localStorage.setItem(key(contestId), JSON.stringify(s)); } catch { /* ignore */ }
}

export function clearSession(contestId: string): void {
  try { localStorage.removeItem(key(contestId)); } catch { /* ignore */ }
}
