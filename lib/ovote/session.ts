'use client';

// 온라인 심사위원 VOTE 앱 세션 — 대회별로 로그인한 심사위원 정보를 localStorage 보관.
// (VOTE 앱과 동일하게 별도 인증 쿠키 없이 클라이언트 저장. judgeId 는 uuid 라 추측 불가.)

export interface OJudgeSession {
  judgeId: string;
  name: string;
  displayOrder: number;
}

const key = (contestId: string) => `ojvote.session.${contestId}`;

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
