---
feature: jnj-dash-app
phase: design
created: 2026-05-06
level: Dynamic
plan: docs/01-plan/features/jnj-dash-app.plan.md
architecture: Option C — Pragmatic Balance
---

# 🏗️ Design: JNJ Dash App

## Context Anchor

| Anchor | Value |
|--------|-------|
| **WHY** | 댄스 컴페티션의 수작업 운영 한계를 시트-드리븐 자동 표출로 해소 |
| **WHO** | 운영자(스텝 전환) / 관객·심사위원·참가자(시청) |
| **RISK** | Sheet API 쿼터, 시트 구조 변경, 디자인 템플릿 폴백 부재 |
| **SUCCESS** | 1-클릭 화면 전환 + 시트 변경 10초 내 반영 + 1번 템플릿 완벽 동작 |
| **SCOPE** | IN: 표출/네비/템플릿 적용 / OUT: 채점·시트편집·인증·다국어 |

---

## 1. Overview

본 문서는 Plan에서 확정한 요구사항을 **Option C(실용 균형)** 아키텍처로 구현하기 위한 상세 설계서이다.

### 1.1 Plan 대비 변경 사항 (디자인 템플릿 분석으로 발견)
| 항목 | Plan 기재 | 실제 (템플릿 기준) | 처리 |
|------|----------|-------------------|------|
| 스텝 명 "Calculate Total" | 그대로 사용 | `wrapup` 으로 통일 | UI 라벨은 한글 "집계 중", 키는 `wrapup` |
| 결승 스텝 수 | 7개 (다른 라운드와 동일) | **3개** (prep / wrapup / result) | 결승은 3스텝만 노출 |
| 결승 Pairing | "수동 매칭 안내 화면" | **스텝 자체 미존재** | 결승 라운드 진입 시 Pairing 메뉴 비활성 |

### 1.2 핵심 컨셉
- **단일 페이지 + 라우트 파라미터**: `/dashboard/[contestId]` 하나로 라운드/스텝 전환은 검색 파라미터 또는 segment로 처리
- **템플릿 시스템**: 디자인 템플릿 번호(1, 2, …) → `lib/templates/{NN}/` 디렉토리. 각 템플릿은 동일한 인터페이스 구현
- **데이터 어댑터 레이어**: Google Sheet 행렬 → 라운드/스텝별 표준 데이터 객체로 변환
- **서버 라우트 캐시**: Sheet API 쿼터 보호, TTL 5초

---

## 2. Architecture

### 2.1 전체 구성도

```
┌───────────────────────────────────────────────────────────────┐
│                    Browser (Client)                           │
│ ┌─────────────────────────────────────────────────────────┐   │
│ │ /                  HOME (대회 선택 카드)                   │   │
│ │ /dashboard/[id]    Dashboard (라운드 + 스텝 + 표출)         │   │
│ │   - useSheetPoll   Live 단계 5~10초 폴링                  │   │
│ │   - <TemplateRenderer template={N} round step data />   │   │
│ └─────────────────────────────────────────────────────────┘   │
│                            │                                  │
│              fetch /api/* (서버 라우트만 호출)                    │
│                            ▼                                  │
└───────────────────────────────────────────────────────────────┘
┌───────────────────────────────────────────────────────────────┐
│                  Server (Next.js Route Handlers)              │
│ ┌─────────────────────────────────────────────────────────┐   │
│ │ /api/contests                대회 목록 (1.대회정보 시트)     │   │
│ │ /api/contests/[id]/meta       대회 메타 (디자인 번호 포함)    │   │
│ │ /api/contests/[id]/round/[round]/step/[step]   스텝별 데이터 │   │
│ └─────────────────────────────────────────────────────────┘   │
│                            │                                  │
│   lib/sheets/client.ts (Google Sheets API + 메모리 캐시)        │
│   lib/sheets/adapter.ts (시트 행 → 도메인 데이터)                │
│   lib/templates/{NN}/* (SVG + 데이터 인터페이스)                  │
│                            │                                  │
└────────────────────────────┼─────────────────────────────────-┘
                             ▼
              Google Sheets API v4 (API Key)
```

### 2.2 데이터 흐름 (예: 예선 Pairing 표출)
1. 운영자가 `/dashboard/abc123?round=prelim&step=pairing` 진입
2. 클라이언트가 `/api/contests/abc123/round/prelim/step/pairing` 호출
3. 서버가 메모리 캐시 확인 → miss → Google Sheets `3.1예선랜덤시트` 조회
4. `lib/sheets/adapter.ts#toPairingData()`가 시트 행을 `{leader_1, follower_1, ...}` placeholder 데이터로 변환
5. 응답을 캐시(TTL 5초)에 저장 후 반환
6. 클라이언트의 `<TemplateRenderer>`가 SVG 문자열을 받아 placeholder 치환 후 렌더

### 2.3 Option C 구체 적용 — 템플릿 렌더링
```ts
// lib/templates/01/index.ts
export const Template01 = {
  meta: { id: 1, name: 'Jeju Bachata Art Deco' },
  rounds: {
    prelim: {
      label: '예선',
      steps: ['prep', 'pairing', 'open', 'live', 'wrapup', 'close', 'result'],
    },
    semi:  { label: '본선', steps: ['prep', 'pairing', 'open', 'live', 'wrapup', 'close', 'result'] },
    final: { label: '결승', steps: ['prep', 'wrapup', 'result'] },
  },
  // 각 (round, step) 조합에 대한 SVG 생성기
  svg: {
    'prelim.prep': prepSvg,           // (data: PrepData) => string
    'prelim.pairing': pairingSvg20,    // (data: PairingData) => string
    // ...
  },
} satisfies TemplateModule;

// components/TemplateRenderer.tsx
export function TemplateRenderer({ templateId, round, step, data }) {
  const tpl = TEMPLATES[templateId];          // {1: Template01, 2: Template02, ...}
  const generator = tpl.svg[`${round}.${step}`];
  const svg = applyPlaceholders(generator(data), data);
  return <div className="w-full" dangerouslySetInnerHTML={{__html: svg}} />;
}
```

`applyPlaceholders`는 단순 정규식 치환 (`{{key}}` → `data[key]`).

---

## 3. Data Model

### 3.1 시트 스키마 (운영팀 정의 가정)

#### 3.1.1 대회목록시트 (`1.대회정보`)
| 컬럼 | 타입 | 예시 | 설명 |
|------|------|------|------|
| A: contestId | string | `001` | 대회 식별자 (URL 파라미터) |
| B: contestName | string | `13TH JEJU LATIN CULTURE FESTIVAL` |  |
| C: spreadsheetId | string | `1gzX4kidjg4J6Qj5g1ANX9ibdeGaK_KkLTgU6xoQVn80` | 대회 원본 시트 ID |
| D: designTemplateNumber | number | `1` | 적용할 디자인 템플릿 번호 |
| E: startDate | string | `2026-06-18` |  |
| F: endDate | string | `2026-06-22` |  |
| G: status | enum | `ready / live / done` | (선택) HOME 표시용 |

> **OQ1 결정**: `spreadsheetId`는 **대회목록시트의 C열**에 보관 (단일 진실 원천 일원화).

#### 3.1.2 대회별 원본시트 탭 (각 대회 공통)
| 탭 키 | 탭 이름 (예) | 사용처 |
|-------|------------|--------|
| `contestInfo` | `1.대회정보` | 대회 메타(헤더, 태그라인 등) |
| `prelimPairing` | `3.1예선랜덤` | 예선 Pairing |
| `prelimResult`  | `4.예선통과` | 예선 Result |
| `semiPairing`   | `4.1본선랜덤` | 본선 Pairing |
| `semiResult`    | `5.본선통과` | 본선 Result |
| `finalResult`   | `6.결승` | 결승 Result |

각 탭의 컬럼 스키마(예: 예선 Pairing 시트 = pair번호, leader번호, leader명, follower번호, follower명)는 **`lib/sheets/schema.ts`** 에 정의하고, 변경 시 한 곳만 수정.

### 3.2 도메인 타입 (스텝별 데이터 인터페이스)
```ts
// lib/templates/types.ts
export interface PrepData {
  festival_header: string;
  stage_label: string;       // "PRELIMINARY ROUND"
  round_title: string;        // "PREPARING"
  round_subtitle: string;
  participants: string;       // "20 LEADERS · 20 FOLLOWERS"
  tagline: string;
}

export interface PairingData {
  festival_header: string;
  round_title: string;
  stage_label: string;
  label_leader: string;
  label_follower: string;
  pairs: Array<{ idx: number; leader: string; leaderNum: string; follower: string; followerNum: string }>;
  tagline: string;
}
// pairs는 SVG 치환 시 leader_1, leader_num_1, follower_1, ... 로 평탄화

export interface ResultData {
  festival_header: string;
  result_title: string;
  result_subtitle: string;
  leaders: Array<{ idx: number; name: string; num: string }>;
  followers: Array<{ idx: number; name: string; num: string }>;
  tagline: string;
}
// 동일하게 result_leader_1, result_leader_num_1, ... 로 평탄화

export interface OpenData    { festival_header: string; round_title: string; open_quote: string; open_subline: string; tagline: string; }
export interface LiveData    { festival_header: string; stage_label: string; round_title: string; live_message: string; tagline: string; }
export interface WrapupData  { festival_header: string; stage_label: string; wrap_title: string; wrap_subtitle: string; wrap_message: string; tagline: string; }
export interface CloseData   { festival_header: string; stage_label: string; close_title: string; close_subtitle: string; close_message: string; tagline: string; }

export type StepData =
  | { kind: 'prep'; data: PrepData }
  | { kind: 'pairing'; data: PairingData }
  | { kind: 'open'; data: OpenData }
  | { kind: 'live'; data: LiveData }
  | { kind: 'wrapup'; data: WrapupData }
  | { kind: 'close'; data: CloseData }
  | { kind: 'result'; data: ResultData };
```

---

## 4. API Design

모든 API 응답은 `{ data, error }` 봉투(envelope) 형식.

### 4.1 `GET /api/contests`
**응답**:
```json
{
  "data": [
    { "contestId": "001", "name": "13TH JEJU ...", "designTemplateNumber": 1,
      "startDate": "2026-06-18", "endDate": "2026-06-22", "status": "ready" }
  ],
  "error": null
}
```
**에러**: 502 (Sheets API 실패), 500 (예외)

### 4.2 `GET /api/contests/[contestId]/meta`
**응답**:
```json
{
  "data": {
    "contestId": "001", "name": "...", "designTemplateNumber": 1,
    "rounds": {
      "prelim": { "label": "예선", "steps": ["prep","pairing","open","live","wrapup","close","result"] },
      "semi":   { "label": "본선", "steps": [...] },
      "final":  { "label": "결승", "steps": ["prep","wrapup","result"] }
    },
    "tagline": "...", "festivalHeader": "..."
  },
  "error": null
}
```

### 4.3 `GET /api/contests/[contestId]/round/[round]/step/[step]`
**파라미터**:
- `round` ∈ `prelim | semi | final`
- `step` ∈ `prep | pairing | open | live | wrapup | close | result`
- 잘못된 조합(예: `final/pairing`)은 **404** + `{ data:null, error:"step not available for this round" }`

**응답**:
```json
{
  "data": {
    "kind": "pairing",
    "data": { "festival_header":"...", "pairs":[...], "tagline":"..." }
  },
  "error": null,
  "cachedAt": "2026-05-06T10:30:05.000Z",
  "ttlSeconds": 5
}
```

### 4.4 캐시 전략
- 메모리 LRU (`lru-cache`) — 키 `${contestId}:${round}:${step}`
- TTL: 5초 (Live 갱신 주기 < TTL이면 폴링이 실제로는 5초마다만 시트 호출)
- `live` 스텝은 항상 캐시 사용. 다른 스텝도 동일 (시트 변경 시 5초 내 반영 OK)
- 서버 단일 인스턴스 가정 (Vercel serverless는 인스턴스 재사용 시에만 효과 — 충분)

### 4.5 에러 처리
| 상태 | 시나리오 | 응답 |
|------|----------|------|
| 200 | 정상 | `{ data, error: null }` |
| 400 | 잘못된 round/step | `{ data: null, error: "invalid step" }` |
| 404 | 대회 없음 / 결승 Pairing | `{ data: null, error: "..." }` |
| 502 | Sheets API 실패 | `{ data: null, error: "sheets api failed" }` |
| 500 | 그 외 | `{ data: null, error: "internal error" }` |

---

## 5. Component Tree

```
app/
├── layout.tsx                       (전역 폰트, 다크 배경)
├── page.tsx                          → <HomePage />
├── dashboard/
│   └── [contestId]/
│       └── page.tsx                  → <DashboardPage contestId />
└── api/
    ├── contests/
    │   ├── route.ts                  GET /api/contests
    │   └── [contestId]/
    │       ├── meta/route.ts         GET /api/contests/:id/meta
    │       └── round/[round]/step/[step]/route.ts

components/
├── home/
│   ├── ContestCard.tsx               대회 카드
│   └── ContestList.tsx
├── dashboard/
│   ├── DashboardShell.tsx            상단 네비 + 중앙 슬롯 레이아웃
│   ├── RoundNav.tsx                   (3 라운드 버튼)
│   ├── StepNav.tsx                    (라운드별 스텝 버튼, 결승은 3개만)
│   ├── LiveIndicator.tsx              "마지막 갱신 N초 전"
│   └── EmptyState.tsx                 데이터 없음 / 결승 Pairing 안내 등
├── templates/
│   ├── TemplateRenderer.tsx           templateId/round/step → SVG 렌더
│   └── ContestThemeProvider.tsx       (festival_header, tagline 등 메타 컨텍스트)
└── ui/
    ├── ScalingFrame.tsx                viewBox 1280×720 SVG → 컨테이너에 맞춰 스케일

hooks/
├── useSheetPoll.ts                    Live 스텝일 때만 5초 폴링
└── useDashboardState.ts                round/step 라우터 동기화

lib/
├── sheets/
│   ├── client.ts                       Sheets API 호출 + 캐시
│   ├── schema.ts                       각 탭의 컬럼 정의
│   └── adapter.ts                       시트 행 → StepData
├── templates/
│   ├── types.ts                         StepData, TemplateModule 타입
│   ├── registry.ts                      {1: Template01, ...}
│   ├── placeholder.ts                  applyPlaceholders(svg, data)
│   └── 01/
│       ├── index.ts                     Template01 export
│       └── svg/
│           ├── common.ts                COMMON_DEFS, BG, FRAME, helpers
│           ├── prep.ts                  prepSvg(data)
│           ├── pairing.ts               pairingSvg20/10/5(data)
│           ├── open.ts
│           ├── live.ts
│           ├── wrapup.ts
│           ├── close.ts
│           ├── result.ts                resultListSvg(count, data)
│           ├── final.ts                 finalPrep/finalWrapup/finalResult/finalPairing(미사용)
│           └── index.ts                 매핑 테이블

config/
└── env.ts                              환경변수 검증 (zod)
```

---

## 6. State Management

- **글로벌 상태 라이브러리 도입 안 함** — Next.js App Router의 search params + Server Component 캐시로 충분
- 클라이언트 컴포넌트 상태:
  - `round`, `step`: URL 검색 파라미터(`?round=prelim&step=pairing`)와 동기화 (`useSearchParams` + `router.replace`)
  - 폴링 데이터: `useSheetPoll` 훅 내부 `useState`
- 서버 캐시: 메모리 LRU (서버 사이드 단독)

### 6.1 라우팅 결정
- 라운드/스텝을 **search params**로 표현 (segment 아님). 이유:
  - 새로고침 시 깊은 segment보다 단순
  - 빈 round/step은 기본값(`prelim/prep`)으로 폴백 쉬움

---

## 7. Routing & Navigation

### 7.1 라우트 트리
| 경로 | 컴포넌트 | 설명 |
|------|----------|------|
| `/` | `HomePage` | 대회 카드 목록 |
| `/dashboard/[contestId]` | `DashboardPage` | 라운드/스텝 표출 (search params로 제어) |
| `/dashboard/[contestId]?round=prelim&step=pairing` | 동일 | 예선 Pairing 표출 |
| `/dashboard/[contestId]?round=final&step=pairing` | 동일 | **404 처리** (또는 사용자에게 "결승은 Pairing 단계가 없습니다" empty state) |

### 7.2 네비게이션 규칙
- 라운드 변경 → 해당 라운드의 첫 스텝(`prep`)으로 자동 이동
- 결승 진입 시 StepNav는 `prep / wrapup / result` 3개만 노출
- 단축키(나중에 검토): `1/2/3` = 라운드 전환, 좌우 화살표 = 스텝 전환 (OQ에 등재)

---

## 8. Test Plan (Design Anchor for Check Phase)

### 8.1 L1 — API 엔드포인트 (서버 단위)
| 테스트 | 입력 | 기대 |
|--------|------|------|
| L1.1 contests 목록 | `GET /api/contests` | 200, `data` 배열, 각 항목에 contestId/designTemplateNumber 존재 |
| L1.2 메타 정상 | `GET /api/contests/001/meta` | 200, `rounds.final.steps == ['prep','wrapup','result']` |
| L1.3 메타 없음 | `GET /api/contests/zzz/meta` | 404, `error == "contest not found"` |
| L1.4 예선 Pairing | `GET /.../prelim/step/pairing` | 200, `data.kind == 'pairing'`, `data.data.pairs.length` > 0 |
| L1.5 결승 Pairing 차단 | `GET /.../final/step/pairing` | 404 |
| L1.6 잘못된 step | `GET /.../prelim/step/foo` | 400 |
| L1.7 캐시 | 동일 요청 2회 (1초 간격) | 두 번째 응답 헤더 또는 `cachedAt` 동일 |

### 8.2 L2 — UI 액션 (Playwright)
| 테스트 | 시나리오 |
|--------|---------|
| L2.1 HOME → Dashboard | HOME에서 대회 카드 클릭 → `/dashboard/001`로 이동, RoundNav 3개 표시 |
| L2.2 라운드 전환 | 본선 클릭 → `?round=semi&step=prep` 변경, 디자인 화면 변경 확인 |
| L2.3 스텝 전환 | 예선에서 Pairing 클릭 → 페어링 SVG 안의 텍스트 표시 |
| L2.4 결승 StepNav | 결승 클릭 → StepNav에 prep/wrapup/result만 노출 |
| L2.5 Live 인디케이터 | Live 스텝 진입 → "마지막 갱신 N초 전" 표시 |

### 8.3 L3 — E2E 시나리오
| 테스트 | 시나리오 |
|--------|---------|
| L3.1 풀 플로우 | HOME → 대회 선택 → 예선 7스텝 순회 → 본선 7스텝 순회 → 결승 3스텝 순회 → 화면 깨짐/콘솔 에러 0건 |
| L3.2 Live 갱신 | 시트 한 행 수정 → 5~10초 대기 → 화면에 변경 반영 |
| L3.3 다중 해상도 | 1920×1080, 3840×2160, 1366×768 viewport로 각각 1회 → 레이아웃 깨짐 0건 |

### 8.4 L4 — 성능 (선택)
- Lighthouse FCP < 2초 (Vercel 프로덕션)
- Sheet API 응답 평균 < 1.5초
- 동시 요청 10건 시 캐시 히트율 ≥ 80%

### 8.5 L5 — 보안 (선택)
- API Key가 클라이언트 번들에 포함되지 않음 (`grep API_KEY .next/static/**`)
- `/api/*` 응답에 시트 ID 노출 없음

---

## 9. Performance & Caching

- 서버 메모리 LRU 캐시 (`lru-cache`, max=200, ttl=5초)
- 클라이언트: Live 스텝일 때만 폴링, 다른 스텝은 1회 fetch 후 정적
- SVG는 문자열 → `dangerouslySetInnerHTML` (React 재렌더 비용 최소화)
- `revalidate: 5` — Next.js fetch 캐시도 동일 TTL로 통일

---

## 10. Security

- Google API Key는 **서버 환경변수** `GOOGLE_SHEETS_API_KEY` (Vercel 환경변수, `process.env.*`)
- `lib/sheets/client.ts`만 키 접근. 클라이언트는 절대 직접 호출 금지
- API 응답에서 `spreadsheetId`는 **노출하지 않음** (서버 내부 매핑만 사용)
- 미들웨어 슬롯(`middleware.ts`)을 빈 통과 함수로 두되, 추후 비밀번호 게이트 추가 여지 확보 (Plan R7)
- 로깅: `console.error`만 사용, 스택트레이스 외부 노출 금지

---

## 11. Implementation Guide

### 11.1 구현 순서

| # | 모듈 | 산출물 | 비고 |
|---|------|--------|------|
| 1 | 프로젝트 부트스트랩 | `package.json`, `tsconfig.json`, `next.config.ts`, Tailwind 설정 | Next.js 15 + TS strict |
| 2 | env / config | `config/env.ts` (zod 스키마), `.env.local.example` | `GOOGLE_SHEETS_API_KEY`, `CONTEST_LIST_SHEET_ID` |
| 3 | Sheets 클라이언트 | `lib/sheets/client.ts` + LRU 캐시 | API Key 호출, 캐시 |
| 4 | Sheets 어댑터 | `lib/sheets/schema.ts`, `lib/sheets/adapter.ts` | 행 → StepData 변환 |
| 5 | 템플릿 코어 | `lib/templates/types.ts`, `lib/templates/placeholder.ts`, `lib/templates/registry.ts` | placeholder 치환 유틸 |
| 6 | 템플릿 01 SVG 포팅 | `lib/templates/01/svg/*.ts` (8 파일) | HTML의 SVG 함수 → TS 모듈 |
| 7 | 템플릿 01 매핑 | `lib/templates/01/index.ts` | round.step → svg generator |
| 8 | API 라우트 | `app/api/contests/**/route.ts` (3개 라우트) | 4.x 명세 그대로 |
| 9 | UI: TemplateRenderer | `components/templates/TemplateRenderer.tsx`, `ScalingFrame.tsx` | viewBox → 반응형 |
| 10 | UI: HOME | `app/page.tsx`, `components/home/*` | 대회 카드 |
| 11 | UI: Dashboard 셸 | `app/dashboard/[contestId]/page.tsx`, `components/dashboard/DashboardShell.tsx`, `RoundNav.tsx`, `StepNav.tsx` | search params 동기화 |
| 12 | UI: 폴링 + 인디케이터 | `hooks/useSheetPoll.ts`, `components/dashboard/LiveIndicator.tsx` | Live 스텝만 폴링 |
| 13 | 다중 해상도 보정 | `ScalingFrame` clamp 보강, 4K 검증 | 수동 확인 |
| 14 | Vercel 배포 | `vercel.json`(필요 시), env 등록, README | 프로덕션 URL |

### 11.2 Page UI Checklist

#### HOME (`/`)
- [ ] 헤더: "JNJ Dash" 타이틀
- [ ] 대회 카드: 대회명, 일정(start~end), 디자인 템플릿 번호 뱃지
- [ ] 카드 클릭 시 `/dashboard/{contestId}` 이동
- [ ] designTemplateNumber 비어있으면 카드에 ⚠️ 경고 뱃지 + 기본 템플릿 1로 폴백 가정 안내

#### Dashboard (`/dashboard/[contestId]`)
- [ ] 상단 RoundNav: 예선/본선/결승 3개 버튼 (active 상태 표시)
- [ ] 라운드 아래 StepNav: 라운드별 스텝 노출 (결승은 3개)
- [ ] 중앙 영역: 현재 round.step의 SVG 렌더 (viewBox 1280×720, 컨테이너 폭에 비례 스케일)
- [ ] 우측 상단: Live 스텝일 때만 LiveIndicator ("마지막 갱신 N초 전" + 로딩 스피너)
- [ ] 결승 Pairing 우회 진입 시 EmptyState ("결승은 수동 매칭 단계입니다")
- [ ] 데이터 비어있을 때(예: 본선 통과자 0명) EmptyState ("아직 결과가 없습니다")
- [ ] 키보드 단축키 (Stretch goal, OQ-S1)

### 11.3 Session Guide

> 다중 세션 분할 구현을 위한 Module Map. `/pdca do jnj-dash-app --scope module-N` 으로 세션별 진행 가능.

#### Module Map

| Scope Key | 모듈 | 포함 산출물 (구현 순서 #) | 의존성 | 예상 LoC |
|-----------|------|------------------------|--------|---------|
| `module-1` | **부트스트랩 + 환경** | 1, 2 | - | ~150 |
| `module-2` | **Sheets 인프라** | 3, 4 | module-1 | ~350 |
| `module-3` | **템플릿 코어** | 5 | module-1 | ~120 |
| `module-4` | **템플릿 01 포팅** | 6, 7 | module-3 | ~900 (HTML 1774줄 중 SVG 부분 포팅) |
| `module-5` | **API 라우트** | 8 | module-2, module-3 | ~250 |
| `module-6` | **UI 셸 + HOME** | 9, 10 | module-5 | ~250 |
| `module-7` | **Dashboard + 네비** | 11 | module-6 | ~350 |
| `module-8` | **폴링 + 인디케이터** | 12 | module-7 | ~120 |
| `module-9` | **반응형 보정 + 배포** | 13, 14 | module-8 | ~80 + 배포 작업 |

#### Recommended Session Plan

1인 작업 기준 5세션 권장 분할:

| 세션 | 다룰 모듈 | 목표 | 예상 시간 |
|------|----------|------|----------|
| **S1** | module-1, module-2 | 시트 데이터를 서버에서 읽고 콘솔에 출력 가능 | 1~1.5일 |
| **S2** | module-3, module-4 | TemplateRenderer로 1번 템플릿 1개 스텝 렌더링 검증 | 1.5~2일 (SVG 포팅이 가장 비중 큼) |
| **S3** | module-5, module-6 | HOME에서 대회 선택 후 Dashboard 빈 셸 진입 | 1일 |
| **S4** | module-7, module-8 | 라운드/스텝 전환 + Live 폴링 정상 동작 | 1일 |
| **S5** | module-9 | 다중 해상도 검증, Vercel 배포, 운영 가이드 | 0.5~1일 |

#### 세션별 진입 명령
```
/pdca do jnj-dash-app --scope module-1,module-2     # S1
/pdca do jnj-dash-app --scope module-3,module-4     # S2
/pdca do jnj-dash-app --scope module-5,module-6     # S3
/pdca do jnj-dash-app --scope module-7,module-8     # S4
/pdca do jnj-dash-app --scope module-9              # S5
```

---

## 12. Decision Record (Plan→Design)

| Decision | 채택 | 이유 |
|----------|:---:|------|
| **아키텍처**: Option C — 실용 균형 | ✅ | 디자이너 SVG 코드 재활용 + 타입 안전성 + 일정 영향 최소 |
| **State**: 외부 라이브러리 미도입 (URL search params + 컴포넌트 상태) | ✅ | 글로벌 상태가 사실상 round/step뿐, 라이브러리 비용 불필요 |
| **라우팅**: search params (segment 아님) | ✅ | 빈 값 폴백 단순, 기본값 처리 쉬움 |
| **캐시**: 서버 메모리 LRU TTL 5초 | ✅ | Sheets API 쿼터 보호 + 시트 변경 10초 내 반영 (NFR 만족) |
| **폴링 주기**: 5초 (NFR-2 만족) | ✅ | TTL과 동일 → 매 폴링 = 1회 시트 호출 |
| **결승 Pairing**: 라우트 레벨 차단 (404) | ✅ | 템플릿이 정의 안 함, 메뉴에서도 제거 |
| **`spreadsheetId` 보관 위치 (OQ1)**: 대회목록시트 C열 | ✅ | 단일 진실 원천 + 대회별 분산 설정 회피 |
| **디자인 템플릿 번호 폴백 (OQ2)**: 비어있으면 1번 강제 + HOME에 ⚠️ 뱃지 | ✅ | 운영 시 끊김 없음 + 운영자에게 인지 |
| **결승 수동 매칭 UI (OQ4)**: 라운드 메뉴에 결승 진입 후 Pairing 스텝 자체 비표시 | ✅ | 입력 UI 미도입(Out of Scope) |

## 13. Open Questions (Design 후 잔여)

| ID | Question | 영향 |
|----|----------|------|
| OQ-D1 | 시트 컬럼 위치(예: 예선 Pairing의 leader 번호가 A열인가 B열인가)는 운영팀 합의 필요 — Do 시작 전 1번 대회 시트 표본 받기 | module-2 (어댑터) |
| OQ-D2 | 템플릿 01의 SVG 헬퍼 약 14개를 그대로 포팅하는데, **TS 변환 외 외부 의존성(SVG 라이브러리) 도입 안 함** 확인 | module-4 |
| OQ-D3 | 키보드 단축키(라운드 1/2/3, 좌우 스텝)는 도입할 것인가? (UX 개선, 1시간 이내 작업) | Stretch |
| OQ-D4 | 4K 디스플레이 검증을 어디서 할 것인가 (실기기 vs Chrome devtools 4K 시뮬레이션) | module-9 |

---

## 14. Next Step

다음 단계: **Do (구현)**

권장 진입:
```
/pdca do jnj-dash-app --scope module-1,module-2
```

또는 단순 진행:
```
/pdca do jnj-dash-app
```
