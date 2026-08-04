-- 결승 채점 항목 2개 추가 (판정단 전용).
--
--   audience_impact → judge_votes.audience_impact_score
--   techniques      → judge_votes.techniques_score
--
-- 온라인 심사위원(online_judge_votes)은 기존 6 컬럼만 사용하므로 건드리지 않는다.
-- contests.scoring_items 기본값은 그대로 (fundamentals, connection, musicality) —
-- 새 항목은 대회별로 관리자가 켜야 매트릭스에 나타난다. 기존 데이터 영향 없음.

alter table public.judge_votes
  add column if not exists audience_impact_score numeric(5,2),
  add column if not exists techniques_score      numeric(5,2);
