-- 심사위원 투표 — 라운드별 분리.
--   judges       : 라운드별 심사위원 명단 (운영자가 자유롭게 추가/삭제)
--   judge_votes  : 심사위원 × 참가자 셀 (prelim/semi=O·X, final=항목별 점수)
-- 시드는 별도 스크립트(scripts/seed-judging-from-meta.mjs) 에서 처리.

do $$ begin
  create type judging_round as enum ('prelim','semi','final');
exception when duplicate_object then null;
end $$;

-- ─────────────────────────────────────────────────────────────────────────
-- judges — contest × round 별 심사위원 명단
-- display_order 는 1·2·3… (① ② ③ 같은 시트 표기에 대응)
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.judges (
  id uuid primary key default gen_random_uuid(),
  contest_id text not null references public.contests(id) on delete cascade,
  round judging_round not null,
  display_order int not null default 1,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contest_id, round, display_order)
);

create index if not exists idx_judges_lookup on public.judges(contest_id, round, display_order);

drop trigger if exists trg_judges_touch on public.judges;
create trigger trg_judges_touch before update on public.judges
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- judge_votes — 심사위원 한 명이 한 참가자에게 매긴 평가
--   prelim/semi : vote_mark = 'O' | 'X' | null
--   final       : basic/connectivity/musicality 점수
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.judge_votes (
  id uuid primary key default gen_random_uuid(),
  judge_id uuid not null references public.judges(id) on delete cascade,
  participant_num text not null,
  vote_mark text check (vote_mark in ('O','X')),
  basic_score numeric(5,2),
  connectivity_score numeric(5,2),
  musicality_score numeric(5,2),
  updated_at timestamptz not null default now(),
  unique (judge_id, participant_num)
);

create index if not exists idx_judge_votes_judge on public.judge_votes(judge_id);

drop trigger if exists trg_judge_votes_touch on public.judge_votes;
create trigger trg_judge_votes_touch before update on public.judge_votes
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────────
alter table public.judges      enable row level security;
alter table public.judge_votes enable row level security;

drop policy if exists "anon read judges"      on public.judges;
drop policy if exists "anon read judge_votes" on public.judge_votes;

create policy "anon read judges"      on public.judges      for select using (true);
create policy "anon read judge_votes" on public.judge_votes for select using (true);
