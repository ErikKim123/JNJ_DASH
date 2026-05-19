-- 결승 채점 항목 확장 + 대회별 활성/비활성 토글.
--
-- 채점 항목 (6개) — UI 라벨은 영문, DB 컬럼은 historical 명명을 유지:
--   fundamentals    → judge_votes.basic_score          (기존)
--   connection      → judge_votes.connectivity_score   (기존)
--   musicality      → judge_votes.musicality_score     (기존)
--   creativity      → judge_votes.creativity_score     (신규)
--   crowd_reaction  → judge_votes.crowd_reaction_score (신규)
--   showmanship     → judge_votes.showmanship_score    (신규)
--
-- 대회별 활성 항목은 contests.scoring_items (jsonb string[]) 에 저장.
-- 기본값은 기존 3개 (fundamentals, connection, musicality) — 기존 데이터 영향 없음.

alter table public.judge_votes
  add column if not exists creativity_score      numeric(5,2),
  add column if not exists crowd_reaction_score  numeric(5,2),
  add column if not exists showmanship_score     numeric(5,2);

alter table public.contests
  add column if not exists scoring_items jsonb
    not null
    default '["fundamentals","connection","musicality"]'::jsonb;

-- 유효성 — array 형태인지만 검사. 값 화이트리스트는 애플리케이션 레이어(zod)에서.
do $$ begin
  alter table public.contests
    add constraint contests_scoring_items_is_array
    check (jsonb_typeof(scoring_items) = 'array');
exception when duplicate_object then null;
end $$;
