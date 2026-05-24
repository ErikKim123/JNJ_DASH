-- PREP 화면 하단 광고 슬롯별 투명도 (0-100 정수).
-- sponsor_logos 배열과 1:1 매칭. 값이 없으면 100 (불투명) 으로 간주.

alter table public.contests
  add column if not exists sponsor_logo_opacities int[] not null default '{}';
