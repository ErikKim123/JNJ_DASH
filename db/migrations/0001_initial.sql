-- JNJ Dash DB 초기 스키마
-- 시트 중심 → DB 중심 전환 (2026-05).
-- Supabase Postgres. 적용 방법:
--   1) Supabase Dashboard → SQL Editor → 본 파일 내용 붙여넣기 → Run
--   2) 또는 supabase CLI: supabase db push
-- 모든 테이블은 service_role 만 쓰기. anon 은 표출 화면용 SELECT 만 허용.

-- ─────────────────────────────────────────────────────────────────────────
-- updated_at 자동 갱신 트리거
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ─────────────────────────────────────────────────────────────────────────
-- 1) contests — 대회 마스터
--    id 는 운영팀 사용 표기인 'JNJ-001' 형식의 슬러그 (시트 H열과 동일).
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.contests (
  id text primary key,
  name text not null,
  host_org text default '',
  period_start date,
  period_end date,
  design_template_number int not null default 1,
  festival_header text default '',
  tagline text default '',
  prelim_pass_per_role int not null default 10,
  semi_pass_per_role int not null default 5,
  status text not null default 'ready' check (status in ('ready','live','done','archived')),
  -- 시트 원본을 추적하기 위한 보조 컬럼 (import 출처). 이후 운영은 DB만 사용.
  legacy_spreadsheet_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_contests_touch on public.contests;
create trigger trg_contests_touch before update on public.contests
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- 2) participants — 대회별 참가자 명단 (3.참가자 시트 대체)
--    num: 참가번호 (대회 내 고유, 문자열로 유지 — 운영팀이 '01','A1' 같이 쓸 수 있음)
--    role: leader/follower/helper_leader/helper_follower
-- ─────────────────────────────────────────────────────────────────────────
-- CREATE TYPE 은 IF NOT EXISTS 미지원 → DO 블록으로 재실행 안전하게 래핑.
do $$ begin
  create type participant_role as enum (
    'leader','follower','helper_leader','helper_follower'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  contest_id text not null references public.contests(id) on delete cascade,
  num text not null,
  team_name text not null default '',
  representative text default '',
  role participant_role not null,
  photo_url text default '',
  -- 운영팀이 시트에서 직접 입력하던 보조 컬럼 (장르/부문/연령대/소속 등) 보존용.
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contest_id, num)
);

create index if not exists idx_participants_contest on public.participants(contest_id);
create index if not exists idx_participants_role on public.participants(contest_id, role);

drop trigger if exists trg_participants_touch on public.participants;
create trigger trg_participants_touch before update on public.participants
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- 3) pairings — 예선/본선 페어링 (3-1.예선랜덤 / 4-1.본선랜덤 시트 대체)
--    status:
--      draft     - 셔플은 됐지만 아직 확정 안 됨
--      confirmed - 운영자가 [확정] 클릭 → 표출 화면에서 사용
--    leader_num/follower_num 은 participants.num 의 텍스트 참조.
--    헬퍼는 '—' 같은 sentinel 허용을 위해 FK 강제하지 않음.
-- ─────────────────────────────────────────────────────────────────────────
do $$ begin
  create type pairing_round as enum ('prelim','semi');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type pairing_status as enum ('draft','confirmed');
exception when duplicate_object then null;
end $$;

create table if not exists public.pairings (
  id uuid primary key default gen_random_uuid(),
  contest_id text not null references public.contests(id) on delete cascade,
  round pairing_round not null,
  pair_idx int not null,
  leader_num text not null default '',
  leader_name text not null default '',
  follower_num text not null default '',
  follower_name text not null default '',
  status pairing_status not null default 'draft',
  shuffled_at timestamptz not null default now(),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contest_id, round, pair_idx)
);

create index if not exists idx_pairings_lookup on public.pairings(contest_id, round, status);

drop trigger if exists trg_pairings_touch on public.pairings;
create trigger trg_pairings_touch before update on public.pairings
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- 4) qualifiers — 라운드별 통과자 (4.예선통과 / 5.본선통과 시트 대체)
--    round: prelim → 예선 통과 (본선 진출자) / semi → 본선 통과 (결승 진출자)
--    passed: TRUE 만 표출. votes 는 동점자 검토용.
-- ─────────────────────────────────────────────────────────────────────────
do $$ begin
  create type qualifier_round as enum ('prelim','semi');
exception when duplicate_object then null;
end $$;

create table if not exists public.qualifiers (
  id uuid primary key default gen_random_uuid(),
  contest_id text not null references public.contests(id) on delete cascade,
  round qualifier_round not null,
  participant_num text not null,
  team_name text not null default '',
  representative text default '',
  role participant_role not null,
  photo_url text default '',
  passed boolean not null default false,
  votes int not null default 0,
  -- 운영자가 표출 순서를 수동으로 고치고 싶을 때 사용. 0 이면 votes desc 정렬 폴백.
  display_order int not null default 0,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contest_id, round, participant_num)
);

create index if not exists idx_qualifiers_lookup
  on public.qualifiers(contest_id, round, passed, role);

drop trigger if exists trg_qualifiers_touch on public.qualifiers;
create trigger trg_qualifiers_touch before update on public.qualifiers
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- 5) final_results — 결승 결과 (6.결승 시트 대체)
--    role: leader / follower
--    final_rank: 같은 role 안에서의 최종 순위 (1=1등). 동점자는 같은 rank 허용.
-- ─────────────────────────────────────────────────────────────────────────
do $$ begin
  create type final_role as enum ('leader','follower');
exception when duplicate_object then null;
end $$;

create table if not exists public.final_results (
  id uuid primary key default gen_random_uuid(),
  contest_id text not null references public.contests(id) on delete cascade,
  participant_num text not null,
  team_name text not null default '',
  role final_role not null,
  final_rank int,
  total_score numeric(10,3),
  average numeric(10,3),
  photo_url text default '',
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contest_id, role, participant_num)
);

create index if not exists idx_final_results_lookup
  on public.final_results(contest_id, role, final_rank);

drop trigger if exists trg_final_results_touch on public.final_results;
create trigger trg_final_results_touch before update on public.final_results
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- RLS — 표출 화면(anon)은 읽기만, 운영(service_role)은 풀권한.
--   service_role 은 모든 RLS 를 우회하므로 anon 정책만 정의.
-- ─────────────────────────────────────────────────────────────────────────
alter table public.contests       enable row level security;
alter table public.participants   enable row level security;
alter table public.pairings       enable row level security;
alter table public.qualifiers     enable row level security;
alter table public.final_results  enable row level security;

drop policy if exists "anon read contests"      on public.contests;
drop policy if exists "anon read participants"  on public.participants;
drop policy if exists "anon read pairings"      on public.pairings;
drop policy if exists "anon read qualifiers"    on public.qualifiers;
drop policy if exists "anon read final_results" on public.final_results;

create policy "anon read contests"      on public.contests       for select using (true);
create policy "anon read participants"  on public.participants   for select using (true);
-- 표출은 confirmed 만 노출. draft 페어링은 운영자(service_role)만 조회.
create policy "anon read pairings"      on public.pairings       for select using (status = 'confirmed');
create policy "anon read qualifiers"    on public.qualifiers     for select using (true);
create policy "anon read final_results" on public.final_results  for select using (true);
