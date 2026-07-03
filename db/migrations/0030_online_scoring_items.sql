-- 온라인 심사위원 전용 결승 채점 항목.
--
-- 판정단(scoring_items)과 별개로 온라인 심사위원은 자체 6개 기준을 사용한다.
-- 라벨/의미는 다르지만 점수 저장은 online_judge_votes 의 동일 6 컬럼을 재사용:
--   wow_factor       → online_judge_votes.basic_score
--   stage_presence   → online_judge_votes.connectivity_score
--   visual_impact    → online_judge_votes.musicality_score
--   crowd_connection → online_judge_votes.creativity_score
--   team_chemistry   → online_judge_votes.crowd_reaction_score
--   musical_energy   → online_judge_votes.showmanship_score
--
-- 대회별 활성 항목은 contests.online_scoring_items (jsonb string[]) 에 저장.
-- 기본값은 6개 전체 활성.

alter table public.contests
  add column if not exists online_scoring_items jsonb
    not null
    default '["wow_factor","stage_presence","visual_impact","crowd_connection","team_chemistry","musical_energy"]'::jsonb;

-- 유효성 — array 형태인지만 검사. 값 화이트리스트는 애플리케이션 레이어(zod)에서.
do $$ begin
  alter table public.contests
    add constraint contests_online_scoring_items_is_array
    check (jsonb_typeof(online_scoring_items) = 'array');
exception when duplicate_object then null;
end $$;
