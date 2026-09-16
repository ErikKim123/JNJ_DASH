-- 참가자 명단 · 예선 통과자 · 본선 통과자 웹게시 — 섹션별로 따로 연다.
--
-- 지금까지 공개 페이지는 결승 결과 플래그(results_published) 하나로만 열렸다.
-- 그런데 운영 순서는 한 번에 끝나지 않는다: 대회 전에 참가자 명단을 먼저 돌리고,
-- 예선이 끝나면 통과자를, 본선이 끝나면 다시 통과자를 알린다. 스위치가 하나뿐이라
-- 참가자 명단을 공개하려면 아직 나오지도 않은 결승 순위까지 함께 열려야 했다.
--
-- 그래서 섹션마다 스위치를 둔다. 공개 페이지에는 켜진 섹션만 나오고,
-- 네 개 모두 꺼져 있으면 그 주소는 404 다(결승은 기존 results_published 를 그대로 쓴다).
--
-- *_published_at 은 '언제 공개했는지' — 공개 페이지 하단 표기에 쓴다.
-- 내릴 때 지우지 않는다: 마지막으로 공개했던 시각이 운영 기록으로 남는다.
--
-- 기본값 false — 적용 즉시 모든 섹션이 비공개. 운영자가 탭에서 하나씩 켠다.
-- idempotent.

alter table public.contests
  add column if not exists participants_published boolean not null default false;
alter table public.contests
  add column if not exists participants_published_at timestamptz;

alter table public.contests
  add column if not exists prelim_published boolean not null default false;
alter table public.contests
  add column if not exists prelim_published_at timestamptz;

alter table public.contests
  add column if not exists semi_published boolean not null default false;
alter table public.contests
  add column if not exists semi_published_at timestamptz;

comment on column public.contests.participants_published is
  '공개 페이지의 참가자 명단 노출 여부.';
comment on column public.contests.prelim_published is
  '공개 페이지의 예선 통과자 표 노출 여부.';
comment on column public.contests.semi_published is
  '공개 페이지의 본선 통과자 표 노출 여부.';
