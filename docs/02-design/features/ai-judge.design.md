---
feature: ai-judge
phase: design
created: 2026-07-28
level: Dynamic
plan: docs/01-plan/features/ai-judge.plan.md
status: Draft — 승인 대기
---

# 🏗️ Design: AI Judge

## Context Anchor

| Anchor | Value |
|--------|-------|
| **WHY** | 참가자가 점수의 근거와 개선점을 알 수 없다 |
| **WHO** | 대회 참가자(리더/팔로워/커플) |
| **RISK** | rubric.md 부재 / 포즈 추출 품질 / 워커 배포처 미정 |
| **SUCCESS** | 사이클1 CLI E2E → 사이클2 업로드~리포트 무인 통과 |
| **SCOPE** | IN: 파이프라인·웹앱·히스토리 / OUT: 결제·순위판정·알림톡 |

> **기준 문서**: [docs/rubric.md](../../rubric.md) v0.1-draft (2026-07-28 작성, **승인 대기**).
> 임계값·감점 코드·confidence 조건은 전부 rubric 에서 온다. 코드 측 소유자는 `worker/thresholds.py` 단 하나이며, 다른 어떤 파일에도 하드코딩하지 않는다(`lib/ai-judge/thresholds.ts` 는 화면 표시용 라벨만 보유).
>
> **확정 사항 반영**: Q1(rubric 초안 작성) · Q3(영상 오디오 트랙 사용) · Q5(리더 위치 입력 추가) · Q7(버튼은 사이클 2) — Plan §10 참조.

---

## 1. Overview

### 1.1 설계 목표

1. **원칙을 구조로 강제한다** — 점수 컬럼 1개, Claude 출력 스키마에 숫자 필드 부재, confidence 게이트 단일 래퍼, 금칙어 감사 스크립트.
2. **기존 앱을 건드리지 않는다** — 새 스키마 / 새 라우트 세그먼트 / middleware 경로 분기. `public` 스키마와 기존 화면은 무변경.
3. **사이클 1이 UI 없이 완결된다** — 워커는 Next.js를 전혀 모른다. Supabase 테이블·Storage 만이 계약면.

### 1.2 설계 원칙

| # | 원칙 |
|---|------|
| D1 | 판정 로직(임계값·게이트·태깅)은 **워커 단독** 소유. UI는 저장된 값을 렌더만 한다. |
| D2 | 워커 ↔ 앱은 **DB 테이블과 Storage 경로**로만 통신한다. HTTP 호출 없음. |
| D3 | 지표는 `metrics_json` 하나에 담고, 자주 조회하는 3개만 컬럼으로 승격한다. |
| D4 | 모바일 우선. 리포트 화면은 세로 스크롤 단일 컬럼. |
| D5 | 실패는 조용히 넘어가지 않는다. 모든 실패는 `jobs.error_code` 로 코드화된다. |

---

## 2. Architecture

### 2.1 전체 구성도

```
┌─────────────────────────────────────────────────────────────────────┐
│  Browser (모바일 우선)                                                │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ /                     HOME — 헤더에 [AI JUDGE ↗] 추가            │  │
│  │ /ajudge/auth/enter    세션 자동 발급 (로그인 화면 없음)            │  │
│  │ /ajudge               영상 입력 (업로드 | 직접촬영) + 메타 입력    │  │
│  │   └ MediaPipe Tasks (WASM) — 전신 가이드 박스 실시간 판정         │  │
│  │ /ajudge/jobs/[id]     분석 대기 — 5초 폴링                       │  │
│  │ /ajudge/report/[id]   리포트 — <canvas> 스켈레톤·비트 오버레이     │  │
│  │ /ajudge/report/[id]/segments   구간 상세                        │  │
│  │ /ajudge/history       히스토리 + 시계열                          │  │
│  └───────────────────────────────────────────────────────────────┘  │
│        │ signed upload URL (직접 업로드)      │ fetch /api/ajudge/*  │
└────────┼──────────────────────────────────────┼─────────────────────┘
         │                                      ▼
         │                        ┌─────────────────────────────┐
         │                        │ Next.js Route Handlers      │
         │                        │  (Vercel) — anon key + RLS  │
         │                        └──────────────┬──────────────┘
         ▼                                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Supabase (JNJ_Dash 와 동일 프로젝트)                                 │
│   auth.users                                                        │
│   schema public   ← 기존 대회 운영 (무변경)                            │
│   schema ai_judge ← profiles / jobs / reports / judge_scores         │
│   Storage  bucket: ai-judge-media (private)                          │
│     {user_id}/{job_id}/video.mp4                                     │
│     {user_id}/{job_id}/song.mp3            (폴백 업로드 시)            │
│     {user_id}/{job_id}/frames/{nn}.jpg     (워커 산출 키프레임)         │
└──────────────────────────▲──────────────────────────────────────────┘
                           │ service_role — claim_job() 폴링 10초
┌──────────────────────────┴──────────────────────────────────────────┐
│  Python Worker (별도 프로세스 — 사이클1: 로컬 CLI)                     │
│   ① claim  → ② pose(MediaPipe)  → ③ beat(librosa/ffmpeg)            │
│   → ④ metrics → ⑤ segment tagging → ⑥ Claude vision comments        │
│   → ⑦ reports INSERT → ⑧ Resend 이메일                               │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 데이터 흐름 (정상 경로)

```
1. 클라이언트  POST /api/ajudge/uploads         → { path, token }
2. 클라이언트  PUT  <signed url>  (영상 직접 업로드, 서버 미경유)
3. 클라이언트  POST /api/ajudge/jobs            → jobs INSERT status=queued
4. 워커        SELECT ai_judge.claim_job(worker) → status=pose, claimed
5. 워커        ffmpeg → wav / MediaPipe → landmarks.npz
6. 워커        status=beat  → librosa beat_track + onset + rms
7. 워커        지표 산출 + 구간 태깅 + confidence
8. 워커        status=comment → 키프레임 6~10장 업로드 → Claude vision
9. 워커        reports INSERT → jobs status=done, finished_at
10. 워커       Resend 이메일 발송
11. 클라이언트 GET /api/ajudge/jobs/[id] 폴링 → done + reportId → 리다이렉트
```

### 2.3 의존성

| 계층 | 추가 의존성 | 비고 |
|------|-------------|------|
| Next.js | `@supabase/ssr` | 쿠키 기반 Auth 세션 (App Router) |
| Next.js | `@mediapipe/tasks-vision` | 촬영 가이드 박스 판정 (클라이언트, WASM) |
| Worker | `psycopg[binary]`, `supabase`, `anthropic`, `mediapipe`, `librosa`, `opencv-python`, `numpy`, `soundfile`, `httpx`, `jsonschema`, `pytest` | `worker/requirements.txt` |
| Worker | `ffmpeg` (시스템 바이너리) | 오디오 트랙 추출 |
| 기존 재사용 | Tailwind 테마, `lib/db/client.ts` 패턴, `db/migrations` 러너, Resend | — |

### 2.4 데비에이션 기록

| ID | 결정 | 근거 | 반영 |
|----|------|------|------|
| **D-1** | 워커의 **큐·리포트 접근을 supabase-py 대신 psycopg 직접 접속**으로 한다. Storage 만 Supabase SDK 사용 | ① PostgREST "Exposed schemas" 는 대시보드 수동 설정이라 워커가 이에 의존하면 배포가 취약해진다 ② `FOR UPDATE SKIP LOCKED` claim 을 그대로 쓸 수 있다 ③ 마이그레이션 러너(`scripts/apply-migrations.mjs`)와 동일한 접속 경로라 자격증명이 이미 있다 | `worker/queue.py`, `worker/config.py`. **웹앱(Next.js)은 설계대로 supabase-js + PostgREST 를 쓰므로 Exposed schemas 설정은 사이클 2에 여전히 필요하다** |

---

## 3. Data Model

### 3.1 엔티티

| 엔티티 | 설명 | 소유 |
|--------|------|------|
| `ai_judge.profiles` | `auth.users` 1:1 확장. 표시명·이메일·`paid` 예약 플래그 | 앱 |
| `ai_judge.jobs` | 분석 작업 큐. 상태 머신 + 워커 claim 필드 | 앱 생성 / 워커 갱신 |
| `ai_judge.reports` | 분석 결과 1건 (job 1:1) | 워커 |
| `ai_judge.judge_scores` | 사람 심사 라벨 축적 (Phase 3 학습 데이터). 지금은 빈 테이블 | 향후 |

### 3.2 관계

```
auth.users 1─1 ai_judge.profiles
auth.users 1─N ai_judge.jobs 1─1 ai_judge.reports
                    │                  │
                    └──────N───────────┴─ ai_judge.judge_scores
public.contests 0─N ai_judge.jobs   (nullable, on delete set null)
```

### 3.3 스키마 — `db/migrations/0032_ai_judge.sql`

```sql
-- AI Judge — 참가자용 영상 분석 서브 프로덕트.
-- 기존 운영 테이블(public)과 완전 분리하기 위해 별도 스키마를 사용한다.
-- ※ Supabase Dashboard → Settings → API → Exposed schemas 에 'ai_judge' 추가 필요(수동 1회).
create schema if not exists ai_judge;
grant usage on schema ai_judge to anon, authenticated, service_role;

create type ai_judge.job_role   as enum ('leader','follower','couple');
create type ai_judge.job_status as enum ('queued','pose','beat','comment','done','failed');

-- ── profiles ──────────────────────────────────────────────────────
create table if not exists ai_judge.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  email        text not null default '',
  -- 결제는 이번 범위 밖. 스키마만 예약한다(절대 원칙과 무관한 순수 플래그).
  paid         boolean not null default false,
  created_at   timestamptz not null default now()
);

-- ── jobs ──────────────────────────────────────────────────────────
create table if not exists ai_judge.jobs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  video_path   text not null,
  audio_path   text not null default '',           -- 원곡 폴백 업로드 시 채워짐
  role         ai_judge.job_role   not null,
  status       ai_judge.job_status not null default 'queued',
  -- 커플 모드에서 리더가 화면 기준 어느 쪽인지. 싱크로 시차의 부호를 결정한다.
  leader_side  text not null default '' check (leader_side in ('','left','right')),
  song_title   text not null default '',
  contest_id   text references public.contests(id) on delete set null,
  -- 워커 claim / 재시도
  claimed_by   text not null default '',
  claimed_at   timestamptz,
  attempts     int  not null default 0,
  error_code   text not null default '',
  error_message text not null default '',
  started_at   timestamptz,
  finished_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_ajudge_jobs_queue on ai_judge.jobs(status, created_at);
create index if not exists idx_ajudge_jobs_user  on ai_judge.jobs(user_id, created_at desc);

-- ── reports ───────────────────────────────────────────────────────
-- 절대 원칙 1: 점수형 컬럼은 onbeat_ratio 단 하나다.
--   sync_index / activity_index 는 '참고 지표'이며 순위·합불에 사용하지 않는다.
--   (컬럼명에 _score 를 쓰지 않는 것도 같은 이유 — Plan Q6 참조)
create table if not exists ai_judge.reports (
  id             uuid primary key default gen_random_uuid(),
  job_id         uuid not null unique references ai_judge.jobs(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  -- [점수] Timing 축. 0~100 (%)
  onbeat_ratio   numeric(5,2) not null check (onbeat_ratio between 0 and 100),
  -- [참고 지표] 커플 모드에서만 산출. 그 외 NULL
  sync_index     numeric(5,2) check (sync_index     between 0 and 100),
  -- [참고 지표] 음악 반응도
  activity_index numeric(5,2) check (activity_index between 0 and 100),
  -- 절대 원칙 2: NOT NULL. 워커의 compute_confidence() 만이 이 값을 만든다.
  confidence     text not null check (confidence in ('high','medium','low')),
  metrics_json   jsonb not null default '{}'::jsonb,
  comments_json  jsonb not null default '{}'::jsonb,
  model          text  not null default '',
  usage_json     jsonb not null default '{}'::jsonb,   -- 토큰/비용 추적
  rubric_version text  not null default '',
  created_at     timestamptz not null default now()
);
create index if not exists idx_ajudge_reports_user on ai_judge.reports(user_id, created_at desc);

comment on column ai_judge.reports.onbeat_ratio   is '[SCORE] Timing 축 유일 점수(%)';
comment on column ai_judge.reports.sync_index     is '[REFERENCE] 파트너 싱크로 참고 지표. 점수 아님';
comment on column ai_judge.reports.activity_index is '[REFERENCE] 음악 반응도 참고 지표. 점수 아님';

-- ── judge_scores (Phase 3 학습 데이터 자산) ────────────────────────
-- payload 는 rubric.md §5 스키마를 그대로 담는다(axes/penalties/overall_note).
--   rubric 버전이 오르며 필드가 변하므로 jsonb 로 유지하고, 조회가 잦아지면
--   generated column 으로 승격한다. total/rank/pass 필드는 rubric §5.2 에 따라 존재하지 않는다.
create table if not exists ai_judge.judge_scores (
  id             uuid primary key default gen_random_uuid(),
  job_id         uuid references ai_judge.jobs(id)    on delete cascade,
  report_id      uuid references ai_judge.reports(id) on delete set null,
  source         text not null check (source in ('human_judge','self','ai_reference')),
  judge_ref      text not null default '',
  rubric_version text not null default '',
  payload        jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);

-- ── RLS ───────────────────────────────────────────────────────────
alter table ai_judge.profiles     enable row level security;
alter table ai_judge.jobs         enable row level security;
alter table ai_judge.reports      enable row level security;
alter table ai_judge.judge_scores enable row level security;   -- 정책 없음 = service_role 전용

create policy p_profiles_self on ai_judge.profiles
  for all to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy p_jobs_self on ai_judge.jobs
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
-- 리포트는 읽기 전용. 생성/수정은 워커(service_role)만.
create policy p_reports_read_self on ai_judge.reports
  for select to authenticated using (user_id = auth.uid());

-- ── 큐 claim (원자적) ──────────────────────────────────────────────
create or replace function ai_judge.claim_job(p_worker text)
returns setof ai_judge.jobs
language plpgsql security definer set search_path = ai_judge, public as $$
begin
  return query
  update ai_judge.jobs j
     set status = 'pose', claimed_by = p_worker, claimed_at = now(),
         started_at = coalesce(j.started_at, now()),
         attempts = j.attempts + 1, updated_at = now()
   where j.id = (
     select id from ai_judge.jobs
      where status = 'queued'
      order by created_at
      for update skip locked
      limit 1
   )
  returning j.*;
end $$;

-- 워커가 죽어 stuck 된 잡을 되돌린다. 워커 기동 시 1회 호출.
create or replace function ai_judge.requeue_stale_jobs(p_older interval default '30 minutes')
returns int language sql security definer set search_path = ai_judge as $$
  with r as (
    update ai_judge.jobs
       set status='queued', claimed_by='', claimed_at=null, updated_at=now()
     where status in ('pose','beat','comment')
       and claimed_at < now() - p_older
       and attempts < 3
    returning 1)
  select count(*)::int from r;
$$;

-- ── Storage ───────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('ai-judge-media','ai-judge-media', false)
on conflict (id) do nothing;

-- 본인 소유 prefix({user_id}/...) 만 접근
create policy p_ajudge_media_self on storage.objects
  for all to authenticated
  using      (bucket_id = 'ai-judge-media' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'ai-judge-media' and (storage.foldername(name))[1] = auth.uid()::text);
```

### 3.4 `metrics_json` 구조

```jsonc
{
  "schema_version": 1,
  "video": { "duration_sec": 92.4, "fps": 30, "width": 1080, "height": 1920 },
  "audio": { "source": "video_track", "bpm": 96.3, "beat_count": 148 },
  "pose": {
    "success_ratio": 0.94,        // 랜드마크 추출 성공 프레임 비율
    "out_of_frame_ratio": 0.03,   // 전신 이탈 구간 비율
    "id_switch_detected": false,  // 커플 모드 인물 ID 스위칭
    "persons": 1
  },
  "timing": {
    "onbeat_ratio": 78.4,               // ← reports.onbeat_ratio 로 승격
    "offset_ms": { "mean": 42.1, "median": 38.0, "p90": 118.0, "std": 55.3 },
    "beat_offsets_ms": [12, -8, 45, ...]  // 비트별 오프셋 (길이 = beat_count)
  },
  "reference": {                         // ← 점수 아님. 참고 지표
    "sync_index": 71.2,                  // couple 전용, 그 외 null
    "sync_lag_ms": 85,
    "activity_index": 64.8
  },
  "offbeat_segments": [
    {
      "start_tc": "00:00:21.400",
      "end_tc":   "00:00:24.100",
      "type": "lag",                     // lag | rush | break_ignored
      "avg_offset_ms": 137,
      "beat_offsets_ms": [120, 145, 132, 151],
      "context": "post_turn",            // post_turn | music_break | chorus_entry | general
      "penalty_trigger": true,           // rubric §4
      "penalty_codes": ["P-1"]           // P-1 | P-2 | P-3 | P-4 (rubric §4)
    }
  ],
  "keyframes": [
    { "t_sec": 21.9, "path": "uuid/uuid/frames/03.jpg", "reason": "offbeat_segment_0" }
  ],
  // rubric §2.2 — 템포 상대 기준. 리포트마다 실제 적용값을 기록해 재현 가능하게 한다.
  "thresholds": { "onbeat_ms": 63, "minor_ms": 125, "rubric_version": "0.1-draft" }
}
```

### 3.5 `comments_json` 구조 (= Claude structured output 스키마)

> **절대 원칙 1의 구조적 강제**: 이 스키마에는 **숫자 필드가 하나도 없다.** 모델이 Technique/Teamwork/Musicality 에 점수를 부여할 방법 자체가 존재하지 않는다.

```jsonc
{
  "timing":     { "comment": "..." },
  "musicality": { "comment": "..." },
  "technique":  { "comment": "...", "reference_only": true },
  "teamwork":   { "comment": "...", "reference_only": true },
  "offbeat_pattern_summary": "...",
  "segment_coaching": [ { "segment_index": 0, "coaching": "..." } ]
}
```

JSON Schema (구조화 출력용, `additionalProperties:false` 필수):

```python
COMMENTS_SCHEMA = {
  "type": "object", "additionalProperties": False,
  "required": ["timing","musicality","technique","teamwork",
               "offbeat_pattern_summary","segment_coaching"],
  "properties": {
    "timing":     {"type":"object","additionalProperties":False,
                   "required":["comment"],"properties":{"comment":{"type":"string"}}},
    "musicality": {"type":"object","additionalProperties":False,
                   "required":["comment"],"properties":{"comment":{"type":"string"}}},
    "technique":  {"type":"object","additionalProperties":False,
                   "required":["comment","reference_only"],
                   "properties":{"comment":{"type":"string"},
                                 "reference_only":{"type":"boolean","const":True}}},
    "teamwork":   {"type":"object","additionalProperties":False,
                   "required":["comment","reference_only"],
                   "properties":{"comment":{"type":"string"},
                                 "reference_only":{"type":"boolean","const":True}}},
    "offbeat_pattern_summary": {"type":"string"},
    "segment_coaching": {"type":"array","items":{
        "type":"object","additionalProperties":False,
        "required":["segment_index","coaching"],
        "properties":{"segment_index":{"type":"integer"},"coaching":{"type":"string"}}}}
  }
}
```

---

## 4. API Specification

인증: 모든 엔드포인트는 Supabase Auth 세션 쿠키를 요구한다(`@supabase/ssr`). 핸들러는 **anon key + 사용자 JWT** 로 동작하며 RLS가 소유권을 강제한다. `service_role` 키는 Route Handler 에 **사용하지 않는다**(워커 전용).

### 4.1 엔드포인트 목록

| Method | Path | 설명 | 인증 |
|--------|------|------|:----:|
| POST | `/api/ajudge/uploads` | Storage signed upload URL 발급 | ✅ |
| POST | `/api/ajudge/jobs` | 잡 생성 (업로드 완료 후) | ✅ |
| GET | `/api/ajudge/jobs/[jobId]` | 상태 폴링 | ✅ |
| POST | `/api/ajudge/jobs/[jobId]/song` | 원곡 폴백 업로드 완료 통보 → 재큐 | ✅ |
| GET | `/api/ajudge/reports/[reportId]` | 리포트 조회 (+ 영상 signed URL) | ✅ |
| GET | `/api/ajudge/history` | 리포트 목록 + 온비트율 시계열 | ✅ |

> 페이지(RSC)에서의 단순 조회는 Route Handler 를 거치지 않고 서버 컴포넌트에서 Supabase 클라이언트로 직접 읽는다(RLS 적용). 위 GET 엔드포인트는 **클라이언트 폴링·차트 갱신용**이다.

### 4.2 상세 명세

#### POST `/api/ajudge/uploads`

```jsonc
// Request
{ "kind": "video" | "song", "filename": "clip.mp4",
  "contentType": "video/mp4", "sizeBytes": 41231234, "jobId": "uuid?" }

// 200
{ "path": "u-uuid/j-uuid/video.mp4", "token": "<signed upload token>", "jobId": "j-uuid" }

// 400 VALIDATION_FAILED — 확장자/용량 위반
// 401 UNAUTHORIZED
```
- 허용 확장자: `.mp4`, `.mov` (video) / `.mp3`, `.wav`, `.m4a` (song)
- 용량 상한: `NEXT_PUBLIC_AI_JUDGE_MAX_MB`(기본 500)
- `jobId`는 서버가 UUID를 미리 발급해 경로를 결정한다(잡 행은 아직 만들지 않음).

#### POST `/api/ajudge/jobs`

```jsonc
// Request
{ "jobId":"j-uuid", "videoPath":"u/j/video.mp4", "role":"couple",
  "leaderSide":"left", "songTitle":"Bailando", "contestId":"JNJ-004" }

// 201
{ "jobId": "j-uuid", "status": "queued" }

// 400 VALIDATION_FAILED   — role/leaderSide 조합 위반(couple 인데 leaderSide 없음 등)
// 404 UPLOAD_NOT_FOUND    — videoPath 객체 미존재
// 409 JOB_ALREADY_EXISTS
```

#### GET `/api/ajudge/jobs/[jobId]`

```jsonc
// 200
{ "jobId":"j-uuid", "status":"comment", "stageIndex":3, "stageCount":5,
  "errorCode":"", "reportId": null }
// status=done 이면 reportId 채워짐
// status=failed 이면 errorCode 채워짐 (§6.1)
```
클라이언트 폴링 주기 5초, 최대 20분 후 중단하고 재시도 안내.

#### POST `/api/ajudge/jobs/[jobId]/song`

```jsonc
// Request  { "audioPath": "u/j/song.mp3" }
// 200      { "status": "queued" }
// 409 INVALID_STATE — status 가 failed/AUDIO_EXTRACT_FAILED 가 아님
```

#### GET `/api/ajudge/reports/[reportId]`

```jsonc
// 200
{ "report": { "id":"...", "confidence":"high", "onbeatRatio":78.4,
              "syncIndex":71.2, "activityIndex":64.8,
              "metrics": { /* §3.4 */ }, "comments": { /* §3.5 */ },
              "createdAt":"..." },
  "job": { "role":"couple","songTitle":"...","contestId":"JNJ-004" },
  "media": { "videoUrl":"<signed 1h>", "frameUrls": ["<signed>", ...] } }

// 200 (confidence=low)  ← 지표를 아예 내려보내지 않는다. 서버에서 게이트.
{ "report": { "id":"...", "confidence":"low", "unavailableReasons":["pose_success_low"] },
  "job": {...}, "media": { "videoUrl": null, "frameUrls": [] } }
```

> **게이트를 서버에서도 적용**한다. UI 실수로 low 지표가 노출되는 경로를 원천 차단한다.

#### GET `/api/ajudge/history`

```jsonc
// 200
{ "items": [ { "reportId":"...","createdAt":"...","role":"leader",
               "songTitle":"...","confidence":"high","onbeatRatio":78.4 } ],
  "series": [ { "t":"2026-07-01","onbeatRatio":72.1 } ] }
// confidence=low 항목은 series 에서 제외하고 items 에는 '분석 불가' 상태로 포함
```

---

## 5. UI/UX Design

### 5.1 홈 진입 버튼 (첨부 이미지 노란 사각)

[app/page.tsx](../../../app/page.tsx) 헤더의 `DASHBOARD` 텍스트와 `Vote App ↗` 사이에 삽입:

```tsx
<Link
  href="/ajudge"
  target="_blank"
  rel="noopener"
  className="text-xs font-mono tracking-widest uppercase px-3 py-1.5 rounded
             border border-accent bg-accent/10 text-accent hover:bg-accent/20 transition"
>
  AI Judge ↗
</Link>
```

버튼이 5개가 되므로 헤더 우측 그룹에 `flex-wrap gap-y-2` 를 적용해 좁은 폭에서 줄바꿈되도록 한다.

### 5.2 화면 컴포넌트 트리

```
app/ajudge/layout.tsx ─ <AJudgeShell>            모바일 컨테이너 + 세션 가드 + 하단 탭
│
├─ /ajudge/auth/enter/route.ts                   기기 계정 자동 발급(화면 없음)
│
├─ /ajudge/page.tsx                              [4.1 영상 입력]
│   └─ <InputTabs>
│       ├─ <UploadPanel>
│       │   ├─ <FilePicker>                      accept=video/mp4,video/quicktime
│       │   └─ <PreflightCheck>                  첫 프레임 캡처 → MediaPipe 1회 추론
│       │        └─ <FramingWarning>             화각 불량 시 경고 (차단은 아님)
│       ├─ <RecordPanel>
│       │   ├─ <CameraView>                      getUserMedia
│       │   ├─ <FullBodyGuideBox>                전신 가이드 오버레이
│       │   ├─ <LandmarkGate>                    박스 내 전신 감지 시에만 아래 버튼 활성
│       │   └─ <RecordButton>                    MediaRecorder start/stop
│       ├─ <MetaForm>
│       │   ├─ <RoleSelect>                      leader | follower | couple
│       │   ├─ <LeaderSideSelect>                role=couple 일 때만 노출 (Plan Q5)
│       │   ├─ <SongField>                       곡명 텍스트(선택)
│       │   └─ <ContestSelect>                   대회 선택(선택, public.contests)
│       └─ <SubmitBar>                           uploads → PUT → jobs → 라우팅
│
├─ /ajudge/jobs/[jobId]/page.tsx                 [4.2 분석 대기]
│   └─ <JobProgress>                             5초 폴링
│       ├─ <StageStepper>                        대기→포즈→비트→코멘트→완료
│       ├─ <SongFallbackPrompt>                  AUDIO_EXTRACT_FAILED 시 원곡 업로드
│       └─ <JobFailed>                           error_code 별 안내 + 재시도
│
├─ /ajudge/report/[reportId]/page.tsx            [4.3 리포트 메인]
│   └─ <ConfidenceGate>          ★ low 면 아래 children 을 렌더하지 않음
│       ├─ (low)  <AnalysisUnavailable>          "분석 불가 — 재촬영 안내" + 사유별 가이드
│       └─ (ok)
│           ├─ <ReportHeader>                    <ConfidenceBadge> + 대회/곡/역할 메타
│           ├─ <VideoOverlayPlayer>
│           │   ├─ <SkeletonCanvas>              metrics.pose 기반 스켈레톤 draw
│           │   └─ <BeatMarkers>                 비트 타임스탬프 마커
│           ├─ <OnbeatTimeline>                  초록/노랑/빨강 바 · 클릭 시 seek
│           ├─ <MetricCards>
│           │   ├─ <ScoredMetricCard>            온비트율 (%) — 유일한 점수 렌더러
│           │   ├─ <ReferenceIndexCard>          파트너 싱크로 (couple 만)
│           │   └─ <ReferenceIndexCard>          음악 반응도
│           ├─ <CommentSections>
│           │   ├─ <TimingComment>               항목 코멘트
│           │   ├─ <MusicalityComment>
│           │   └─ <ReferenceNote> ×2            Technique / Teamwork — "참고 지표" 배지 고정
│           └─ <ReportActions>                   [구간 상세 보기] [PDF 저장]
│
├─ /ajudge/report/[reportId]/segments/page.tsx   [4.4 구간 상세]
│   └─ <ConfidenceGate>
│       ├─ <SegmentList>
│       │   └─ <SegmentCard> ×N
│       │       ├─ <SegmentHeader>               타임코드 · type 배지 · 평균 오프셋 ms
│       │       ├─ <OffsetBarChart>              비트별 오프셋 미니 바차트
│       │       ├─ <DangerBadge>                 penalty_trigger=true 일 때만
│       │       └─ <CoachingLine>                context 기반 코칭 문장
│       └─ <PatternSummary>                      offbeat_pattern_summary
│
└─ /ajudge/history/page.tsx                      [4.5 히스토리]
    ├─ <OnbeatTrendChart>                        시계열 (confidence=low 제외)
    └─ <ReportList> → <ReportListItem>
```

### 5.3 `<ConfidenceGate>` — 절대 원칙 2의 단일 강제점

```tsx
// lib/ai-judge/ConfidenceGate.tsx
// confidence 판정은 워커가 이미 끝냈다. 이 컴포넌트는 '렌더 여부'만 결정한다.
// 개별 화면이 confidence 를 직접 보고 분기하는 코드를 만들지 말 것.
export function ConfidenceGate({ confidence, reasons, children }: Props) {
  if (confidence === 'low') return <AnalysisUnavailable reasons={reasons} />;
  return <>{children}</>;
}
```

`ScoredMetricCard` 는 `onbeat_ratio` 전용으로만 타입이 열려 있고, `ReferenceIndexCard` 는 값을 % 게이지로 그리되 **"참고 지표 · 점수 아님"** 라벨을 컴포넌트 내부에 하드코딩해 제거할 수 없게 한다.

### 5.4 사용자 플로우

```
진입(세션 자동) ─▶ 영상 입력 ─▶ (업로드) ─▶ 분석 대기 ─┬─▶ done ─▶ 리포트 ─┬─▶ 구간 상세
                                            │                  └─▶ PDF
                                            ├─▶ AUDIO_EXTRACT_FAILED ─▶ 원곡 업로드 ─▶ 재큐
                                            └─▶ failed ─▶ 안내 + 재시도
                                리포트 ─▶ 히스토리 ◀─ 하단 탭
```

---

## 6. Error Handling

### 6.1 에러 코드

| 코드 | 발생 | 사용자 표시 | 재시도 |
|------|------|-------------|:------:|
| `VALIDATION_FAILED` | API 입력 검증 | 입력값 안내 | — |
| `UNAUTHORIZED` | 세션 없음/만료 | /ajudge/auth/enter 로 재발급 | — |
| `FILE_TOO_LARGE` | 500MB 초과 | 용량/길이 안내 | — |
| `DURATION_EXCEEDED` | 워커: 3분 초과 | 3분 이내로 잘라 재업로드 | ✅ |
| `AUDIO_EXTRACT_FAILED` | 워커: 오디오 스트림 없음/RMS 미달/비트 추적 실패 | **원곡 파일 업로드 요청** | ✅ |
| `POSE_EXTRACT_FAILED` | 워커: 성공 프레임 < 30% | 재촬영 안내 (실패 처리) | ✅ |
| `PERSON_COUNT_MISMATCH` | 워커: role=couple 인데 1인만 감지 | 역할/영상 확인 안내 | ✅ |
| `COMMENT_REFUSED` | Claude `stop_reason='refusal'` | 지표만 표시, 코멘트 생략 | — |
| `COMMENT_FAILED` | Claude API 오류(재시도 3회 소진) | 지표만 표시, 코멘트 생략 | — |
| `INTERNAL` | 그 외 | 잠시 후 재시도 | ✅ |

> `COMMENT_*` 는 **잡을 실패시키지 않는다.** 지표는 산출되었으므로 `comments_json = {}` 로 리포트를 저장하고 `status=done` 으로 둔다. 리포트 화면은 코멘트 섹션만 "코멘트 생성 실패" 로 표시한다.

### 6.2 응답 포맷

```jsonc
{ "error": "AUDIO_EXTRACT_FAILED", "message": "영상에서 음악을 추출하지 못했습니다.",
  "detail": { "reason": "no_audio_stream" } }
```

---

## 7. 분석 파이프라인 상세 (worker/)

### 7.1 스테이지

| # | 스테이지 | status | 산출물 |
|---|----------|--------|--------|
| 0 | claim | `pose` | jobs 갱신 |
| 1 | 영상 다운로드 · 메타 검사 | `pose` | 로컬 mp4, duration/fps/해상도 |
| 2 | 포즈 추출 | `pose` | `landmarks[T, P, 33, 4]` (P=1 또는 2) |
| 3 | 오디오 추출 · 비트 분석 | `beat` | `beats[]`, `onset_env[]`, `rms[]`, bpm |
| 4 | 지표 산출 | `beat` | timing / reference |
| 5 | 구간 태깅 | `beat` | `offbeat_segments[]` |
| 6 | confidence 산출 | `beat` | high/medium/low |
| 7 | 키프레임 추출·업로드 | `comment` | frames/*.jpg 6~10장 |
| 8 | Claude vision 코멘트 | `comment` | `comments_json` |
| 9 | reports INSERT + 이메일 | `done` | — |

### 7.2 포즈 (MediaPipe Tasks — PoseLandmarker)

- `running_mode=VIDEO`, `num_poses = 2 if role=='couple' else 1`
- **전신 이탈 판정**: 어깨·골반·양 발목 중 하나라도 프레임 밖(정규화 좌표 [0,1] 이탈) 또는 `visibility < 0.5` → 해당 프레임을 `out_of_frame` 으로 카운트
- **ID 스위칭 감지** (couple): 프레임 t와 t-1의 인물 매칭을 골반 중심 거리 최소 비용으로 수행하고, ① 매칭 비용이 임계 초과 ② 매칭이 이전 프레임과 교차(swap) — 둘 중 하나가 3프레임 이상 연속 발생 시 `id_switch_detected=true`

### 7.3 비트 (ffmpeg + librosa)

```
ffmpeg -i video.mp4 -vn -ac 1 -ar 22050 -f wav audio.wav
librosa.beat.beat_track()   → beats[] (sec), bpm
librosa.onset.onset_strength() → onset_env
librosa.feature.rms()       → rms envelope
```
추출 실패 판정(→ `AUDIO_EXTRACT_FAILED`):
- 오디오 스트림 없음
- 평균 RMS < 임계 (무음 수준)
- 비트 간격 표준편차 / 평균 > 임계 (템포 불안정) 🟠 PENDING-RUBRIC 아님, 워커 상수

### 7.4 지표

| 지표 | 산출 |
|------|------|
| **동작 온셋** | 발목·손목·골반 랜드마크 속도 크기의 국소 최대점 |
| **오프셋(ms)** | 각 동작 온셋 → 최근접 비트와의 부호 있는 시차. `+`=늦음(lag), `−`=빠름(rush) |
| **온비트율** | `count(\|offset\| ≤ T_onbeat) / total_onsets × 100`.<br>`T_onbeat = max(50, 0.10×beat_interval)`, `T_minor = max(100, 0.20×beat_interval)` — rubric §2.2 |
| **싱크로 (참고)** | 리더/팔로워 속도 시계열의 상호상관 피크값(0~100) 및 lag(ms). `leader_side` 로 부호 해석 |
| **활동량 (참고)** | 관절 속도 RMS 시계열과 음악 RMS 포락선의 상관 → 0~100 정규화 |

### 7.5 구간 태깅

rubric §3~§4 를 그대로 구현한다.

1. 오프셋 부호가 같고 `|offset| > T_onbeat` 인 동작 온셋 **연속 3개 이상** → 구간 성립
2. `type` = 구간 평균 부호가 `+`면 `lag`, `−`면 `rush`
3. `break_ignored` = 음악 RMS 하위 20% 구간과 50% 이상 겹치는데 활동량이 직전 구간 대비 감소하지 않음
4. `context` 교차 판정 (rubric §3.3):
   - `post_turn` — 구간 시작 2초 이내 턴 감지(어깨-골반 orientation 누적 회전 ≥ 180°)
   - `music_break` — 구간이 RMS 하위 20% 구간과 50% 이상 중첩
   - `chorus_entry` — 온셋 밀도 급증 경계 ±1초
   - 그 외 `general`
5. `penalty_trigger` / `penalty_codes` (rubric §4):
   - `P-1` `|offset| > T_minor` 인 온셋 연속 4개 이상
   - `P-2` 구간 평균 `|offset| > 0.35 × beat_interval`
   - `P-3` `type = break_ignored`
   - `P-4` 동일 type 구간이 영상 내 3회 이상 반복
   - ⚠️ 트리거는 표시용이다. `onbeat_ratio` 를 차감하지 않는다 (rubric §4 하단)

### 7.6 confidence 산출 (절대 원칙 2, 단일 함수)

```python
# worker/confidence.py — 이 함수가 confidence 의 유일한 산출처다.
def compute_confidence(pose) -> tuple[str, list[str]]:
    reasons = []
    if pose.success_ratio < 0.80:      reasons.append("pose_success_low")
    if pose.id_switch_detected:        reasons.append("id_switch_detected")
    if pose.out_of_frame_ratio > 0.10: reasons.append("out_of_frame_high")
    if reasons:
        return "low", reasons
    if pose.success_ratio < 0.90 or pose.out_of_frame_ratio > 0.05:
        return "medium", []
    return "high", []
```

### 7.7 Claude 코멘트 생성

```python
from anthropic import Anthropic
client = Anthropic()   # ANTHROPIC_API_KEY

resp = client.messages.create(
    model="claude-opus-5",
    max_tokens=8000,                       # 사고 + 응답 합산 상한 (opus-5는 사고 기본 ON)
    system=[
        {"type": "text",
         "text": RUBRIC_MD,                # docs/rubric.md 전문 (빌드 시 임베드)
         "cache_control": {"type": "ephemeral"}},   # 리포트마다 재사용 → 캐시 히트
        {"type": "text", "text": ABSOLUTE_RULES_PROMPT},   # rubric §7.1 고정 문구
    ],
    output_config={
        "effort": "high",
        "format": {"type": "json_schema", "schema": COMMENTS_SCHEMA},
    },
    messages=[{"role": "user", "content": [
        *[{"type": "image",
           "source": {"type": "base64", "media_type": "image/jpeg", "data": b64}}
          for b64 in keyframe_b64s],                      # 6~10장, 장변 1280px
        {"type": "text", "text": json.dumps(metrics_json, ensure_ascii=False)},
    ]}],
)
if resp.stop_reason == "refusal":
    raise CommentRefused(resp.stop_details)
```

`ABSOLUTE_RULES_PROMPT` 전문은 [rubric §7.1](../../rubric.md) 에 있다. 요지: Timing 축에만 정량 판정을 붙이고, Technique/Teamwork/Musicality 는 점수·등급·순위를 어떤 형태로도 생성하지 않으며, 합불·등수·타 참가자 비교를 언급하지 않는다.

**비용 추정**: 키프레임 8장 × ~1,600 tok + 지표 JSON ~2K + rubric(캐시 읽기) → 입력 ~15K tok ≈ $0.075, 출력 ~2K tok ≈ $0.05 → **리포트당 ~$0.13** (Plan NFR ≤$0.15 충족).

**주의사항** (claude-api 레퍼런스 반영):
- `claude-opus-5` 는 `temperature`/`top_p`/`top_k` 미지원 (400)
- 사고가 기본 ON → `max_tokens` 는 사고+응답 합산 상한. 넉넉히 잡는다
- `stop_reason == "refusal"` 을 `content` 읽기 **전에** 검사
- 구조화 출력 스키마는 모든 object 에 `additionalProperties:false` 필수

---

## 8. Security

| 항목 | 조치 |
|------|------|
| 영상 접근 | private bucket + `{user_id}/` prefix RLS + 만료 1시간 signed URL |
| 리포트 접근 | `reports` SELECT 정책 `user_id = auth.uid()` |
| service_role 키 | **워커 프로세스에만** 존재. Route Handler·클라이언트 미노출 |
| 업로드 | 서버가 경로를 결정(사용자 입력 파일명은 경로에 사용하지 않음). 확장자·MIME·용량 검증 |
| 개인정보 | `judge_scores` 는 anon/authenticated 정책 없음 (service_role 전용) |
| 기존 인증 충돌 | middleware 는 `/admin`·`/mc` 를 **먼저** 처리하고 early return. `/ajudge` 는 별도 분기 |
| PII 최소화 | 이메일은 `auth.users` 를 원본으로 하고 profiles 는 캐시. 로그에 이메일 미기록 |

---

## 9. Test Plan

### 9.1 범위

| 레벨 | 대상 | 도구 |
|------|------|------|
| L1 | 워커 순수 함수 (지표·태깅·confidence) | pytest |
| L2 | API Route Handler 계약 | 수동 curl + 타입체크 |
| L3 | E2E 시나리오 | 샘플 영상 3종 수동 |

### 9.2 L1 — 워커 단위 테스트

| 케이스 | 입력 | 기대 |
|--------|------|------|
| confidence: 포즈 성공률 부족 | success_ratio=0.75 | `low`, `pose_success_low` |
| confidence: ID 스위칭 | id_switch=True | `low`, `id_switch_detected` |
| confidence: 전신 이탈 | out_of_frame=0.15 | `low`, `out_of_frame_high` |
| confidence: 경계 | 0.85 / 0.03 | `medium` |
| confidence: 정상 | 0.95 / 0.01 | `high` |
| 온비트율 | 합성 오프셋 배열 | 기대 % 일치 |
| 구간 태깅 | 연속 lag 4비트 | segment 1개, type=lag |
| break_ignored | RMS 저점 + 활동 유지 | type=break_ignored |
| 스키마 검증 | 산출 metrics_json | jsonschema 통과 |

### 9.3 L3 — E2E 시나리오

| # | 시나리오 | 기대 |
|---|----------|------|
| S1 | 정상 솔로 영상 업로드 | done + confidence≥medium + 리포트 렌더 |
| S2 | 화각 불량(상반신만) 영상 | confidence=low + "분석 불가 — 재촬영 안내" 표시, 지표 카드 미렌더 |
| S3 | 커플 영상 | 2인 추적 + sync_index 산출 (또는 ID 스위칭 시 low) |
| S4 | 무음 영상 | `AUDIO_EXTRACT_FAILED` → 원곡 업로드 프롬프트 → 재큐 → done |
| S5 | 직접 촬영 | 전신 미감지 시 녹화 버튼 비활성 확인 |

### 9.4 절대 원칙 자체 감사 (Check 단계 필수)

`scripts/ai-judge-audit.mjs` — `app/ajudge/`, `components/ai-judge/`, `lib/ai-judge/`, `worker/`, `db/migrations/0032_ai_judge.sql` 를 스캔:

| 검사 | 실패 조건 |
|------|-----------|
| P1 | `technique_score`, `teamwork_score`, `musicality_score` 등 Timing 외 축의 점수 식별자 발견 |
| P1 | `COMMENTS_SCHEMA` 에 `"type":"number"` 또는 `"integer"`(단, `segment_index` 제외) 존재 |
| P2 | `reports` 조회 결과를 `<ConfidenceGate>` 밖에서 렌더하는 페이지 존재 |
| P3 | `rank`, `ranking`, `pass_fail`, `is_pass`, `winner`, `total_score`, `qualified` 식별자 발견 |

발견 시 `exit 1`.

---

## 10. Implementation Guide

### 10.1 파일 구조

```
docs/rubric.md                                  🟠 신규 (블로커)
db/migrations/0032_ai_judge.sql                 신규

worker/                                         신규 (Python)
├─ README.md                                    실행법·환경변수
├─ requirements.txt
├─ config.py                 env 로딩
├─ thresholds.py             🟠 PENDING-RUBRIC 상수 단일 소유
├─ queue.py                  claim_job / 상태 전이 / requeue_stale
├─ media.py                  다운로드·ffmpeg·키프레임 추출
├─ pose.py                   MediaPipe · ID 스위칭 감지
├─ beat.py                   librosa
├─ metrics.py                온비트율·오프셋·싱크로·활동량
├─ segments.py               구간 태깅 · context
├─ confidence.py             ★ 절대 원칙 2 단일 산출처
├─ comments.py               Claude vision + COMMENTS_SCHEMA
├─ notify.py                 Resend
├─ pipeline.py               스테이지 오케스트레이션
├─ cli.py                    사이클1 검증 진입점
├─ main.py                   상시 폴링 진입점
└─ tests/

lib/ai-judge/                                   신규
├─ types.ts                  Report/Job/Metrics/Comments 타입
├─ thresholds.ts             표시용 상수 (판정 아님)
├─ supabase-browser.ts       @supabase/ssr 클라이언트
├─ supabase-server.ts
└─ format.ts                 타임코드·ms 포맷

components/ai-judge/                            신규
├─ ConfidenceGate.tsx        ★ 절대 원칙 2 단일 강제점
├─ AnalysisUnavailable.tsx
├─ input/{InputTabs,UploadPanel,RecordPanel,MetaForm,PreflightCheck}.tsx
├─ job/{JobProgress,StageStepper,SongFallbackPrompt}.tsx
├─ report/{ReportHeader,VideoOverlayPlayer,SkeletonCanvas,OnbeatTimeline,
│          MetricCards,ScoredMetricCard,ReferenceIndexCard,CommentSections}.tsx
├─ segments/{SegmentList,SegmentCard,OffsetBarChart,PatternSummary}.tsx
└─ history/{ReportList,OnbeatTrendChart}.tsx

app/ajudge/{layout,page}.tsx
app/ajudge/auth/enter/route.ts
app/ajudge/jobs/[jobId]/page.tsx
app/ajudge/report/[reportId]/{page.tsx,segments/page.tsx}
app/ajudge/history/page.tsx
app/api/ajudge/{uploads,jobs,jobs/[jobId],jobs/[jobId]/song,reports/[reportId],history}/route.ts

app/page.tsx                                    수정 — AI JUDGE 버튼
middleware.ts                                   수정 — 경로 분기
config/env.ts                                   수정 — 신규 env
scripts/ai-judge-audit.mjs                      신규
```

### 10.2 구현 순서 (세션 분할)

| 세션 | 사이클 | 내용 | 완료 판정 |
|:----:|:------:|------|-----------|
| **S1** | 1 | rubric 확정 → `0032_ai_judge.sql` + `thresholds.py` + `worker/` 골격 + queue | `npm run db:migrate` 성공, `claim_job` 동작 |
| **S2** | 1 | media / pose / beat / metrics + pytest | 샘플 영상 → metrics_json 산출 |
| **S3** | 1 | segments / confidence / comments / notify / pipeline / cli | **CLI E2E: reports 행 1건 생성** ← 사이클1 완료 게이트 |
| **S4** | 2 | Auth + middleware 분기 + `/ajudge` 셸 + 홈 버튼 + 입력 화면 | 업로드 → jobs queued |
| **S5** | 2 | 대기 화면 + 리포트 메인 (ConfidenceGate·플레이어·타임라인·카드·코멘트) | **업로드~리포트 무인 통과** |
| **S6** | 2 | 구간 상세 | S2 시나리오 통과 |
| **S7** | 3 | 히스토리 + 이메일 + PDF | 사이클3 DoD |
| **S8** | Check | gap-detector + `ai-judge-audit.mjs` + 보고 | Match Rate ≥90%, audit exit 0 |

### 10.3 middleware 분기

```ts
export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*', '/mc/:path*',
            '/ajudge/:path*', '/api/ajudge/:path*'],
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // AI Judge — Supabase 세션 refresh. 기존 admin 로직과 완전히 분리한다.
  if (pathname.startsWith('/ajudge') || pathname.startsWith('/api/ajudge')) {
    return updateAiJudgeSession(req);      // lib/ai-judge/supabase-server.ts
  }
  /* ...기존 admin PIN 세션 로직 그대로... */
}
```

---

## 11. 결정 사항 및 잔여 — Plan §10 참조

### ✅ 반영 완료

| Q | 결정 | 반영 위치 |
|---|------|-----------|
| Q1 | rubric 초안 작성 → 승인 대기 | [docs/rubric.md](../../rubric.md) v0.1-draft. §3.4 임계값, §7.4/§7.5 판정식, §7.7 프롬프트에 반영 |
| Q3 | 영상 오디오 트랙을 비트 분석에 사용 | §7.3. 음악 인식 API 미도입 |
| Q5 | 리더 위치 입력 추가 | §3.3 `jobs.leader_side`, §5.2 `<LeaderSideSelect>` |
| Q7 | 버튼은 사이클 2에 화면과 함께 | §5.1, §10.2 세션 S4 |

### 🟡 잔여 (사이클 1 착수 무관)

| Q | 설계 영향 | 현재 전제 |
|---|-----------|-----------|
| Q2 워커 배포처 | §2.1 하단 박스 | 사이클1 = 로컬 CLI. 사이클2 배포 직전 결정 |
| Q4 영상 보관 | §3.3 Storage, 만료 배치 | 30일 보관 전제. 사이클3에서 만료 배치 구현 |
| Q6 컬럼명 | §3.3 `sync_index`/`activity_index` | 개명 전제. 스펙 유지 시 컬럼명만 치환 |

### 남은 블로커

**[docs/rubric.md](../../rubric.md) v0.1-draft 승인.** 승인 즉시 세션 S1 착수 가능.

---

## Version History

| 버전 | 날짜 | 변경 | 작성 |
|------|------|------|------|
| 0.1 | 2026-07-28 | 최초 초안 | Claude (bkit PDCA) |
