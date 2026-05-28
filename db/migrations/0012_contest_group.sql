-- 대회 그룹 — JOIN APP 에서 대회를 시리즈/주최단위로 묶어서 보여주기 위한 카테고리 컬럼.
-- 예: 'JLCL', 'PSLF' 등 자유 텍스트. 빈 문자열은 "미분류" 그룹으로 처리.
--   같은 group_name 값을 가진 대회들이 같은 폴더에 묶임.
--   admin ContestForm 에서 자유 입력 — 새 그룹은 즉시 생성됨.

alter table public.contests
  add column if not exists group_name text not null default '';

-- 정렬/필터에 자주 쓰이므로 인덱스. 짧은 문자열이라 b-tree 면 충분.
create index if not exists contests_group_name_idx on public.contests (group_name);
