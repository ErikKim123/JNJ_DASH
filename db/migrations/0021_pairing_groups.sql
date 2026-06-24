-- 페어링 그룹별 커플 수 배열. 예: 예선 [20,20,20] → A·B·C, 본선 [10,10] → A·B.
-- 각 원소가 해당 그룹(A부터 순서대로)에 들어갈 커플 수. 빈 배열이면 그룹 미사용(전체 한 목록).
-- 기존 prelim_group_size/semi_group_size(균등 분할)는 배열이 비어있을 때의 폴백으로만 유지.
alter table public.contests
  add column if not exists prelim_groups jsonb not null default '[]'::jsonb;
alter table public.contests
  add column if not exists semi_groups jsonb not null default '[]'::jsonb;
