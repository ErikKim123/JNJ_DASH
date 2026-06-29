-- 심사위원의 해당 라운드 채점 "제출 완료" 시각.
-- null = 아직 제출 안 함(채점 중), 값 있음 = 제출 완료(관리자 매트릭스에서 컬럼 녹색 표시).
-- 라운드별 judges row 마다 독립 — 예선/본선/결승 제출 상태를 따로 관리한다.
-- 제출 후에도 점수 입력은 막지 않는다(시야 표시 용도); 다시 누르면 제출 해제.
alter table public.judges
  add column if not exists submitted_at timestamptz;
