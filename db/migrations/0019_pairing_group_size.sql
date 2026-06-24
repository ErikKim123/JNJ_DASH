-- 페어링 그룹(조) 분할용 "그룹당 커플 수".
--   값 > 0 이면 페어링 목록을 해당 수만큼씩 끊어 A·B·C… 그룹으로 나눠 표시.
--   0(기본) 이면 그룹 구분 없이 전체를 한 목록으로 표시(기존 동작 유지).
-- 라운드(prelim/semi)별로 따로 설정.
alter table public.contests
  add column if not exists prelim_group_size integer not null default 0;
alter table public.contests
  add column if not exists semi_group_size integer not null default 0;
