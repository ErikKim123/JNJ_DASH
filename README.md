# JNJ Dash App

댄스 컴페티션 채점 표출 앱 — Google Sheet 데이터를 라운드/스텝별 디자인 화면으로 대형 모니터에 표출.

## 🎯 한 줄 요약

운영자가 Google Sheet에 정리한 대회 정보(예선/본선/결승 페어링·통과자·결승 결과)를 한 클릭으로 라운드/스텝 화면을 전환하며 대형 모니터에 자동 표출.

## 🏗️ 기술 스택

- **프레임워크**: Next.js 15 (App Router) + React 19
- **언어**: TypeScript 5.3 strict
- **스타일**: Tailwind CSS 3
- **데이터 소스**: Google Sheets API v4 (API Key)
- **캐시**: 서버 메모리 LRU (TTL 5초)
- **배포**: Vercel

---

## 🚀 빠른 시작 (로컬)

```bash
# 1. 의존성 설치
npm install

# 2. 환경변수 설정
cp .env.local.example .env.local
# .env.local 을 열어 GOOGLE_SHEETS_API_KEY 등 채우기

# 3. 개발 서버
npm run dev
# → http://localhost:3000
```

### 환경변수

| 키 | 필수 | 설명 |
|----|:---:|------|
| `GOOGLE_SHEETS_API_KEY` | ✅ | Google Cloud에서 발급한 Sheets API Key (서버 전용) |
| `CONTEST_LIST_SHEET_ID` | ✅ | 대회목록 시트 스프레드시트 ID |
| `CONTEST_LIST_SHEET_TAB` | | 대회목록 탭 이름 (기본: `대회정보`) |
| `SHEETS_CACHE_TTL_SECONDS` | | 캐시 TTL 초 (기본: `5`) |

### Google Sheets API Key 발급

1. https://console.cloud.google.com 접속 → 프로젝트 생성
2. APIs & Services → Library → "Google Sheets API" 활성화
3. APIs & Services → Credentials → Create Credentials → API Key
4. 발급된 키를 `.env.local`의 `GOOGLE_SHEETS_API_KEY`에 입력
5. 모든 시트(대회목록 + 대회별 원본시트)를 "링크가 있는 모든 사용자: 보기"로 공유

---

## 🚢 Vercel 배포

```bash
# 처음 한 번
npx vercel link
npx vercel env add GOOGLE_SHEETS_API_KEY production
npx vercel env add CONTEST_LIST_SHEET_ID production
npx vercel env add CONTEST_LIST_SHEET_TAB production    # 선택
npx vercel env add SHEETS_CACHE_TTL_SECONDS production  # 선택

# 배포
npx vercel --prod
```

또는 GitHub 연결 시:
1. Vercel 대시보드 → New Project → Import Git Repository
2. Environment Variables에 위 키들 추가 (Production · Preview 모두)
3. Deploy

`vercel.json`은 이미 한국 리전(`icn1`) + API 캐시 헤더가 설정되어 있습니다.

---

## 🖥️ 운영 가이드

### 시트 구조 (운영팀)

#### 대회목록 시트 (`CONTEST_LIST_SHEET_ID`의 `대회정보` 탭)

| A: contestId | B: contestName | C: spreadsheetId | D: designTemplateNumber | E: startDate | F: endDate | G: status |
|---|---|---|---|---|---|---|
| 001 | 13TH JEJU LATIN... | 1gzX4kid... | 1 | 2026-06-18 | 2026-06-22 | ready |

- **C열의 spreadsheetId** 가 가장 중요. 대회별 원본시트의 ID를 정확히 복사
- **D열 디자인 템플릿 번호** 비어있으면 자동으로 1번 폴백 (HOME에 ⚠ 뱃지 표시)

#### 대회별 원본시트 탭 이름 (각 대회 공통)

| 탭 이름 | 사용처 |
|---------|--------|
| `대회정보` | 행사명, 태그라인 (key/value 형식) |
| `예선랜덤` | 예선 Pairing |
| `예선통과` | 예선 Result |
| `본선랜덤` | 본선 Pairing |
| `본선통과` | 본선 Result |
| `결승` | 결승 Result |

각 시트의 컬럼 구조: `pair번호 | leader번호 | leader명 | follower번호 | follower명` (헤더 1행 포함)

### 현장 운영 흐름

1. **HOME** (`/`)에서 진행할 대회 카드 클릭
2. 대시보드 진입 → 화면 우측 상단 **"⤢ DISPLAY"** 클릭하면 SVG만 풀화면으로 전환 (ESC로 해제)
3. 운영자 노트북에서 라운드(예선/본선/결승) 클릭
4. 스텝 버튼(`PREP → PAIRING → OPEN → LIVE → CALC TOTAL → CLOSE → RESULT`) 순서대로 클릭
5. **LIVE 단계**에서는 시트 변경이 자동으로 화면에 반영 (5~10초 내)
6. 결승은 **3스텝**(PREP / CALC TOTAL / RESULT)만 노출 — 결승 페어링은 운영자 수동 매칭

### 다중 해상도

| 환경 | 해상도 | fit 모드 |
|------|--------|---------|
| 운영자 노트북 | 1366~1920 | `fit=width` (기본) — 네비 보임 |
| 대형 모니터 | Full HD 1920×1080 | DISPLAY 풀스크린 → 화면에 정확히 fit |
| 대형 디스플레이 | 4K 3840×2160 | DISPLAY 풀스크린 → 동일 비율 fit (16:9) |

SVG `viewBox 1280×720`은 16:9 → Full HD/4K와 비율 동일이라 왜곡 없이 자동 스케일.

---

## 📁 디렉토리

```
app/                                     Next.js App Router
├── page.tsx                             HOME (대회 선택)
├── dashboard/[contestId]/
│   ├── page.tsx                         대시보드 진입점 (Server Component)
│   ├── error.tsx                        에러 경계
│   └── not-found.tsx                    404
├── api/contests/
│   ├── route.ts                         GET /api/contests
│   └── [contestId]/
│       ├── meta/route.ts                GET /api/contests/:id/meta
│       └── round/[round]/step/[step]/route.ts
└── error.tsx, not-found.tsx             루트 경계

components/
├── home/                                ContestList, ContestCard
├── dashboard/                           DashboardShell, RoundNav, StepNav,
│                                        LiveIndicator, FullscreenToggle, EmptyState
├── templates/TemplateRenderer.tsx       SVG 렌더 (dangerouslySetInnerHTML)
└── ui/ScalingFrame.tsx                  16:9 컨테이너

lib/
├── sheets/                              Google Sheets 어댑터
│   ├── types.ts                         도메인 타입
│   ├── schema.ts                        시트 컬럼 정의 (단일 진실 원천)
│   ├── client.ts                        Sheets API + LRU 캐시
│   └── adapter.ts                       시트 행 → StepData
├── templates/                           디자인 템플릿
│   ├── types.ts, placeholder.ts, registry.ts
│   └── 01/                              Template 01 (Jeju Bachata Art Deco)
│       ├── index.ts
│       └── svg/                         SVG 생성기 (HTML 포팅)
└── api/
    ├── envelope.ts                      { data, error } 응답 봉투
    └── client.ts                        클라이언트 측 API 호출 헬퍼

hooks/useSheetPoll.ts                    Live 스텝 5~10초 폴링

config/env.ts                            zod로 환경변수 검증

docs/                                    PDCA 문서 (Plan/Design/Analysis/Report)

DashDisignTemplates/                     디자이너 원본 HTML (.vercelignore)
```

---

## 🧪 검증 명령

```bash
npm run typecheck       # TypeScript 타입 검사
npm run lint            # ESLint
npm run build           # 프로덕션 빌드 + 정적 페이지 생성
npm run dev             # 개발 서버 (HMR)
```

---

## 🛠️ 운영 트러블슈팅

| 증상 | 원인 추정 | 조치 |
|------|----------|------|
| HOME에 "대회 목록을 불러오지 못했습니다" | `GOOGLE_SHEETS_API_KEY` 누락/오타 | `.env.local` 확인, Vercel 환경변수 확인 |
| HOME에 "등록된 대회가 없습니다" | 대회목록 시트 첫 행 외 빈 상태 | 시트에 행 추가 후 새로고침 |
| 카드에 ⚠ TPL · 1 (default) | D열 디자인 템플릿 번호 미입력 | D열에 정수(1) 입력 |
| 화면에 빈 텍스트 (페어 표시 안 됨) | 시트 컬럼 위치가 `lib/sheets/schema.ts`와 다름 | `schema.ts`의 컬럼 인덱스 수정 |
| Live에서 시트 변경이 반영 안 됨 | 캐시 TTL | 최대 `SHEETS_CACHE_TTL_SECONDS + 폴링주기` 대기 (기본 약 11초) |
| 4K 모니터에서 글씨 작음 | 풀스크린 미사용 | "⤢ DISPLAY" 버튼 클릭 |

---

## 📚 PDCA 문서

- Plan: [docs/01-plan/features/jnj-dash-app.plan.md](docs/01-plan/features/jnj-dash-app.plan.md)
- Design: [docs/02-design/features/jnj-dash-app.design.md](docs/02-design/features/jnj-dash-app.design.md)
- Analysis: `/pdca analyze jnj-dash-app` 후 생성
- Report: `/pdca report jnj-dash-app` 후 생성

## ⚠️ 알려진 제약 (다음 개선 후보)

- **시트 컬럼 위치 추정값**: `lib/sheets/schema.ts`의 `DEFAULT_PAIRING_COLUMNS` / `DEFAULT_RESULT_COLUMNS`는 추정 기반. 실제 시트 컬럼이 다르면 한 곳만 수정.
- **인증 없음**: URL을 아는 누구나 접근 가능. 운영자 외 노출 금지.
- **추가 디자인 템플릿(02번 이상)**: `lib/templates/02/`를 만들고 `lib/templates/registry.ts`에 등록.
- **Sheet API 쿼터**: 분당 60 read/사용자. 폴링 5초 + 캐시 5초 → 분당 12 read/페이지로 충분.
