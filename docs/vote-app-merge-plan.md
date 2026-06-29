# Vote 앱(jnj-score-db) → Dash 프로젝트 통합 계획

작성일: 2026-06-29

## 0. 배경 / 결론

- 현재 홈([app/page.tsx](../app/page.tsx))의 `Vote App ↗` 버튼은 외부 배포(`https://jnj-score-db.vercel.app/`)로 링크됨.
- `Join App ↗`은 이미 내부 `/join` 경로 → Vote도 동일하게 **내부 `/vote` 경로로 흡수**한다.
- **통합 가능. 조건 양호** — 두 앱이 같은 Supabase 프로젝트(`wpahhleendnsewuptrhm`)를 공유하므로 데이터 이전 불필요, 라우트/ API 충돌 없음.

## 1. 사전 호환성 점검 결과

| 항목 | Dash | Score | 판정 |
|------|------|------|------|
| Next.js / React | 15 / 19 | 15 / 19 | 동일 |
| DB | Supabase `wpahhleendnsewuptrhm` | 같은 프로젝트 | 공유 (이전 불필요) |
| 페이지 라우트 | admin, dashboard, join, judge | competitions, enter, event, round | 충돌 없음 |
| API 라우트 | api/admin, api/contests, api/join, api/judge, api/video | api/db/* | 충돌 없음 |
| import 별칭 | `@/* → ./*` | `@/* → ./*` (단, 실제론 상대경로 사용) | 동일 |
| env 키 | Supabase 키 셋 + α | Supabase 키 셋(부분집합) | 추가 불필요 |
| 스타일 | Tailwind | 순수 CSS | **격리 필요** |
| middleware | /admin, /api/admin만 보호 | — | vote 영향 없음 |

## 2. 주의 / 해결 포인트

1. **스타일 격리**: Score는 Tailwind 미사용(순수 CSS). Score의 `globals.css`를 전역에 올리면 Dash Tailwind와 충돌.
   → Score를 `app/vote/` 하위 트리에 두고 **자체 nested layout**에서 Score CSS를 import. (`<html>/<body>`는 루트 layout만 렌더; vote layout은 wrapper div만)
2. **상대경로 import**: Score 파일들이 `../../../../lib/...` 식 상대경로 사용 → 폴더 이동 시 깊이가 깨짐.
   → 이동과 동시에 **`@/lib/vote/...`, `@/components/vote/...`, `@/hooks/vote/...` 별칭으로 일괄 변환**.
3. **의존성**: Score는 `qrcode`, `@types/qrcode` 추가 사용. → package.json에 2개 추가 후 `npm install`.
4. **next.config**: Score의 Windows React 중복 우회 webpack alias는 단일 node_modules 환경에서 불필요 → 포팅 안 함.

## 3. 파일 이동 매핑

| Score 위치 | Dash 통합 위치 |
|------|------|
| `app/competitions/`, `app/enter/`, `app/event/`, `app/round/` | `app/vote/competitions/` 등 (`app/vote/` 하위) |
| `app/layout.tsx` (Score) | `app/vote/layout.tsx` (nested, html/body 제거, CSS만 import) |
| `app/globals.css` (Score) | `app/vote/vote.css` (vote layout에서만 import) |
| `app/styles/` | `app/vote/styles/` |
| `app/api/db/*` | `app/api/vote/*` (정리 목적; 원래 충돌은 없음) |
| `lib/supabase.ts`, `lib/sheet-schema.ts`, `lib/apps-script.ts`, `lib/api-client.ts` | `lib/vote/` |
| `components/*` (Button, Card, NavBar 등 10개) | `components/vote/` |
| `hooks/useCompetition.ts`, `useJudge.ts`, `useDraft.ts` | `hooks/vote/` |

## 4. 작업 순서 (단계별)

1. **의존성 추가**: package.json에 `qrcode`, `@types/qrcode` → `npm install`.
2. **lib 이동**: Score `lib/*` → `lib/vote/`.
3. **hooks 이동**: Score `hooks/*` → `hooks/vote/`.
4. **components 이동**: Score `components/*` → `components/vote/`.
5. **페이지 이동**: Score `app/{competitions,enter,event,round}` → `app/vote/`.
6. **API 이동**: Score `app/api/db/*` → `app/api/vote/*`.
7. **nested layout 생성**: `app/vote/layout.tsx` — `<html>/<body>` 없이 children 래핑 + `./vote.css` import.
8. **CSS 격리**: Score `globals.css` → `app/vote/vote.css`로 복사 (전역 reset이 Dash와 충돌하면 `.vote-root` 스코프로 한정).
9. **import 일괄 변환**: 이동된 모든 파일의 상대경로 → `@/lib/vote/...`, `@/components/vote/...`, `@/hooks/vote/...`. API fetch 경로 `/api/db/*` → `/api/vote/*`.
10. **홈 링크 변경**: [app/page.tsx](../app/page.tsx) L22-29 `Vote App` `<a href>` → `<Link href="/vote">` (Join과 동일 패턴).
11. **검증**: `npm run typecheck` → `npm run build` → `npm run dev`로 `/vote` 동작 확인.

## 5. 검증 체크리스트

- [ ] `npm run typecheck` 통과
- [ ] `npm run build` 통과
- [ ] `/vote` (경연 목록) 렌더 + 스타일 정상, Dash Tailwind 페이지 스타일 영향 없음
- [ ] `/vote/round/[round]` 채점 입력 → submit → Supabase 반영
- [ ] QR 코드 렌더 정상
- [ ] 홈 `Vote App ↗` → `/vote` 이동
- [ ] 기존 Dash 페이지(admin/dashboard/judge/join) 회귀 없음

## 6. 정리 (통합 후)

- `app/page.tsx`의 외부 URL 제거 완료 → 기존 `jnj-score-db.vercel.app` 배포는 중단 가능(선택).
- 원본 `Z:\projects\jnj-score-db`는 백업으로 보존 후 정리.

## 7. 추정 작업량

- 파일 이동 ~30개, import 변환 ~25개 파일, 신규/수정 ~4개. 단일 세션 내 완료 가능. 위험도 낮음(별도 경로로 격리되어 기존 기능 영향 최소).
