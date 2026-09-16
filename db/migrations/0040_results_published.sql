-- 결승 결과 웹게시 — 대회가 끝난 뒤 순위·점수를 공개 페이지로 내보낸다.
--
-- 지금까지 결과 발표는 표출 화면(프로젝터)에서만 이뤄졌다. 현장을 떠난 사람,
-- 못 온 사람, 나중에 찾아보는 사람에게 보여 줄 곳이 없어 운영팀이 스크린샷을
-- 찍어 SNS 에 올리거나 외부 사이트에 손으로 옮겨 적었다 — 옮겨 적는 과정에서
-- 점수가 틀리는 일이 실제로 있었다.
--
-- 플래그 하나로 /results/<대회ID> 공개 페이지를 열고 닫는다. 켜기 전에는 그 주소가
-- 404 다 — 채점이 끝나기 전에 링크가 새도 중간 순위가 보이지 않는다.
--
-- results_published_at 은 '언제 공개했는지' 를 공개 페이지 하단에 적기 위한 값이다.
-- 결과를 고친 뒤 다시 게시하면 갱신된다(내렸다가 다시 올리면 새 시각).
--
-- 기본값 false — 적용 즉시 모든 대회가 비공개다. 운영자가 대회별로 켠다.
-- idempotent.

alter table public.contests
  add column if not exists results_published boolean not null default false;

alter table public.contests
  add column if not exists results_published_at timestamptz;

comment on column public.contests.results_published is
  '결승 결과 공개 페이지(/results/<id>) 노출 여부. false 면 404.';

comment on column public.contests.results_published_at is
  '마지막으로 게시를 켠 시각. 공개 페이지의 "게시 시각" 표기에 쓴다.';
