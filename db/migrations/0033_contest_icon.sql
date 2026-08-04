-- 대회 아이콘(로고) — 표출 화면 상단 중앙에 얹는 이미지.
--   contests.icon_image   : Supabase Storage `contest-icons` 버킷의 public URL.
--   contests.icon_opacity : 0-100. 배경 이미지와 동일한 투명도 규칙.
-- 비어있으면 아이콘을 그리지 않는다(기존 동작 그대로).
alter table public.contests
  add column if not exists icon_image text not null default '',
  add column if not exists icon_opacity int not null default 100
    check (icon_opacity between 0 and 100);
