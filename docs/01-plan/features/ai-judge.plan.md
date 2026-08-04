---
feature: ai-judge
phase: plan
created: 2026-07-28
project: jnj-dash-app (v0.1.0)
level: Dynamic
status: Draft — 승인 대기
methodology: bkit PDCA v2.1.12
---

# 📋 Plan: AI Judge

> **한 줄 요약**: 잭앤질/소셜댄스 영상을 분석해 **온비트 지표(점수)** 와 **AI 코칭 리포트(정성)** 를 제공하는 참가자용 모바일 웹앱. JNJ_Dash 서브 프로덕트.

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| **문제** | 참가자는 대회에서 점수만 받고 "왜 그 점수인지", "무엇을 고쳐야 하는지"를 알 수 없다. 심사위원 피드백은 시간·인력 제약으로 스케일하지 않는다. |
| **해법** | 영상에서 포즈(MediaPipe)와 비트(librosa)를 추출해 **객관적으로 측정 가능한 Timing만 점수화**하고, 나머지 축은 Claude vision이 rubric 기반 **정성 코멘트**만 생성한다. |
| **기능/UX 효과** | 대회 직후 또는 연습 영상으로 본인 온비트율·오프비트 구간·원인 추정 코칭을 받는다. 히스토리로 성장 추적. |
| **핵심 가치** | "측정 가능한 것만 점수화한다"는 신뢰. AI가 순위를 매기지 않기 때문에 대회 심사와 충돌하지 않고 **연습 도구**로 포지셔닝된다. |

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 참가자가 점수의 근거와 개선점을 알 수 없다 |
| **WHO** | 대회 참가자(리더/팔로워/커플). 부차적으로 강사·심사위원(라벨 축적) |
| **RISK** | ① `docs/rubric.md` 부재 → 모든 판정 기준 미확정 ② 포즈 추출 품질(화각·조명·2인 ID 스위칭) ③ Python 워커 배포 위치 미정(Vercel 불가) |
| **SUCCESS** | 샘플 영상 1개 → CLI E2E 로 reports JSON 산출 (사이클 1) → 리포트 화면 렌더 무인 통과 (사이클 2) |
| **SCOPE** | IN: 분석 파이프라인 / 영상입력·리포트·구간상세 / 히스토리·이메일·PDF · OUT: 결제, 순위·합불 판정, 알림톡 |

---

## 1. Overview

### 1.1 목적

댄스 영상의 **온비트 정확도**를 정량 측정하고, rubric 기준의 정성 코칭을 붙여 참가자에게 반환한다.

### 1.2 배경

JNJ_Dash 는 현재 대회 **운영·표출·채점 집계**를 담당한다(`/dashboard`, `/admin`, `/vote`, `/ojudge`, `/mc`).
AI Judge 는 그 데이터 자산(대회·참가자·심사 항목) 위에 얹는 **참가자향 서브 프로덕트**이며,
Supabase 프로젝트는 공유하되 스키마는 `ai_judge` 로 완전히 분리해 기존 운영 테이블에 영향을 주지 않는다.

### 1.3 관련 문서

- 심사 기준(단일 기준): `docs/rubric.md` — **⚠️ 현재 저장소에 존재하지 않음. 블로커 Q1 참조**
- 기존 설계: [docs/DESIGN-SPEC.md](../../DESIGN-SPEC.md)
- 선행 PDCA 아카이브: [docs/archive/2026-05/jnj-dash-app/](../../archive/2026-05/jnj-dash-app/)
- 설계 문서: [ai-judge.design.md](../../02-design/features/ai-judge.design.md)

---

## 2. Scope

### 2.1 In Scope

**사이클 1 — 분석 파이프라인 E2E (완료 기준의 심장)**
- [ ] `ai_judge` 스키마 마이그레이션 (jobs / reports / profiles / judge_scores)
- [ ] Python 워커: 큐 폴링 → 포즈 추출 → 비트 분석 → 지표 산출 → 구간 태깅 → Claude 코멘트 → reports 저장
- [ ] confidence 게이트 산출 로직
- [ ] CLI 검증: 샘플 영상 1개 → reports JSON 정상 산출 (UI 없음)

**사이클 2 — 웹앱**
- [ ] 홈 헤더에 `AI JUDGE ↗` 진입 버튼 (첨부 이미지 노란 사각 위치)
- [ ] Supabase Auth 로그인
- [ ] 4.1 영상 입력(업로드 / 직접 촬영 + 전신 가이드 박스)
- [ ] 4.2 분석 대기(상태 폴링)
- [ ] 4.3 리포트 메인(canvas 오버레이 + 타임라인 + 지표 카드 + 코멘트)
- [ ] 4.4 구간 상세(오프비트 카드 리스트 + 미니 바차트 + 코칭 문장)

**사이클 3 — 부가**
- [ ] 4.5 히스토리(리포트 목록 + 온비트율 시계열)
- [ ] 완료 이메일 알림
- [ ] PDF 저장

### 2.2 Out of Scope

- 결제 / 구독 (스키마에 `paid boolean default false` 만 예약)
- 순위 결정·합격/불합격 판정 로직 — **절대 원칙 3, 코드에 존재해서는 안 됨**
- 알림톡 (TODO 주석으로만 남김)
- 기존 대회 채점(`judges`, `scores`) 과의 연동 — 별도 사이클
- Technique/Teamwork/Musicality 의 **점수화** — 절대 원칙 1

---

## 3. Requirements

### 3.1 기능 요구사항

| ID | 요구사항 | 사이클 | 우선순위 |
|----|----------|:------:|:--------:|
| FR-01 | `ai_judge` 스키마 4개 테이블 + Storage 버킷 + RLS | 1 | High |
| FR-02 | 워커가 `ai_judge.jobs` 를 10초 간격 폴링하고 원자적으로 claim | 1 | High |
| FR-03 | MediaPipe Pose 로 프레임별 랜드마크 추출 (커플=2인 + ID 스위칭 감지) | 1 | High |
| FR-04 | 영상 오디오 트랙에서 비트 타임스탬프·온셋 밀도·RMS 추출 (librosa) | 1 | High |
| FR-05 | 온비트율 / 오프셋 분포 / 싱크로 / 활동량 지표 산출 | 1 | High |
| FR-06 | 오프비트 구간 검출 + type(lag/rush/break_ignored) + context 자동 태깅 | 1 | High |
| FR-07 | confidence(high/medium/low) 산출. low 3개 조건 판정 | 1 | High |
| FR-08 | 지표 JSON + 키프레임 6~10장 → Claude vision → 항목별 코멘트·종합 요약 | 1 | High |
| FR-09 | reports 저장 + 이메일 발송 | 1/3 | High |
| FR-10 | 홈 헤더 `AI JUDGE ↗` 버튼 → `/ajudge` 새 탭 | 2 | High |
| FR-11 | Supabase Auth 로그인/로그아웃/세션 유지 | 2 | High |
| FR-12 | 파일 업로드(mp4/mov, ≤3분·500MB) + 첫 프레임 사전 품질 체크 | 2 | High |
| FR-13 | 직접 촬영(MediaRecorder) + 전신 가이드 박스 + 랜드마크 감지 시에만 녹화 활성 | 2 | High |
| FR-14 | 역할 선택 (리더/팔로워/커플) | 2 | High |
| FR-15 | 곡 자동 추출 실패 시 원곡 파일 업로드 요청 플로우 | 2 | Medium |
| FR-16 | 분석 대기 화면 — 5단계 상태 표시 | 2 | High |
| FR-17 | 리포트 메인 — 신뢰도 배지 / 플레이어 canvas 오버레이 / 타임라인 / 지표 카드 3개 / 항목별 코멘트 | 2 | High |
| FR-18 | confidence=low → 지표 숨김 + "분석 불가 — 재촬영 안내" | 2 | High |
| FR-19 | 구간 상세 — 오프비트 카드 리스트 + 미니 바차트 + danger 배지 + 코칭 문장 + 종합 요약 | 2 | High |
| FR-20 | 히스토리 — 리포트 목록 + 온비트율 시계열 그래프 | 3 | Medium |
| FR-21 | PDF 저장 | 3 | Medium |
| FR-22 | `judge_scores` 테이블 (rubric 5장 스키마의 테이블화, 라벨 축적용 — 지금은 빈 테이블) | 1 | Medium |

### 3.2 비기능 요구사항

| 범주 | 기준 | 측정 방법 |
|------|------|-----------|
| 성능 | 3분 영상 분석 완료 ≤ 10분 (워커 1대 기준) | 워커 로그의 `started_at ~ finished_at` |
| 성능 | 리포트 화면 LCP ≤ 2.5s (모바일 4G) | Lighthouse |
| 보안 | 영상·리포트는 소유자 본인만 접근 (RLS + private bucket + signed URL) | 타 계정 토큰으로 접근 시 403 확인 |
| 비용 | 리포트 1건당 Claude API 비용 ≤ $0.15 | `usage` 필드 합산 로깅 |
| 정확성 | confidence=low 조건 3개 각각에 대한 단위 테스트 통과 | pytest |
| 원칙 준수 | 절대 원칙 3개 위반 0건 | `scripts/ai-judge-audit.mjs` (금칙어 스캔) |

---

## 4. Success Criteria

### 4.1 Definition of Done — 사이클별

**사이클 1 (Check 게이트)**
- [ ] `python worker/cli.py --video sample.mp4 --role leader` → reports 행 1건 생성
- [ ] 산출 JSON 이 Design §3 의 `metrics_json` / `comments_json` 스키마를 만족 (jsonschema 검증 통과)
- [ ] 화각 불량 샘플 → `confidence='low'` 반환 확인
- [ ] 커플 샘플 → 2인 추적 성공, ID 스위칭 감지 로직 동작 확인

**사이클 2**
- [ ] 업로드 → 리포트 화면 렌더까지 **무인 통과** (수동 개입 0회)
- [ ] confidence=low 영상 입력 시 화면에 "분석 불가" 표시 + 지표 카드 미렌더

**사이클 3**
- [ ] 히스토리 2건 이상에서 시계열 그래프 렌더
- [ ] 완료 이메일 수신 확인
- [ ] PDF 저장 결과물에 지표·코멘트 포함

### 4.2 품질 기준

- [ ] `npm run typecheck` / `npm run lint` 오류 0
- [ ] `npm run build` 성공
- [ ] 워커 `pytest` 통과 (confidence 게이트·구간 태깅·지표 계산)
- [ ] gap-detector Match Rate ≥ 90%

---

## 5. 절대 원칙 — 코드 레벨 강제 방안

> 이 3개는 "지키자"가 아니라 **구조적으로 위반이 불가능하도록** 설계한다.

| # | 원칙 | 강제 방안 |
|---|------|-----------|
| **P1** | AI는 Timing에만 점수를 부여한다 | · 점수형 컬럼은 `reports.onbeat_ratio` **단 하나**<br>· Claude 응답 스키마(structured output)의 `technique/teamwork/musicality` 는 `comment: string` 만 허용하고 숫자 필드를 **스키마에 정의하지 않음** → 모델이 점수를 낼 방법이 없음<br>· UI 타입 `ReferenceNote`(점수 렌더러 없음) vs `ScoredMetric` 분리 |
| **P2** | 모든 결과에 confidence 포함, low면 지표 숨김 | · `reports.confidence` **NOT NULL + CHECK IN ('high','medium','low')**<br>· 워커의 `compute_confidence()` 단일 함수가 유일한 산출처<br>· UI 최상위 `<ConfidenceGate>` 래퍼가 low 일 때 children 을 렌더하지 않음 (개별 화면이 판단하지 않음) |
| **P3** | 순위·합불 판정 로직 없음 | · 스키마에 `rank`/`pass`/`fail`/`total_score`/`winner` 컬럼 부재<br>· `scripts/ai-judge-audit.mjs` 가 `app/ajudge`·`lib/ai-judge`·`worker/` 에서 해당 식별자 발견 시 **exit 1**<br>· Check 단계에서 실행 |

---

## 6. Risks and Mitigation

| 리스크 | 영향 | 확률 | 완화 |
|--------|:----:|:----:|------|
| **`docs/rubric.md` 부재** — 감점 기준·코멘트 톤·judge_scores 스키마의 단일 근거가 없음 | High | 확정 | **Q1 블로커.** rubric 확정 전까지 사이클 1의 "구간 태깅→감점 트리거 매핑"과 "judge_scores 스키마"는 착수 불가. 나머지(포즈/비트/지표)는 선행 가능 |
| Python 워커를 Vercel에 못 올림 | High | 확정 | 사이클 1은 로컬 CLI 로 검증(문제 없음). 사이클 2 이후 배포처 결정 필요 → Q2 |
| MediaPipe 2인 추적 품질 저하 (겹침·회전) | High | Medium | ID 스위칭 감지를 **필수**로 두고, 감지 시 confidence=low 로 폴백 → 잘못된 싱크로 지표를 내보내지 않음 |
| 영상 오디오가 현장 녹음이라 비트 추출 불안정 | Medium | High | 추출 실패 조건을 명시적으로 정의하고 원곡 업로드 폴백(FR-15) |
| Supabase Storage 용량 (무료 1GB, 영상 500MB) | Medium | High | 분석 완료 후 원본 영상 N일 보관 후 삭제 정책 → Q4 |
| Claude vision 비용 초과 | Medium | Medium | 키프레임 장변 1280px 다운샘플(~1600 tok/장) + rubric 시스템 프롬프트 prompt caching → 리포트당 ~$0.08 예상 |
| Supabase Auth 도입이 기존 `/admin` PIN 세션과 충돌 | Medium | Low | middleware 를 경로별 분기(기존 admin 로직 무변경) |

---

## 7. Impact Analysis

### 7.1 변경 리소스

| 리소스 | 유형 | 변경 내용 |
|--------|------|-----------|
| [app/page.tsx](../../../app/page.tsx) | Page | 헤더에 `AI JUDGE ↗` Link 1개 추가 (기존 링크 사이) |
| [middleware.ts](../../../middleware.ts) | Middleware | matcher 에 `/ajudge/:path*`, `/api/ajudge/:path*` 추가 + 경로 분기 |
| [package.json](../../../package.json) | Config | `@supabase/ssr` 추가 |
| [config/env.ts](../../../config/env.ts) | Config | `RESEND_API_KEY`, `AI_JUDGE_*` 환경변수 추가 |
| `db/migrations/0032_ai_judge.sql` | DB | **신규 스키마** — 기존 `public` 테이블 무변경 |
| Supabase API Settings | Infra | Exposed schemas 에 `ai_judge` 추가 (대시보드 수동 1회) |

### 7.2 기존 소비자 영향

| 리소스 | 작업 | 코드 경로 | 영향 |
|--------|------|-----------|------|
| `app/page.tsx` | READ | 홈 렌더 | 없음 — 링크 추가만 |
| `middleware.ts` | ALL | `/admin/*`, `/api/admin/*`, `/mc/*` | **검증 필요** — 분기 추가 시 기존 경로가 supabase 로직을 타지 않도록 early return |
| `lib/db/client.ts` | READ | 전 API | 없음 — `ai_judge` 는 별도 클라이언트 팩토리 사용 |
| `public` 스키마 테이블 | ALL | 전 기능 | 없음 — 신규 스키마 격리 |
| `db/migrations` | — | `npm run db:migrate` | 없음 — 0032 는 순번 추가 |

### 7.3 검증 체크리스트

- [ ] `/admin` 로그인·`/mc` 접근이 middleware 변경 후에도 동작
- [ ] `npm run db:migrate` 재실행 안전 (idempotent)
- [ ] `ai_judge` 스키마 노출이 `public` 의 RLS 정책에 영향 없음
- [ ] 홈 헤더가 좁은 화면에서 줄바꿈으로 깨지지 않음 (버튼 5개로 증가)

---

## 8. Architecture Considerations

### 8.1 프로젝트 레벨

| 레벨 | 선택 |
|------|:----:|
| Starter | ☐ |
| **Dynamic** (feature 모듈 + BaaS) | ☑ |
| Enterprise | ☐ |

기존 jnj-dash-app 과 동일한 Dynamic 레벨 유지. 단, **워커는 별도 프로세스/언어(Python)** 로 분리된 2-tier 구조.

### 8.2 주요 아키텍처 결정

| 결정 | 선택지 | 선택 | 근거 |
|------|--------|------|------|
| 앱 위치 | 기존 repo 내 `/ajudge` / 별도 repo | **기존 repo** | 디자인 시스템·Supabase 클라이언트·배포 파이프라인 재사용. 홈 진입 버튼 요구사항과도 자연스러움 |
| DB 격리 | 별도 프로젝트 / 별도 스키마 / 같은 스키마 | **별도 스키마 `ai_judge`** | 스펙 지정. 운영 테이블 오염 방지 + 같은 Auth 사용 |
| 큐 | 메시지큐 / **테이블 폴링** | **테이블 폴링 10초** | 스펙 명시("메시지큐 도입 금지 — 과설계"). 일 수십 건 규모에 충분 |
| 워커 언어 | Node / **Python** | **Python** | MediaPipe·librosa 생태계 |
| 인증 | PIN 쿠키 / **Supabase Auth** | **Supabase Auth** | 참가자 개인 데이터. 스펙 명시 |
| 상태 관리 | Context / Zustand / **RSC + URL** | **RSC + 최소 useState** | 기존 앱 관례 동일 |
| 스타일 | **Tailwind** | Tailwind | 기존 동일 |
| LLM | **Claude API (`claude-opus-5`)** | claude-opus-5 | vision + structured output + prompt caching. 리포트당 ~$0.08 |

### 8.3 폴더 구조 미리보기

```
app/ajudge/                 # 참가자 웹앱 (모바일 우선)
app/api/ajudge/             # Route Handlers
components/ai-judge/        # 화면 컴포넌트
lib/ai-judge/               # 타입·supabase 클라이언트·포맷터
worker/                     # Python 분석 워커 (별도 프로세스)
db/migrations/0032_ai_judge.sql
docs/rubric.md              # ⚠️ 생성 필요
```

---

## 9. Convention Prerequisites

### 9.1 기존 컨벤션

- [x] `docs/DESIGN-SPEC.md` 존재 — `// Design Ref: §N` 주석 관례
- [x] `tsconfig.json` / `eslint-config-next` 존재
- [x] 마이그레이션 번호 규칙 `NNNN_name.sql`, `npm run db:migrate` 재실행 안전
- [x] SQL 파일 상단 한글 주석으로 의도·RLS 정책 설명
- [ ] Python 컨벤션 — **신규 정의 필요** (ruff + pytest, `worker/README.md`)

### 9.2 필요 환경변수

| 변수 | 용도 | 범위 | 신규 |
|------|------|------|:----:|
| `NEXT_PUBLIC_SUPABASE_URL` | 기존 | Client | ☐ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 기존 | Client | ☐ |
| `SUPABASE_SERVICE_ROLE_KEY` | 워커 큐 claim | Server/Worker | ☐ |
| `ANTHROPIC_API_KEY` | 코멘트 생성 | Worker | ☑ |
| `RESEND_API_KEY` | 완료 알림 | Worker | ☑ |
| `AI_JUDGE_WORKER_ID` | 워커 인스턴스 식별 | Worker | ☑ |
| `AI_JUDGE_POLL_SECONDS` | 폴링 주기(기본 10) | Worker | ☑ |
| `NEXT_PUBLIC_AI_JUDGE_MAX_MB` | 업로드 제한(기본 500) | Client | ☑ |

> ⚠️ Vercel 환경변수 등록 시 PowerShell 파이프 금지 (BOM 오염). bash `printf` 사용.

---

## 10. 불명확 사항

### ✅ 확정됨 (2026-07-28)

| Q | 질문 | 결정 |
|---|------|------|
| **Q1** | `docs/rubric.md` 부재 (블로커) | **Claude 가 초안 작성 → 승인.** [docs/rubric.md](../../rubric.md) v0.1-draft 작성 완료. **승인 대기** |
| **Q3** | "곡 자동 추출"의 의미 | **영상 오디오 트랙을 비트 분석에 그대로 사용.** 음악 인식 API 미도입. 곡 제목은 사용자 텍스트 입력 |
| **Q5** | 커플 모드 리더/팔로워 구분 | **입력 화면에 "리더 위치(왼쪽/오른쪽)" 선택 추가.** `jobs.leader_side` 컬럼 |
| **Q7** | 홈 진입 버튼 시점 | **사이클 2에서 화면과 함께 배포.** 라벨 `AI JUDGE ↗`, 경로 `/ajudge`, 새 탭, accent 강조 |

Q3 결정에 따른 "추출 실패" 정의 (→ `AUDIO_EXTRACT_FAILED`, 원곡 업로드 폴백):
(a) 오디오 스트림 없음 (b) 평균 RMS 무음 임계 미만 (c) 비트 간격 변동계수 초과(템포 불안정)

### 🟡 잔여 — 사이클 1 착수에는 영향 없음

**Q2. Python 워커 배포처.** Vercel 불가.
① 로컬 PC 상시 실행 ② VM/Fly.io/Railway 컨테이너 ③ 사이클 1은 로컬, 이후 결정
→ **권장 ③.** 사이클 1은 CLI 검증이므로 로컬로 충분하며, 사이클 2 배포 직전에 결정하면 됩니다.

**Q4. 원본 영상 보관 정책.** Supabase Storage 무료 1GB, 영상 최대 500MB.
① 리포트 생성 후 즉시 삭제(플레이어 오버레이 기능 상실) ② N일 보관 후 삭제 ③ 무제한(유료 플랜)
→ **권장 ② N=30.** 리포트는 영구 보관, 영상만 만료. 사이클 3에서 만료 배치 구현.

**Q6. `sync_score`/`activity_score` 컬럼명.**
→ **본 설계는 `sync_index`/`activity_index` 로 개명 전제.** `_score` 접미사가 절대 원칙 1과 충돌하는 인상을 주기 때문입니다. 스펙 그대로 유지를 원하시면 컬럼명만 치환하고 COMMENT 로 "점수 아님"을 명시하겠습니다.

---

## 11. Next Steps

1. [x] Q1/Q3/Q5/Q7 확정
2. [ ] **[docs/rubric.md](../../rubric.md) v0.1-draft 승인** ← 남은 블로커
3. [ ] Q2/Q4/Q6 확정 (사이클 1 착수 후에도 가능)
4. [ ] Design 문서 리뷰 → [ai-judge.design.md](../../02-design/features/ai-judge.design.md)
5. [ ] 승인 → **Do 단계 사이클 1 / 세션 S1** 착수

---

## Version History

| 버전 | 날짜 | 변경 | 작성 |
|------|------|------|------|
| 0.1 | 2026-07-28 | 최초 초안 | Claude (bkit PDCA) |
