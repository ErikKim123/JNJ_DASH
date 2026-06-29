-- 라운드별 "추가 영상"(예선/본선/결승 각 3개) — 표출 화면 오른쪽 위 버튼으로
-- 전체화면 오버레이 재생하는 보조 YouTube 영상들.
-- 형태: {"prelim":["","",""],"semi":["","",""],"final":["","",""]} (빈 칸은 빈 문자열)
alter table public.contests
  add column if not exists extra_videos jsonb not null default '{}'::jsonb;
