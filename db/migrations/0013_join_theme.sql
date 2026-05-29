-- JOIN APP 톤앤매너(테마) — 대회별로 JOIN 앱의 기본 톤(라이트/다크)과 포인트 색상을 지정.
-- 목적: 대회 목록(다크) → 등록 폼(화이트) 처럼 화면 간 색감이 급변하던 문제를 통일.
--   join_theme  : 'light' | 'dark' — JOIN 앱 전체의 기본 배경/텍스트 톤.
--   join_accent : 포인트 색상 hex (예 '#007D48'). 빈 문자열이면 톤 기본값(잉크색) 사용.
-- 적용 범위: /join 랜딩, /join/competitions(그룹), /join/[contestId] 폼, done 화면.
--   그룹 목록 화면은 그룹 내 대회들의 테마를 집계해 결정한다(다수결 + 첫 포인트색).

-- 기본 톤은 DARK (대회 목록의 블랙 톤을 기본으로 유지하고 등록 폼까지 통일).
alter table public.contests
  add column if not exists join_theme text not null default 'dark',
  add column if not exists join_accent text not null default '';

-- 허용값 가드 — 라이트/다크만.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'contests_join_theme_chk'
  ) then
    alter table public.contests
      add constraint contests_join_theme_chk check (join_theme in ('light', 'dark'));
  end if;
end $$;
