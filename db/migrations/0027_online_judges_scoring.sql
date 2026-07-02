-- 심사위원 / 온라인 심사위원 사용 여부 + 가중치, 그리고 온라인 결승 채점 테이블.
--
-- 1) contests 설정:
--    · panel_judges_enabled   — 기존 판정단(심사위원) 사용 여부.
--    · online_judges_enabled  — 온라인 심사위원 사용 여부.
--    · panel_judge_weight     — 최종 결과에서 판정단 평균의 가중치.
--    · online_judge_weight    — 최종 결과에서 온라인 평균의 가중치.
--    결합식(평균 가중 합산): 최종 = (판정단평균×panel_w + 온라인평균×online_w) / (panel_w+online_w).
--    한쪽만 사용 시 그쪽 평균이 곧 최종.
--
-- 2) online_judge_votes — 온라인 심사위원 한 명이 결승 진출자 한 명에게 매긴 점수.
--    judge_votes 의 결승 채점 컬럼과 동일 구조(항목별 점수). round 는 결승 전용이라 컬럼 없음.

alter table public.contests
  add column if not exists panel_judges_enabled boolean not null default true,
  add column if not exists online_judges_enabled boolean not null default false,
  add column if not exists panel_judge_weight numeric(6,2) not null default 1,
  add column if not exists online_judge_weight numeric(6,2) not null default 1;

create table if not exists public.online_judge_votes (
  id uuid primary key default gen_random_uuid(),
  online_judge_id uuid not null references public.online_judges(id) on delete cascade,
  participant_num text not null,
  basic_score numeric(5,2),
  connectivity_score numeric(5,2),
  musicality_score numeric(5,2),
  creativity_score numeric(5,2),
  crowd_reaction_score numeric(5,2),
  showmanship_score numeric(5,2),
  updated_at timestamptz not null default now(),
  unique (online_judge_id, participant_num)
);

create index if not exists idx_online_judge_votes_judge
  on public.online_judge_votes(online_judge_id);

drop trigger if exists trg_online_judge_votes_touch on public.online_judge_votes;
create trigger trg_online_judge_votes_touch before update on public.online_judge_votes
  for each row execute function public.touch_updated_at();

-- RLS 활성화 — anon 정책 없음(service_role 전용).
alter table public.online_judge_votes enable row level security;
