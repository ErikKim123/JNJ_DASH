-- 대회별 커스텀 배경 이미지의 투명도 (0-100 정수).
-- background_image 가 설정된 경우에만 의미 있음. 기본 100 (불투명).

alter table public.contests
  add column if not exists background_opacity int not null default 100
  check (background_opacity >= 0 and background_opacity <= 100);
