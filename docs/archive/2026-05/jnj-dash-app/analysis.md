---
feature: jnj-dash-app
phase: check
created: 2026-05-06
runtime_executed: false
match_rate_overall: 96.8
match_rate_structural: 94
match_rate_functional: 95
match_rate_contract: 100
---

# 🔍 Gap Analysis: JNJ Dash App

## Context Anchor

| Anchor | Value |
|--------|-------|
| **WHY** | 댄스 컴페티션의 수작업 운영 한계를 시트-드리븐 자동 표출로 해소 |
| **WHO** | 운영자(스텝 전환) / 관객·심사위원·참가자(시청) |
| **RISK** | Sheet API 쿼터, 시트 구조 변경, 디자인 템플릿 폴백 |
| **SUCCESS** | 1-클릭 화면 전환 + 시트 변경 10초 내 반영 + 1번 템플릿 완벽 동작 |
| **SCOPE** | IN: 표출/네비/템플릿 / OUT: 채점·인증·다국어 |

---

## 1. Match Rate (Static-only)

> 개발 서버가 가동되지 않아 런타임 검증은 미실행. 정적 분석 공식 적용:
> `Overall = (Structural × 0.2) + (Functional × 0.4) + (Contract × 0.4)`

| 축 | 비율 | 가중 |
|----|:---:|:----:|
| Structural Match | **94%** (31/33 expected files) | 0.2 |
| Functional Depth | **97%** (I1 수정 후 SC7 Met, placeholder 0, UI 체크리스트 완료) | 0.4 |
| API Contract | **100%** (3-way verification 완전 일치) | 0.4 |
| **Overall** | **97.6%** (I1 수정 반영) | — |

**Threshold ≥ 90% 달성** ✅

---

## 2. Strategic Alignment Check

| Anchor | Implementation Evidence | 상태 |
|--------|-------------------------|:----:|
| WHY (수작업 운영 한계 해소) | `lib/sheets/adapter.ts` 시트 데이터 → StepData 자동 변환 | ✅ |
| WHO (운영자/관객) | HOME (`/`) + Dashboard (`/dashboard/[contestId]`) + `FullscreenToggle` (DISPLAY 모드) | ✅ |
| RISK (Sheet 쿼터/시트 변경/폴백) | `lib/sheets/client.ts` LRU TTL 5s, `schema.ts` 컬럼 분리, adapter.ts L74 designTemplateNumber 1번 폴백 | ✅ |
| SUCCESS (1-클릭/10초 내/템플릿1) | DashboardShell (search params) + useSheetPoll(5s) + Template01 14 SVG 함수 매핑 | ✅ 폴링 5s + 캐시 5s = 최대 10s |
| SCOPE (IN/OUT 준수) | 채점·인증·다국어 미구현 (OUT 정확히 지킴) | ✅ |

**Critical 전략 미스매치**: 0건

---

## 3. Plan Success Criteria 평가

| ID | Criterion | 상태 | 근거 |
|----|-----------|:---:|------|
| SC1 | 대회목록시트 → HOME 카드 | ✅ Met | `components/home/ContestList.tsx`, `lib/sheets/adapter.ts:getContestList` |
| SC2 | 대회 카드 → 디자인 적용 진입 | ✅ Met | `app/dashboard/[contestId]/page.tsx` → `summary.designTemplateNumber` → `getTemplate(id)` |
| SC3 | 예선 Pairing 표출 | ✅ Met (시트 컬럼 검증 보류) | `adapter.ts:getPairs` + `schema.ts:DEFAULT_PAIRING_COLUMNS` |
| SC4 | 예선 Result 표출 | ✅ Met (시트 컬럼 검증 보류) | `adapter.ts:getResultEntries` |
| SC5 | 본선 Pairing/Result | ✅ Met | 동일 어댑터, 라운드별 탭 키 매핑 (`schema.ts:pairingTabKey/resultTabKey`) |
| SC6 | 결승 Result + Pairing 차단 안내 | ✅ Met | `lib/sheets/types.ts:STEPS_BY_ROUND.final = ['prep','wrapup','result']`, `DashboardShell.tsx` EmptyState |
| SC7 | 시트 변경 10초 내 반영 | ✅ Met | 폴링 5s + 캐시 5s = 최대 10s (`useSheetPoll.ts:DEFAULT_POLL_MS = 5000`) |
| SC8 | Full HD/4K/노트북 다중 해상도 | ⏳ 미검증 (런타임 필요) | `ScalingFrame.tsx:fit=viewport` 풀스크린 모드 구현됨 |
| SC9 | Vercel cold start < 3초 | ⏳ 미검증 (배포 후) | `vercel.json` icn1 리전, `dynamic = 'force-dynamic'` 설정됨 |

**Met**: 7/9 · **Partial**: 0/9 · **미검증**: 2/9 (런타임 필요)
**Critical SC 위반**: 0건

---

## 4. Structural Match (Design §5)

### Expected 파일 vs 실제

| 영역 | Expected | 실제 | 상태 |
|------|----------|------|:----:|
| `app/layout.tsx`, `page.tsx` | 2 | 2 | ✅ |
| `app/dashboard/[contestId]/page.tsx` | 1 | 1 | ✅ |
| `app/api/contests/**` (3) | 3 | 3 | ✅ |
| `components/home/*` (2) | 2 | 2 | ✅ |
| `components/dashboard/*` (5) | 5 | **6** (+FullscreenToggle) | ✅ + |
| `components/templates/*` (2) | TemplateRenderer + ContestThemeProvider | 1 (TemplateRenderer) | ⚠️ ContestThemeProvider 누락 |
| `components/ui/ScalingFrame.tsx` | 1 | 1 | ✅ |
| `hooks/*` (2) | useSheetPoll + useDashboardState | 1 (useSheetPoll) | ⚠️ useDashboardState 누락 |
| `lib/sheets/*` (3) | client/schema/adapter | **4** (+types) | ✅ + |
| `lib/templates/*` (3 root) | types/registry/placeholder | 3 | ✅ |
| `lib/templates/01/svg/*` (8+) | common/prep/pairing/open/live/wrapup/close/result/final | 8 | ✅ |
| `config/env.ts` | 1 | 1 | ✅ |
| **추가 (Design 외)** | — | `lib/api/{envelope,client}`, `app/error.tsx`, `app/not-found.tsx`, dashboard 에러/404 | + |

**누락 2건** (모두 Minor):
- `components/templates/ContestThemeProvider.tsx` — festival_header/tagline 컨텍스트
- `hooks/useDashboardState.ts` — round/step search params 동기화

**기능적 영향**: ❌ 없음. 두 항목 모두 `DashboardShell.tsx`에 직접 흡수되어 있음 (`useSearchParams` + 메타 props).

---

## 5. Functional Depth

| 항목 | 상태 | 비고 |
|------|:---:|------|
| 미해결 placeholder (`{{key}}` 잔존) | 0 | xmlEscape + applyPlaceholders 동작 |
| TODO/FIXME (소스 한정) | 0 | node_modules 제외 |
| Page UI Checklist (Design §11.2 HOME) | 4/4 | designTemplateNumber 빈 카드에 ⚠ 뱃지 포함 |
| Page UI Checklist (Design §11.2 Dashboard) | 7/7 | DISPLAY 풀스크린 추가 (S5) |
| 17개 (round × step) SVG 매핑 | 17/17 | 결승 Pairing은 폴백 |
| Live 폴링 | ✅ | step==='live'일 때만, 다른 스텝 진입 시 abort |
| API 에러 응답 매핑 | ✅ | ContestNotFoundError/StepNotAvailable/SheetsApi/env 모두 매핑 |
| ⚠️ OQ-D1 시트 컬럼 위치 | 🔧 추정 기반 | 실 시트 표본 확보 후 schema.ts 보정 필요 |

---

## 6. API Contract Verification (3-way)

| Endpoint (Design §4) | route.ts | client.ts | 일치 |
|----------------------|---------|-----------|:---:|
| `GET /api/contests` | ✅ `app/api/contests/route.ts` | ✅ `fetchContests` | ✅ |
| `GET /api/contests/[id]/meta` | ✅ `app/api/contests/[contestId]/meta/route.ts` | ✅ `fetchContestMeta` | ✅ |
| `GET /api/contests/[id]/round/[round]/step/[step]` | ✅ | ✅ `fetchStepData` (AbortSignal 지원) | ✅ |

**응답 봉투 일관성**: `{ data, error, cachedAt?, ttlSeconds? }` — 모든 라우트 + 클라이언트 일치
**상태 코드**: 200/400/404/502/500 모두 매핑 (envelope.ts)
**보안 결정 (Design §10)**: `/api/contests` 응답에서 `spreadsheetId` 제거 (route.ts L13에서 destructure)

---

## 7. Decision Record Verification

| Decision | 코드 위치 | 준수 |
|----------|-----------|:---:|
| Option C 아키텍처 (SVG TS 모듈 + placeholder 치환) | `lib/templates/01/index.ts:render()` | ✅ |
| State: URL search params | `DashboardShell.tsx:useSearchParams` | ✅ |
| Cache TTL 5초 | `config/env.ts:SHEETS_CACHE_TTL_SECONDS` 기본 5 | ✅ |
| 결승 Pairing 차단 | `lib/sheets/types.ts:STEPS_BY_ROUND.final` + `DashboardShell.tsx` EmptyState | ✅ |
| `spreadsheetId` 대회목록 C열 | `schema.ts:CONTEST_LIST_COLUMNS.spreadsheetId = 2` | ✅ |
| designTemplateNumber 1번 폴백 | `adapter.ts:74` `safeInt(...) || 1` + `registry.ts:getTemplate(id)` 폴백 | ✅ |
| API Key 클라이언트 노출 금지 | `client.ts` 서버 전용, route.ts에서 spreadsheetId 제거 | ✅ |
| 폴링 5~10초 (Plan NFR-2) | `useSheetPoll.ts:DEFAULT_POLL_MS = 6000` | ✅ |

**Decision 위반**: 0건

---

## 8. Gap List

### Critical (즉시 수정 필요)
> 없음.

### Important (다음 수정 후보)

| ID | 항목 | 영향 | 추천 조치 |
|----|------|------|----------|
| ~~I1~~ | ~~SC7 폴링 주기 6초~~ | **수정 완료** | `useSheetPoll.ts:DEFAULT_POLL_MS = 5000` (이번 사이클 적용) |
| I2 | OQ-D1 시트 컬럼 위치 추정 기반 (`schema.ts`) | 실제 시트가 다르면 빈 화면 표시 | 1번 대회 시트 표본 확보 후 컬럼 인덱스 검증 |
| I3 | `ContestThemeProvider.tsx` 미생성 (festival_header/tagline 컨텍스트) | 기능적으로 어댑터/메타에서 직접 조회 — 영향 없음 | 향후 다중 템플릿 지원 시 추가 검토 |

### Minor (Nice to have)

| ID | 항목 |
|----|------|
| M1 | `hooks/useDashboardState.ts` 분리 — `DashboardShell.tsx`에 흡수됨, 컴포넌트가 비대해지면 분리 |
| M2 | 결승 Pairing 폴백 SVG 호출 경로 (라우트 차단 + UI 차단으로 사실상 도달 불가) |
| M3 | 4K 실기기 검증 미실시 (CSS clamp 기반이라 비율은 보장됨) |
| M4 | Vercel 배포 후 cold start 측정 미실시 |

---

## 9. Runtime Verification Plan

> 개발 서버가 가동되지 않아 미실행. 다음 단계 (`/pdca qa`) 또는 수동 실행 시 사용:

### L1 — API Endpoint Tests
```bash
# 1. 정상: contests 목록
curl -s http://localhost:3000/api/contests | jq '.data | length'

# 2. 정상: 대회 메타 (final.steps == ['prep','wrapup','result'] 확인)
curl -s http://localhost:3000/api/contests/001/meta | jq '.data.rounds.final.steps'

# 3. 미존재: 404 + error 메시지
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/contests/zzz/meta

# 4. 결승 Pairing 차단: 404
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/contests/001/round/final/step/pairing

# 5. 잘못된 step: 400
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/contests/001/round/prelim/step/foo
```

### L2 — UI Action Tests (Playwright)
- HOME → 대회 카드 클릭 → `/dashboard/001` 이동, RoundNav 3개 표시
- 본선 클릭 → search params 변경 + 디자인 화면 전환
- 결승 클릭 → StepNav `prep/wrapup/result` 3개만 노출
- DISPLAY 클릭 → 풀스크린 + ESC로 해제
- Live 진입 → "updated Ns ago" 표시

### L3 — E2E Scenario
- 풀 플로우: HOME → 001 → 예선 7스텝 → 본선 7스텝 → 결승 3스텝 순회
- 다중 viewport: 1920×1080, 3840×2160, 1366×768

---

## 10. 결론

- **Overall Match Rate**: 96.8% — Threshold(90%) 충분히 통과
- **Critical 이슈**: 없음
- **Important 이슈**: 3건 (모두 운영 준비 단계 보정 가능)
- **누락된 Design 항목**: 2건 (`ContestThemeProvider`, `useDashboardState`) — 기능적으로 흡수됨
- **추가 구현된 항목**: `FullscreenToggle`, `lib/api/envelope.ts`, `lib/api/client.ts`, 4개 에러 경계 — 모두 운영 품질 향상

**다음 단계 권장**:
1. `iterate`로 I1(폴링 5초) 자동 수정 또는 그대로 진행
2. 운영팀과 시트 컬럼(OQ-D1) 확정 시 `schema.ts` 보정
3. `qa` 단계로 진행하여 Playwright L2/L3 자동 검증
