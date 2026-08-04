-- AI Judge — 참가자용 영상 분석 서브 프로덕트 (JNJ_Dash 서브 프로덕트).
--
-- 기존 대회 운영 테이블(public 스키마)과 완전히 분리하기 위해 별도 스키마를 사용한다.
-- Supabase 프로젝트/Auth 는 공유하고, 데이터만 격리한다.
--
-- ⚠️ 적용 후 수동 1회 작업:
--    Supabase Dashboard → Settings → API → "Exposed schemas" 에 'ai_judge' 추가.
--    (PostgREST 가 노출하지 않으면 supabase-js 에서 ai_judge 테이블을 읽을 수 없다)
--
-- 설계: docs/02-design/features/ai-judge.design.md §3
-- 기준: docs/rubric.md v1.0
--
-- 절대 원칙 (docs/rubric.md §1.2) 의 스키마 레벨 반영:
--   P1. 점수형 컬럼은 reports.onbeat_ratio 단 하나. Timing 외 축은 코멘트(텍스트)만.
--   P2. reports.confidence 는 NOT NULL + CHECK. 워커의 compute_confidence() 가 유일 산출처.
--   P3. rank / pass / total_score / winner 등 순위·합불 컬럼은 의도적으로 존재하지 않는다.

create schema if not exists ai_judge;
grant usage on schema ai_judge to anon, authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────
-- 0) ENUM — 재실행 안전을 위해 DO 블록으로 감싼다 (create type 은 IF NOT EXISTS 미지원)
-- ─────────────────────────────────────────────────────────────────────────
do $$ begin
  create type ai_judge.job_role as enum ('leader','follower','couple');
exception when duplicate_object then null;
end $$;

do $$ begin
  -- 스펙 4.2 분석 대기 화면의 5단계와 1:1 대응 (queued→pose→beat→comment→done)
  create type ai_judge.job_status as enum ('queued','pose','beat','comment','done','failed');
exception when duplicate_object then null;
end $$;

-- ─────────────────────────────────────────────────────────────────────────
-- 1) profiles — auth.users 1:1 확장
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists ai_judge.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  email        text not null default '',
  -- 결제는 이번 범위 밖. 스키마만 예약한다(순수 플래그, 판정과 무관).
  paid         boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────
-- 2) jobs — 분석 작업 큐
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists ai_judge.jobs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,

  -- Storage 경로. bucket 'ai-judge-media' 기준 상대 경로: {user_id}/{job_id}/video.mp4
  video_path    text not null,
  -- 곡 자동 추출 실패 시 사용자가 올린 원곡 파일 경로 (docs/rubric.md 기준: 영상 오디오 트랙이 기본)
  audio_path    text not null default '',

  role          ai_judge.job_role   not null,
  status        ai_judge.job_status not null default 'queued',

  -- 커플 모드에서 리더가 화면 기준 어느 쪽인지.
  -- 싱크로 시차(sync_lag_ms)의 부호 해석에 필요하며 영상만으로는 판정 불가하므로 사용자 입력을 받는다.
  leader_side   text not null default '' check (leader_side in ('','left','right')),
  -- role='couple' 이면 leader_side 필수
  constraint jobs_couple_needs_leader_side
    check (role <> 'couple' or leader_side <> ''),

  song_title    text not null default '',
  contest_id    text references public.contests(id) on delete set null,

  -- 워커 claim / 재시도 (queue.py)
  claimed_by    text not null default '',
  claimed_at    timestamptz,
  attempts      int  not null default 0,

  -- 실패 코드 — design §6.1
  error_code    text not null default '',
  error_message text not null default '',

  started_at    timestamptz,
  finished_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- 큐 폴링용. status='queued' 를 created_at 순으로 스캔한다.
create index if not exists idx_ajudge_jobs_queue on ai_judge.jobs(status, created_at);
create index if not exists idx_ajudge_jobs_user  on ai_judge.jobs(user_id, created_at desc);
-- stale claim 회수용
create index if not exists idx_ajudge_jobs_claimed on ai_judge.jobs(claimed_at)
  where status in ('pose','beat','comment');

-- ─────────────────────────────────────────────────────────────────────────
-- 3) reports — 분석 결과 (job 1:1)
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists ai_judge.reports (
  id             uuid primary key default gen_random_uuid(),
  job_id         uuid not null unique references ai_judge.jobs(id)  on delete cascade,
  -- RLS 를 jobs 조인 없이 걸기 위한 비정규화 컬럼
  user_id        uuid not null references auth.users(id) on delete cascade,

  -- [점수] Timing 축. rubric §2.3. 이 제품의 유일한 점수다.
  onbeat_ratio   numeric(5,2) not null check (onbeat_ratio between 0 and 100),

  -- [참고 지표] 점수 아님. 커플 모드에서만 산출되므로 NULL 허용.
  sync_index     numeric(5,2) check (sync_index     between 0 and 100),
  -- [참고 지표] 음악 반응도. 점수 아님.
  activity_index numeric(5,2) check (activity_index between 0 and 100),

  -- 절대 원칙 2 (rubric §6). 워커의 compute_confidence() 만이 이 값을 만든다.
  confidence     text not null check (confidence in ('high','medium','low')),
  -- confidence='low' 사유 코드 배열: pose_success_low | id_switch_detected | out_of_frame_high
  low_reasons    text[] not null default '{}',

  metrics_json   jsonb not null default '{}'::jsonb,   -- design §3.4
  comments_json  jsonb not null default '{}'::jsonb,   -- design §3.5

  model          text  not null default '',
  usage_json     jsonb not null default '{}'::jsonb,   -- 토큰/비용 추적
  rubric_version text  not null default '',            -- 판정 재현용

  created_at     timestamptz not null default now()
);

create index if not exists idx_ajudge_reports_user on ai_judge.reports(user_id, created_at desc);

comment on column ai_judge.reports.onbeat_ratio   is '[SCORE] Timing 축 유일 점수(%) — rubric §2.3';
comment on column ai_judge.reports.sync_index     is '[REFERENCE] 파트너 싱크로 참고 지표. 점수가 아니며 순위·합불에 사용 금지';
comment on column ai_judge.reports.activity_index is '[REFERENCE] 음악 반응도 참고 지표. 점수가 아니며 순위·합불에 사용 금지';
comment on column ai_judge.reports.confidence     is '절대 원칙 2. low 면 UI/API 가 지표를 노출하지 않는다';

-- ─────────────────────────────────────────────────────────────────────────
-- 4) judge_scores — 사람 심사 라벨 축적 (Phase 3 학습 데이터 자산)
--    payload 는 rubric.md §5 JSON 스키마를 그대로 담는다.
--    rubric 버전에 따라 필드가 변하므로 jsonb 로 유지한다.
--    total/rank/pass 필드는 rubric §5.2 에 따라 존재하지 않는다.
--    지금은 비어 있어도 스키마를 먼저 만들어 둔다.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists ai_judge.judge_scores (
  id             uuid primary key default gen_random_uuid(),
  job_id         uuid references ai_judge.jobs(id)    on delete cascade,
  report_id      uuid references ai_judge.reports(id) on delete set null,
  -- 라벨 출처. ai_reference 는 참고용이며 axes[].score 를 채우지 않는다(rubric §5.1).
  source         text not null check (source in ('human_judge','self','ai_reference')),
  judge_ref      text not null default '',
  rubric_version text not null default '',
  payload        jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);

create index if not exists idx_ajudge_judge_scores_job on ai_judge.judge_scores(job_id);

-- ─────────────────────────────────────────────────────────────────────────
-- 5) updated_at 트리거 (public.touch_updated_at 재사용 — 0001_initial.sql)
-- ─────────────────────────────────────────────────────────────────────────
drop trigger if exists trg_ajudge_profiles_touch on ai_judge.profiles;
create trigger trg_ajudge_profiles_touch before update on ai_judge.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_ajudge_jobs_touch on ai_judge.jobs;
create trigger trg_ajudge_jobs_touch before update on ai_judge.jobs
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- 6) 권한 + RLS
--    authenticated 는 본인 행만. 워커는 service_role 로 RLS 를 우회한다.
-- ─────────────────────────────────────────────────────────────────────────
grant select, insert, update, delete on ai_judge.profiles to authenticated;
grant select, insert, update         on ai_judge.jobs     to authenticated;
grant select                         on ai_judge.reports  to authenticated;
grant all on all tables    in schema ai_judge to service_role;
grant all on all sequences in schema ai_judge to service_role;

alter table ai_judge.profiles     enable row level security;
alter table ai_judge.jobs         enable row level security;
alter table ai_judge.reports      enable row level security;
-- judge_scores 는 정책을 두지 않는다 = service_role 전용 (개인정보/심사 라벨)
alter table ai_judge.judge_scores enable row level security;

drop policy if exists p_ajudge_profiles_self on ai_judge.profiles;
create policy p_ajudge_profiles_self on ai_judge.profiles
  for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists p_ajudge_jobs_self on ai_judge.jobs;
create policy p_ajudge_jobs_self on ai_judge.jobs
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 리포트는 읽기 전용. 생성/수정은 워커(service_role)만 한다.
drop policy if exists p_ajudge_reports_read_self on ai_judge.reports;
create policy p_ajudge_reports_read_self on ai_judge.reports
  for select to authenticated
  using (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────
-- 7) 큐 함수
-- ─────────────────────────────────────────────────────────────────────────

-- 대기 잡 1건을 원자적으로 claim 한다.
-- FOR UPDATE SKIP LOCKED 로 워커를 여러 대 띄워도 중복 처리되지 않는다.
create or replace function ai_judge.claim_job(p_worker text)
returns setof ai_judge.jobs
language plpgsql
security definer
set search_path = ai_judge, public
as $$
begin
  return query
  update ai_judge.jobs j
     set status     = 'pose',
         claimed_by = p_worker,
         claimed_at = now(),
         started_at = coalesce(j.started_at, now()),
         attempts   = j.attempts + 1,
         updated_at = now()
   where j.id = (
     select id
       from ai_judge.jobs
      where status = 'queued'
      order by created_at
      for update skip locked
      limit 1
   )
  returning j.*;
end;
$$;

-- 워커가 죽어 중간 상태로 남은 잡을 큐로 되돌린다. 워커 기동 시 1회 호출.
-- attempts >= 3 인 잡은 되돌리지 않는다(무한 재시도 방지 — 별도 수동 확인 대상).
create or replace function ai_judge.requeue_stale_jobs(p_older interval default '30 minutes')
returns int
language sql
security definer
set search_path = ai_judge, public
as $$
  with r as (
    update ai_judge.jobs
       set status     = 'queued',
           claimed_by = '',
           claimed_at = null,
           updated_at = now()
     where status in ('pose','beat','comment')
       and claimed_at < now() - p_older
       and attempts < 3
    returning 1
  )
  select coalesce(count(*), 0)::int from r;
$$;

-- security definer 함수는 기본적으로 PUBLIC 실행 가능하다.
-- 이 두 함수는 남의 잡을 가로챌 수 있으므로 워커(service_role) 에게만 허용한다.
revoke all on function ai_judge.claim_job(text)             from public, anon, authenticated;
revoke all on function ai_judge.requeue_stale_jobs(interval) from public, anon, authenticated;
grant execute on function ai_judge.claim_job(text)             to service_role;
grant execute on function ai_judge.requeue_stale_jobs(interval) to service_role;

-- ─────────────────────────────────────────────────────────────────────────
-- 8) Storage — private 버킷
--    경로 규약: {user_id}/{job_id}/video.mp4 | song.mp3 | frames/{nn}.jpg
--    참가자 영상은 개인 데이터이므로 public=false + signed URL 로만 접근한다.
-- ─────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ai-judge-media',
  'ai-judge-media',
  false,
  524288000, -- 500MB (스펙 4.1)
  array[
    'video/mp4','video/quicktime',                     -- 업로드 영상 (mp4/mov)
    'audio/mpeg','audio/wav','audio/x-wav','audio/mp4','audio/aac', -- 원곡 폴백
    'image/jpeg'                                       -- 워커가 쓰는 키프레임
  ]
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 본인 소유 prefix({user_id}/...) 만 접근 가능.
do $$ begin
  drop policy if exists "ai-judge-media owner access" on storage.objects;
exception when undefined_object then null;
end $$;

create policy "ai-judge-media owner access"
  on storage.objects
  for all
  to authenticated
  using      (bucket_id = 'ai-judge-media' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'ai-judge-media' and (storage.foldername(name))[1] = auth.uid()::text);
