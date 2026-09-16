// 판정 마크의 점수 환산 — O/M/X 가 몇 표인지는 여기 한 곳에서만 정한다.
//
// 집계하는 곳이 넷(통과자 확정 · 실시간 순위 · 관리자 매트릭스 합계 · 심사위원
// 활동량)이라, 각자 `=== 'O'` 로 세면 M 을 추가할 때 한 군데를 빠뜨리기 쉽다.
// 실제로 빠뜨리면 화면마다 다른 등수가 나온다.

import type { VoteMark } from '@/lib/db/types';

/** 마크 한 개의 표 값. M(MAY)은 반 표 — 동점을 가르려고 넣은 눈금이다. */
export const MARK_VALUE: Record<VoteMark, number> = {
  O: 1,
  M: 0.5,
  X: 0,
};

/** 미채점(null)은 0표. */
export function markValue(mark: VoteMark | null | undefined): number {
  return mark ? MARK_VALUE[mark] ?? 0 : 0;
}

/**
 * 표 합계를 화면·저장용으로 다듬는다.
 *
 * 0.5 단위 합이라 부동소수 오차가 붙을 수 있다(0.1+0.2 문제와 같은 계열).
 * 소수 첫째 자리에서 끊어 12.5 는 12.5 로, 13 은 13 으로 만든다.
 */
export function roundVotes(n: number): number {
  return Math.round(n * 10) / 10;
}

/** 표 합계 표기 — 정수면 '12', 반 표가 있으면 '12.5'. */
export function formatVotes(n: number | null | undefined): string {
  if (n == null) return '0';
  const v = roundVotes(Number(n));
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}
