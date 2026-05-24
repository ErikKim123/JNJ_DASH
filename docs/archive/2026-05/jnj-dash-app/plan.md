---
feature: jnj-dash-app
phase: plan
created: 2026-05-06
level: Dynamic
owner: bandnara123@gmail.com
---

# 📋 Plan: JNJ Dash App (젝앤질 댄스 컴페티션 표출 앱)

## Executive Summary

| 관점 | 요약 |
|------|------|
| **Problem (문제)** | 댄스 컴페티션 현장에서 번호 배정·파트너 매칭·심사 집계가 수작업 처리되어 인적 오류, 운영 지연, 공정성 시비가 반복 발생한다. |
| **Solution (해결)** | Google Sheet에 정리된 대회 운영 데이터를 Next.js 기반 웹 앱이 실시간으로 읽어, 라운드별·스텝별 디자인 화면을 대형 모니터에 자동 표출한다. |
| **Function/UX Effect (기능·UX 효과)** | 운영자는 프로세스 스텝 버튼만 클릭하여 예선/본선/결승 진행 화면을 즉시 전환하고, 관객은 페어링·라이브 점수·결과를 시각적으로 일관된 디자인으로 본다. |
| **Core Value (핵심 가치)** | 운영 시간 단축 + 관객 몰입도 향상 + 시트 한 장으로 모든 표출 화면이 자동 갱신되는 단일 진실 원천(Single Source of Truth) 운영 체계. |

## Context Anchor

| Anchor | Value |
|--------|-------|
| **WHY** | 댄스 컴페티션의 수작업 운영 한계(오류·지연·공정성 시비)를 시트-드리븐 자동 표출로 해소한다. |
| **WHO** | 1차 사용자: 대회 운영자(스텝 전환 조작) / 2차 사용자: 관객·심사위원·참가자(대형 화면 시청) |
| **RISK** | Google Sheet API 쿼터 초과, 시트 구조 변경 시 화면 깨짐, 디자인 템플릿 미보유 대회의 폴백 부재 |
| **SUCCESS** | 운영자가 1번의 클릭으로 모든 라운드/스텝 화면을 전환할 수 있고, 시트 변경이 10초 이내에 화면에 반영되며, 디자인 템플릿 1번이 완벽히 동작한다. |
| **SCOPE** | IN — 시트 데이터 조회·표출, 라운드/스텝 네비게이션, 디자인 템플릿 적용 / OUT — 채점 입력, 시트 편집, 운영자 인증, 다국어 |

---

## 1. Overview

### 1.1 배경
현재 댄스 컴페티션 현장은 번호 배정/파트너 매칭/점수 집계를 종이·구두로 처리하면서 인적 오류와 시간 낭비가 누적되고 있다. 운영팀은 이미 Google Spreadsheet로 대회 데이터(참가자·랜덤 페어링·라운드 통과자·결승 결과)를 정리하고 있지만, 이를 현장 모니터에 보여줄 표출 시스템이 없다.

### 1.2 목적
**단일 사이트 1개**로 다음 두 역할을 수행한다.
1. 운영자: 라운드(예선/본선/결승) × 스텝(Prep → Pairing → Open → Live → Calculate Total → Close → Result)을 클릭으로 전환
2. 관객: 대형 모니터에서 현재 진행 단계의 디자인 화면을 시청

### 1.3 결과물
- Vercel에 배포된 Next.js 15 풀스택 웹 앱
- HOME(대회 선택) → 대시보드(라운드/스텝 표출) 2단계 구조
- Google Sheet API Key 기반 공개 시트 조회
- `DashDesignTemplates/{N}/`의 디자인 템플릿을 React 컴포넌트로 포팅

---

## 2. Goals & Success Criteria

### 2.1 Goals
| ID | Goal | Priority |
|----|------|:--------:|
| G1 | 시트 데이터를 그대로 라운드/스텝별 화면으로 표출 | P0 |
| G2 | 대회별로 다른 디자인 템플릿 자동 적용 | P0 |
| G3 | Live 단계에서 5~10초 주기로 시트 데이터 갱신 | P0 |
| G4 | 운영자가 스텝 버튼 클릭 한 번으로 화면 전환 | P0 |
| G5 | Full HD/4K 모니터 + 운영자 노트북 다중 해상도 대응 | P1 |

### 2.2 Success Criteria (검증 가능 항목)
| ID | Criterion | 검증 방법 |
|----|-----------|----------|
| SC1 | 대회목록시트에서 N개 대회를 읽어 HOME에 카드 형태로 노출 | UI 확인 + API 응답 길이 검증 |
| SC2 | 대회 카드 클릭 시 해당 대회의 "디자인 템플릿 번호"에 매칭되는 디자인이 적용된 대시보드 진입 | 1번 템플릿 진입 시 jeju_bachata 디자인 렌더링 확인 |
| SC3 | 예선 라운드의 Pairing 클릭 → `3.1예선랜덤시트` 데이터로 화면 표출 | 시트 행 수 == 화면 카드 수 |
| SC4 | 예선 Result 클릭 → `4.예선통과시트` 데이터로 결과 표출 | 동일 |
| SC5 | 본선 Pairing/Result → `4.1본선랜덤시트`/`5.본선통과시트` 데이터 표출 | 동일 |
| SC6 | 결승 Result → `6.결승시트` 데이터 표출, Pairing은 자리표시자(수동 매칭 안내) 표시 | UI 확인 |
| SC7 | Live 단계에서 시트 변경 후 10초 이내 화면 자동 갱신 | 시트 수정 → 타이머 측정 |
| SC8 | Full HD(1920×1080), 4K, 1366폭 노트북에서 레이아웃 깨짐 없음 | 3종 해상도 수동 확인 |
| SC9 | Vercel 프로덕션 배포 후 cold start 응답 3초 이내 | Lighthouse / 수동 측정 |

---

## 3. Requirements

### 3.1 Functional Requirements

#### FR-1. HOME (대회 선택)
- FR-1.1 `대회목록시트`(스프레드시트 ID `1bRclkuN8fuSfhoSrRUEtBjPPx6TePofxojE72qHV6iU`)에서 대회 목록 조회
- FR-1.2 각 대회 카드에 대회명, 일정, 디자인 템플릿 번호, 원본시트 링크 표시
- FR-1.3 대회 카드 클릭 시 `/dashboard/{대회ID}` 경로로 이동

#### FR-2. 대시보드 공통 레이아웃
- FR-2.1 상단: 라운드 메뉴(예선/본선/결승) + 라운드 내 스텝 버튼(Prep, Pairing, Open, Live, Calculate Total, Close, Result) — 작게 표시
- FR-2.2 중앙: 현재 선택된 라운드/스텝의 디자인 화면 표출
- FR-2.3 대회 진입 시 1.대회정보시트의 "디자인 템플릿 번호"를 읽어 해당 폴더의 템플릿을 React 컴포넌트로 적용
- FR-2.4 대회별 원본시트 ID는 1.대회정보시트(또는 대회목록시트)에서 매핑

#### FR-3. 라운드별 데이터 매핑
| 라운드 | 스텝 | 데이터 소스 시트 | 비고 |
|--------|------|------------------|------|
| 예선 | Pairing | `3.1예선랜덤시트` | 자동 표출 |
| 예선 | Result | `4.예선통과시트` | 자동 표출 |
| 본선 | Pairing | `4.1본선랜덤시트` | 자동 표출 |
| 본선 | Result | `5.본선통과시트` | 자동 표출 |
| 결승 | Pairing | (없음) | "수동 매칭" 자리표시 화면 |
| 결승 | Result | `6.결승시트` | 자동 표출 |
| 공통 | Prep / Open / Live / Calculate Total / Close | (스텝 디자인) | 디자인 템플릿의 해당 스텝 화면을 정적/시트 데이터 결합으로 표출 |

#### FR-4. Live 갱신
- FR-4.1 Live 스텝 진입 시 5~10초 주기 폴링으로 시트 재조회
- FR-4.2 다른 스텝 화면에서는 폴링 중단 (Sheet API 쿼터 절약)
- FR-4.3 화면 우측 상단에 "마지막 갱신 N초 전" 인디케이터

#### FR-5. 디자인 템플릿
- FR-5.1 `DashDesignTemplates/01/jeju_bachata_process_templates.html` 파일을 React 컴포넌트로 포팅
- FR-5.2 템플릿은 라운드 × 스텝 조합별 화면 슬롯을 가짐 (`<RoundStepView round="prelim" step="pairing" data={...} />`)
- FR-5.3 신규 템플릿 추가 시 `DesignTemplate{N}.tsx` 1개 파일을 만들고 라우터에 등록하면 자동 인식되도록 폴더 컨벤션 정의

### 3.2 Non-Functional Requirements

| ID | 항목 | 요구 수준 |
|----|------|----------|
| NFR-1 | 성능: 페이지 첫 표시 (FCP) | < 2초 (Vercel 프로덕션) |
| NFR-2 | 성능: Sheet API 1회 응답 | < 1.5초 (캐시 미스 기준) |
| NFR-3 | 가용성 | Vercel 기본 가용성 의존, 자체 SLA 정의 안 함 |
| NFR-4 | 보안 | 인증 없음. 단, Google Sheet API Key는 서버 환경변수에만 보관(클라이언트 노출 금지) |
| NFR-5 | 호환성: 디스플레이 | Full HD(1920×1080) / 4K / 노트북(1366~1920) — CSS clamp + viewport-relative units |
| NFR-6 | 호환성: 브라우저 | Chrome/Edge 최신 버전(현장에서 사용) |
| NFR-7 | 접근성 | 표출용이므로 WCAG AA 미강제. 단, 색 대비는 대형 모니터 시인성 기준 충족 |
| NFR-8 | 코드 품질 | TypeScript strict, ESLint, Prettier 적용 |

---

## 4. Scope

### 4.1 In Scope (포함)
- HOME(대회 선택) 페이지
- 대시보드(라운드/스텝 표출) 페이지
- Google Sheet API Key 기반 시트 조회 (서버 라우트 경유)
- 디자인 템플릿 1번(jeju_bachata) 포팅 및 적용
- Live 폴링
- Vercel 배포 설정
- 환경변수(시트 API Key, 시트 ID 매핑) 관리

### 4.2 Out of Scope (제외)
- 채점 입력/편집 UI (시트에서 처리됨)
- 시트 쓰기 작업
- 운영자 로그인/권한 관리
- 다국어(i18n)
- 모바일 전용 레이아웃 (지원은 하되 최적화 안 함)
- 결승 Pairing 자동화 (수동 매칭임을 명시)
- 디자인 템플릿 02번 이상 (추후 신규 작업 대상)
- 실시간 push (SSE/WebSocket)
- 오프라인 모드

---

## 5. Stakeholders & Users

| 역할 | 설명 | 주요 액션 |
|------|------|----------|
| **운영자(Operator)** | 대회 운영팀, 노트북에서 화면 조작 | 대회 선택, 라운드/스텝 클릭으로 화면 전환 |
| **관객(Audience)** | 현장 참여자, 대형 모니터를 시청 | 시청만 (조작 없음) |
| **심사위원(Judge)** | Google Sheet에서 직접 채점 | 본 앱은 사용 안 함(시트만 사용) |
| **참가자(Competitor)** | 본인 통과 여부, 결승 결과 확인 | 화면 시청 |
| **소유자(Owner)** | bandnara123@gmail.com | 환경변수 관리, 배포, 시트 ID 등록 |

---

## 6. Constraints & Assumptions

### 6.1 Constraints
- C1. 데이터 원천은 **Google Spreadsheet 한정** (DB 도입 없음)
- C2. 배포 대상은 **Vercel 한정** (Next.js App Router)
- C3. 시트 구조(시트 탭 이름, 컬럼 위치)는 **운영팀이 정의한 그대로** 유지되어야 함
- C4. 디자인 템플릿은 **HTML 파일을 그대로 받은 형태**로 제공됨 → React 포팅 필요
- C5. 인증 없음 → URL 노출 시 누구나 접근 가능 (현장 사용 한정 가정)

### 6.2 Assumptions
- A1. 모든 대회 시트는 동일한 탭 구조(1.대회정보 / 3.1예선랜덤 / 4.예선통과 / 4.1본선랜덤 / 5.본선통과 / 6.결승)를 따른다
- A2. 1.대회정보 시트에 "디자인 템플릿 번호" 컬럼이 정확히 존재하고 정수값을 가진다
- A3. Google Sheet API 쿼터(분당 60 read/사용자)는 폴링 주기 5~10초 내에서 충분하다
- A4. 시트는 "링크가 있는 모든 사용자"에게 보기 권한이 부여된다
- A5. 현장 네트워크는 안정적이다 (오프라인 모드 미고려)

---

## 7. Risks & Mitigations

| ID | Risk | Impact | Likelihood | Mitigation |
|----|------|:------:|:----------:|------------|
| R1 | Google Sheet API 쿼터 초과 | 중 | 중 | Live가 아닐 때 폴링 정지, 서버 메모리 캐시(TTL 5초), Sheet ID별 키 분리 |
| R2 | 시트 탭 이름·컬럼 변경으로 화면 깨짐 | 상 | 중 | 시트 스키마 어댑터 모듈 분리, 잘못된 데이터에 대한 폴백 메시지 |
| R3 | 디자인 템플릿 HTML 포팅 누락(스타일/스크립트) | 중 | 중 | Design 단계에서 1번 템플릿을 슬롯 단위로 분해해 컴포넌트화 |
| R4 | 대회마다 디자인 템플릿 번호 미입력 | 중 | 낮 | 기본 템플릿(=1번)으로 폴백 + HOME에 경고 배지 |
| R5 | 4K 모니터에서 폰트 크기 부적절 | 중 | 중 | clamp() 기반 반응형 + 4K 확인 케이스 추가 |
| R6 | API Key 클라이언트 노출 | 상 | 낮 | 시트 호출은 반드시 서버 라우트(`/api/sheets/...`) 경유, 클라이언트 키 사용 금지 |
| R7 | URL 무인증 노출로 외부인 접근 | 중 | 낮 | 운영자 가이드에 "URL 비공개" 명시, 추후 비밀번호 게이트 추가 가능하도록 미들웨어 슬롯만 마련 |
| R8 | 결승 Pairing이 자동 매핑되지 않음을 사용자가 모름 | 낮 | 중 | 결승 Pairing 화면에 "수동 매칭 단계" 명시 UI |

---

## 8. Dependencies

### 8.1 Technical Dependencies
- Next.js 15 (App Router), React 19, TypeScript 5.3
- Tailwind CSS (디자인 템플릿 포팅 용이성)
- `googleapis` 또는 직접 fetch + API Key
- Vercel 배포 환경
- Node.js 20+

### 8.2 External Dependencies
- Google Sheets API (https://sheets.googleapis.com/v4/spreadsheets)
- 대회목록시트(1bRclkuN8fuSfhoSrRUEtBjPPx6TePofxojE72qHV6iU)
- 대회별 원본시트 (001/002/003 외 추가)
- DashDesignTemplates/ 폴더의 HTML 템플릿

### 8.3 Process Dependencies
- 운영팀: 시트 권한을 "링크 보유자 보기"로 설정
- 운영팀: 1.대회정보 시트에 디자인 템플릿 번호 입력
- 디자이너: 템플릿 02 이상 HTML 추가 시 슬롯 컨벤션 따라 제공

---

## 9. Timeline / Milestones

> 1인 개발(소유자) 기준 추정. Design 단계에서 정밀 추정 갱신.

| Milestone | 기간 (예상) | 산출물 |
|-----------|:---------:|--------|
| M1. Design 문서 확정 | 0.5일 | docs/02-design/features/jnj-dash-app.design.md |
| M2. 프로젝트 초기화 (Next.js 15 + Tailwind + ESLint) | 0.5일 | `package.json`, 기본 디렉토리 |
| M3. Sheet API 어댑터 + 캐시 | 1일 | `lib/sheets/*`, `/api/sheets/*` |
| M4. HOME 페이지 (대회 선택) | 0.5일 | `app/page.tsx` |
| M5. 디자인 템플릿 1번 포팅 (슬롯 컴포넌트화) | 1.5일 | `components/templates/Template01/*` |
| M6. 대시보드 라운드/스텝 라우팅 + 데이터 바인딩 | 1.5일 | `app/dashboard/[contestId]/...` |
| M7. Live 폴링 + 갱신 인디케이터 | 0.5일 | `hooks/useSheetPoll.ts` |
| M8. 다중 해상도 검증 + 반응형 보정 | 0.5일 | CSS 보정 |
| M9. Vercel 배포 + 환경변수 + 운영 가이드 | 0.5일 | 프로덕션 URL, README |
| **합계** | **약 7일** | — |

---

## 10. Open Questions

> Design 단계 진입 전 확정해야 할 항목.

| ID | Question | 영향 영역 |
|----|----------|-----------|
| OQ1 | 대회별 "원본시트 ID"는 어디에 보관하는가? `대회목록시트`의 한 컬럼에 존재하는가, 아니면 1.대회정보시트에 자체 보관하는가? | 데이터 모델, FR-2.4 |
| OQ2 | "디자인 템플릿 번호"가 비어있는 대회에 대한 폴백 정책은? (1번 강제? 에러 표시?) | R4 |
| OQ3 | Prep / Open / Live / Calculate Total / Close 스텝 각각이 표출하는 정확한 콘텐츠는? (디자인 템플릿 HTML을 분해해야 확정 가능) | Design §11 |
| OQ4 | 결승 Pairing의 "수동 매칭" 화면 사양 (단순 안내 텍스트 vs. 운영자가 임의 매칭 입력 UI 제공)? | FR-3, FR-2 |
| OQ5 | 시트 변경 감지 후 즉시 화면 갱신을 위해 캐시 TTL을 몇 초로 둘 것인가? (5초 권장) | NFR-2, FR-4 |
| OQ6 | 향후 비밀번호 게이트 도입을 위해 미들웨어 슬롯을 비워둘 것인가? | R7 |
| OQ7 | 빈 결과(예: 본선 통과 0명) 표출 시 디자인은? | FR-5, UX |

---

## Decision Record

| Decision | 채택 | 이유 |
|----------|------|------|
| **데이터 접근**: Google Sheet API Key + 공개 시트 | ✅ | 가장 단순, 인증·OAuth 불필요. 시트 노출 위험은 운영팀이 수용 |
| **실시간 갱신**: 5~10초 폴링 | ✅ | Webhook 미지원이므로 SSE도 결국 서버 폴링. 단순 폴링이 가장 견고 |
| **인증**: 없음 | ✅ | 현장 사용 한정, URL 비공개로 운영. 추후 게이트 추가 여지 확보 |
| **타깃 디스플레이**: Full HD + 4K + 운영자 노트북 | ✅ | 다중 해상도 → CSS clamp/viewport 단위로 일관 대응 |
| **디자인 적용 방식**: HTML 템플릿 → React 포팅 | ✅ | Next.js + Tailwind 환경에서 동적 라우팅·데이터 바인딩 필수 |

---

## Next Step

다음 단계: **Design 문서 작성**

```
/pdca design jnj-dash-app
```

Design 단계에서 다룰 내용:
- 디렉토리 구조 (`app/`, `components/`, `lib/sheets/`, `hooks/`)
- 시트 어댑터 인터페이스 (탭별 스키마)
- API 라우트 설계 (`/api/contests`, `/api/contests/{id}/sheet/{tabKey}`)
- 디자인 템플릿 슬롯 인터페이스 (`<TemplateProvider>`, `<RoundStepView>`)
- 라우팅 트리 (`/`, `/dashboard/[contestId]`, 라운드/스텝은 쿼리 또는 segment)
- Live 폴링 훅
- 3가지 아키텍처 옵션 비교 후 선택
- Module Map + 세션 분할 가이드
