-- 온라인 심사위원의 결승 채점 "제출 완료" 시각.
--   null = 채점 중(수정 가능), 값 있음 = 제출 완료(잠금 · 관리자 매트릭스 녹색 표시).
--   VOTE 앱의 judges.submitted_at 과 동일한 개념(온라인은 결승만이라 단일 컬럼).
alter table public.online_judges
  add column if not exists final_submitted_at timestamptz;
