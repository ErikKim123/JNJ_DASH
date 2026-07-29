// 결승 RESULT 발표(reveal) 순서 — 표출 화면 클릭 / MC 원격 "다음 발표" 가 이 순서로 진행한다.
// 팔로워 3 → 리더 3 → 팔로워 2 → 리더 2 → 팔로워 1 → 리더 1.
export const FINAL_REVEAL_ORDER = ['F-3', 'L-3', 'F-2', 'L-2', 'F-1', 'L-1'] as const;

export type RevealId = (typeof FINAL_REVEAL_ORDER)[number];

/** MC 콘솔에서 "다음에 발표될 자리" 를 한글로 보여주기 위한 라벨. */
export const REVEAL_LABEL: Record<RevealId, string> = {
  'F-3': '팔로워 3위',
  'L-3': '리더 3위',
  'F-2': '팔로워 2위',
  'L-2': '리더 2위',
  'F-1': '팔로워 1위',
  'L-1': '리더 1위',
};
