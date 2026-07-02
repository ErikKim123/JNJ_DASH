-- 온라인 심사위원(online_judges) — 대회별 셀프 등록 심사위원 명단.
-- 기존 판정단(judges, 라운드별 ~20명)과 완전히 분리된 별도 개념.
--   · 규모가 큼(대회당 최대 ~1000명) → 관리자 목록은 페이지네이션(50/page).
--   · /ojudge/[contestId] 공개 조인앱에서 본인이 직접 등록(참가자 join 과 동일 디자인).
--   · pin: 본인이 등록 시 정하는 4자리 숫자 비밀번호(추후 로그인/채점 접속용).
--   · display_order: 대회 내 등록 순번(1,2,3…). 관리자 목록 정렬 키.
--
-- 개인정보(이메일/연락처/PIN)를 담으므로 anon 읽기 정책을 두지 않는다.
--   등록/조회 모두 service_role(getSupabaseAdmin) 로만 수행 → RLS 우회.

create table if not exists public.online_judges (
  id uuid primary key default gen_random_uuid(),
  contest_id text not null references public.contests(id) on delete cascade,
  display_order int not null default 1,
  -- 이름 — 참가자와 동일하게 first/last 분리. name 은 표시명(last 우선).
  first_name text not null default '',
  last_name text not null default '',
  name text not null default '',
  -- 국가(참가자 representative 와 동일 의미).
  representative text not null default '',
  email text not null default '',
  phone text not null default '',
  photo_url text not null default '',
  -- 4자리 숫자 PIN. 본인이 등록 시 입력.
  pin text not null default '' check (pin = '' or pin ~ '^[0-9]{4}$'),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contest_id, display_order)
);

create index if not exists idx_online_judges_contest
  on public.online_judges(contest_id, display_order);

drop trigger if exists trg_online_judges_touch on public.online_judges;
create trigger trg_online_judges_touch before update on public.online_judges
  for each row execute function public.touch_updated_at();

-- RLS 활성화 — anon 정책 없음(service_role 전용). 표출 화면에서 노출되지 않는 데이터.
alter table public.online_judges enable row level security;
