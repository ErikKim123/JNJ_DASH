-- AUDIENCE 등록/투표 대회 목록 노출 여부.
--
-- 지금까지 /ojudge/competitions(관객 심사위원 등록)는 archived 아닌 대회를 전부 보여줬고,
-- /ovote/competitions(관객 채점 로그인)는 online_judges_enabled 를 목록 필터로 겸해 썼다.
-- 그 결과 CHECK·DEMO 같은 내부 대회가 관객 화면에 그대로 노출되고,
-- '기능을 쓴다'와 '목록에 띄운다'가 한 플래그에 묶여 따로 끌 수가 없었다.
--
-- audience_listed 는 오직 '목록에 띄울지'만 결정한다. 기능 자체의 on/off 는
-- online_judges_enabled 가 계속 맡는다(투표 제출·집계 게이트).
--   · /ojudge/competitions : audience_listed
--   · /ovote/competitions  : audience_listed AND online_judges_enabled
--
-- 기본값 true — 적용 즉시 기존 노출이 그대로 유지된다(운영자가 끄는 방식).
-- idempotent.

alter table public.contests
  add column if not exists audience_listed boolean not null default true;
