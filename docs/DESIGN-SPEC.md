# JNJ Dash — Design Spec

> 대시보드 표출 화면(SVG) 디자인 사양. 폰트·색상·좌표·구성요소를 한 곳에 모아 관리한다.
> 수정 시 본 문서와 실제 코드를 함께 업데이트해야 한다. 마지막 갱신: 2026-05-24.

---

## 1. 폰트 시스템 (Typography)

### 로드 위치
[app/layout.tsx](../app/layout.tsx) — Google Fonts 링크로 `<head>` 에서 preconnect 후 로드.

```
Cormorant Garamond: ital,wght@0,300; 0,400; 0,500; 0,600; 0,700; 1,300; 1,400
Cinzel:            wght@400; 500; 600; 700; 800; 900
```

### 폰트 역할 (Font Roles)

| 역할 | Font Family | Weight | Style | 용도 |
|---|---|---|---|---|
| **Display (대형 제목)** | `'Cinzel'` | bold | normal | PREPARING / OPEN / LIVE / PAIRING / RESULT / CHAMPIONS 등 ALL CAPS 메인 타이틀 |
| **Elegant (부텍스트·서브타이틀)** | `'Cormorant Garamond'` | 300–600 | italic 위주 | festival_header, tagline, stage_label, round_subtitle, 시적 부제 |
| **Mono (번호·코드)** | `ui-monospace, monospace` | 600–bold | normal | LIVE 배지, 참가번호, label_leader/follower (1ST/2ND/3RD), open_subline |

### Fallback 체인 (한글 호환)
서구 본문체 + 굴림으로 한글 fallback:
```
font-family="'Cinzel', 'Cormorant Garamond', Georgia, 'Gulim', '굴림', serif"
font-family="'Cormorant Garamond', Georgia, 'Gulim', '굴림', serif"
```

### 주요 폰트 크기 (Template 03 기준)

| 요소 | font-size | letter-spacing | weight/style |
|---|---|---|---|
| festival_header (top/hero) | 22 | 5 | italic 500 |
| stage_label (예: PRELIMINARY ROUND) | 20–22 | 10 | italic |
| PREPARING / round_title | 84 | 8 | bold (Cinzel) |
| GRAND FINAL PAIRING (대형) | 118 | 24 | bold (Cinzel) |
| round_subtitle (Get ready · …) | 22 | 12 | normal opacity 0.85 |
| tagline | 13 | 2 | italic |
| sponsor_logo opacity (per-slot) | — | — | 슬롯별 0-100% |

---

## 2. 색상 팔레트 (Palette)

[common.ts COMMON_DEFS](../lib/templates/03/svg/common.ts) 에서 SVG `<defs>` 그라디언트로 정의.

| ID | 종류 | 색상 stops |
|---|---|---|
| `goldg` | vertical | `#FFEBA0 → #FFD56B → #C68F3C` |
| `goldgh` | horizontal | `transparent → #FFD56B → transparent` |
| `sgw` | radial glow | `#FFFAE0 → #FFD56B (a:.95) → … → transparent` |
| `palmg` | vertical | `#FFD56B → #D4AF37 → #9C7C2C` |
| `silverg` | vertical | `#F0F0F2 → #C0C0C8 → #7A7A82` (Follower) |
| `bronzeg` | vertical | `#E89F65 → #B07050 → #6E4030` |
| `liveg` | vertical | `#FF8B8B → #D04040` |
| `hxg` | radial | `#1A4030 → #0A2018` (헥사곤 내부) |

### 텍스트 색상
| 토큰 | HEX | 용도 |
|---|---|---|
| 골드 메인 | `#D4AF37` | 보조 텍스트, divider |
| 골드 하이라이트 | `#FFD56B` | stage_label |
| 골드 밝음 | `#FFEBA0` | 시적 부제, live_message |
| 텍스트 일반 | `#E8E6DA` | subtitle, body |
| 텍스트 흐림 | `#9A98A8` | meta, wrap_message |

---

## 3. 화면별 레이아웃 (Per-Screen Layout)

viewBox: **1280 × 720**.

### 3.1 PREP (예선/본선 공통)
[lib/templates/03/svg/prep.ts](../lib/templates/03/svg/prep.ts)

| y | 요소 | 비고 |
|---|---|---|
| 110 | JLCF 스탬프 (heroHeader) | image, height 160 |
| 212 | festival_header | Cormorant italic 22, letter-spacing 5 |
| 232 | divider (라인만, 320px) | 별·점 장식 제거됨 |
| 288 | stage_label (PRELIMINARY ROUND) | Cormorant italic 20, ls 10, `#FFD56B` |
| 386 | **PREPARING** (round_title) | Cinzel bold 84, ls 8, `url(#goldg)` |
| 430 | round_subtitle (Get ready · take your places) | Cormorant 22, ls 12, opacity 0.85 |
| 530 (cy) | 돌하르방 3개 (pulse 애니) | dolharubangSvg, width 192 |
| **610** | tagline (citiesFooter, y 파라미터로 전달) | Cormorant italic 13, ls 2 |
| **658** | sponsorRow (광고 6개) | 140×48 박스, gap 44, 가로 1060 사용 |

**Sponsor Logos**
- 좌우 여백 110px
- 슬롯 중심 x: 180 / 364 / 548 / 732 / 916 / 1100
- 각 슬롯 opacity 0-100% 개별 설정 ([ContestForm](../components/admin/ContestForm.tsx))

### 3.2 PAIRING (예선/본선) — random pairing 카드 배치
[lib/templates/03/svg/pairing.ts](../lib/templates/03/svg/pairing.ts)

| y | 요소 |
|---|---|
| 78 | topHeader festival_header |
| 146 | round_title (RANDOM PAIRING) — Cinzel bold 36, ls 10 |
| 176 | stage_label — Cormorant italic 15, ls 6 |
| 중앙 | 페어 카드들 (animated reveal) |

### 3.3 GRAND FINAL PAIRING — 심사위원 인비테이셔널 댄스
[lib/templates/03/svg/final.ts](../lib/templates/03/svg/final.ts) `finalPairingSvg()`

| y | 요소 | 비고 |
|---|---|---|
| 78 | topHeader festival_header | |
| 216 | stage_label (GRAND FINAL) | Cormorant italic 22, ls 10 |
| 420 (cx,cy) | sgw 글로우 (r=320, r=200) | opacity 0.28, 0.18 |
| 420 ±200 | 18개 골드 스파클 (랜덤 위상) | r 1.2~2.7, 3.4s 페이드 |
| **438** | **PAIRING** | Cinzel bold 118, ls 24, pulse 3s |
| 502 | divider (좌·우 라인 + 3점 ornament) | |
| **552** | "Where the judges share the floor with the finalists" | Cormorant italic 16, ls 5, `#D4AF37` (한글 부제는 삭제됨) |
| **622** | 6쌍 펄스 도트 (couple dots) | 골드(L)·실버(F) + 가로선, 위상 시차 |
| 660 | citiesFooter | |

### 3.4 OPEN
중앙 sunburst + 96px 원 안에 "NOW / OPEN / the journey begins" 텍스트.

### 3.5 LIVE
좌상단 LIVE 배지(빨간 그라디언트, 펄스), 중앙 거대 원 안에 LIVE 텍스트.

### 3.6 CALC TOTAL (wrapup)
중앙 다이아몬드/scroll 아이콘 + "CALCULATING TOTAL / IN PROGRESS" + 3 도트 펄스.

### 3.7 RESULT
헥사곤 그리드 (leader/follower 통과자), 1280×720 viewBox 내에 동적 배치.

### 3.8 CLOSE
중앙 원형 봉인 도트들 + 체크마크 + "ROUND COMPLETE".

### 3.9 CEREMONY (그랜드 파이널 시상식)
중앙 1위 헥사곤(큰) + 좌우 2/3위(작은) + 벚꽃 토글 애니메이션.

---

## 4. 공통 컴포넌트 (Shared Helpers)

[lib/templates/03/svg/common.ts](../lib/templates/03/svg/common.ts) 에 정의된 재사용 함수:

| 함수 | 시그니처 | 비고 |
|---|---|---|
| `shell(content)` | `(content: string) => string` | SVG 외곽 wrapper + COMMON_DEFS |
| `divider(y, w?)` | `(y: number, w=380) => string` | 가로 골드 라인 (장식 제거됨) |
| `topHeader()` | — | 상단 페스티벌 헤더 |
| `heroHeader()` | — | 스탬프 + 헤더 + divider |
| `jlcfStamp(cx,cy,h)` | `(640,110,160)` | JLCF 골드 스탬프 PNG |
| `sunburstTop(cx,cy,s)` | | 회전하는 햇살 패턴 |
| `hexagonFrame(...)` | | 6각형 프레임 + 사진/이름 |
| `trophyIcon(cx,cy,s)` | | 트로피 아이콘 |
| `citiesFooter(y=660)` | `(y?: number) => string` | 하단 가로선 + 태그라인 |
| **`sponsorRow(y=658,w=140,h=48,gap=44)`** | | **PREP 전용 광고 6개 row** |

---

## 4-1. 대회별 커스텀 배경

- DB: `contests.background_image text` ([0009](../db/migrations/0009_contest_background.sql))
- Storage 버킷: `contest-backgrounds` (public read, 8MB, jpg/png/webp)
- Upload API: [POST /api/admin/contests/[id]/background-upload](../app/api/admin/contests/[contestId]/background-upload/route.ts)
- 동작:
  1. 어드민이 이미지 업로드 → contests.background_image 자동 저장
  2. DashboardShell → TemplateRenderer 에 `backgroundOverride` prop 으로 전달
  3. Template render() 가 SVG 내부 `<!--BG_OVERRIDE_SLOT-->` 마커를 `<image>` 로 치환
  4. 마커 위치는 BG_LAYER 바로 다음 → 기본 배경 위에 덮어 그림
- 비어있으면 마커가 빈 문자열로 치환 → 템플릿 기본 배경 유지
- 적용 범위: PREP / PAIRING / OPEN / LIVE / WRAPUP / RESULT / CLOSE / CEREMONY 모든 화면

## 5. 광고/스폰서 로고 시스템

### DB
- `contests.sponsor_logos text[]` — public URL 최대 6개 ([0007](../db/migrations/0007_sponsor_logos.sql))
- `contests.sponsor_logo_opacities int[]` — 0-100 슬롯별 ([0008](../db/migrations/0008_sponsor_logo_opacities.sql))

### Storage
- 버킷: `contest-sponsors` (public read, 3MB, jpg/png/webp/gif/svg)
- 경로: `{contestId}/slot-{0-5}-{ts}.{ext}` 또는 `_pending/{ts}-{rand}.{ext}`

### Upload API
[POST /api/admin/contests/[contestId]/sponsor-upload](../app/api/admin/contests/[contestId]/sponsor-upload/route.ts)
- multipart `file` + 선택 `slot` (0-5)
- slot 지정 시 contests 자동 업데이트

### 렌더 흐름
```
contest.sponsor_logos + sponsor_logo_opacities
  → adapter.staticPrep() forwards both
  → placeholder.flattenStepData() PREP case → sponsor_logo_1..6 / sponsor_opacity_1..6
  → SVG sponsorRow() <image href={{sponsor_logo_N}} opacity={{sponsor_opacity_N}}/>
```

---

## 6. 최근 커스터마이징 이력 (Changelog)

> 디자인 변경 시 본 섹션에 추가.

### 2026-05-24 (추가)
- 대회별 커스텀 배경 이미지 업로드 기능 추가 (마이그레이션 0009)
- TemplateModule.render 가 `opts.backgroundOverride` 받아 SVG `<!--BG_OVERRIDE_SLOT-->` 치환
- 8개 모든 화면(PREP/PAIRING/OPEN/LIVE/WRAPUP/RESULT/CLOSE/CEREMONY)에 동일 배경 적용
- ContestForm 의 모든 라벨/버튼/힌트 i18n 화 (EN/KO 토글 연동) — `cf.*` 메시지 키 추가

### 2026-05-24
- Template 03 페스티벌 헤더에서 ★ 두 개 제거
- divider 에서 나비넥타이(triangle), 양쪽 점 두 개, 중심점까지 제거 → 순수 가로선만
- 폰트 시스템 도입: **Cinzel** (display caps) + **Cormorant Garamond** (italic 부텍스트)
  - Template 01/02/03 의 모든 Georgia 폰트를 Cormorant Garamond 로 치환
  - bold + 큰 글씨(round_title 등)는 Cinzel 적용
  - festival_header 크기 14 → 22, italic 500, letter-spacing 6 → 5
- PREP 화면:
  - 비어있던 participants 블록(중복 가로줄) 제거
  - tagline y=660 → 610 (돌하르방 바로 아래)
  - **6개 광고 sponsorRow 신규** y=658, 박스 140×48, gap 44, 가로 1060 사용
  - 어드민 ContestForm 에 슬롯별 업로드 + opacity 슬라이더 UI
- GRAND FINAL PAIRING (final.ts `finalPairingSvg`):
  - PAIRING 아래 ✦ 장식 제거
  - 떠다니는 골드 스파클 18개, 영문 시적 부제, 6쌍 펄스 도트 추가
  - 한글 부제 "심사위원과 함께 호흡하는 시간" 은 사용자 요청으로 삭제됨
- Template 01/02 의 prep / 페스티벌 헤더 / divider 도 동일하게 동기화

---

## 7. 변경 작업 체크리스트

폰트나 레이아웃을 바꿀 때 확인할 위치:

- [ ] `lib/templates/01,02,03/svg/*.ts` — SVG 텍스트의 font-family/size/y 좌표
- [ ] `lib/templates/01,02,03/svg/common.ts` — 공통 헬퍼 (sponsorRow, citiesFooter, heroHeader)
- [ ] `app/layout.tsx` — Google Fonts 추가 시 weight 포함
- [ ] `components/admin/ContestForm.tsx` — 신규 필드 입력 UI
- [ ] `app/api/admin/contests/{,[contestId]}/route.ts` — Zod 스키마
- [ ] `lib/db/types.ts` + `lib/db/adapter.ts` — DB 컬럼 ↔ PrepData 매핑
- [ ] `lib/sheets/types.ts` — PrepData/PairingData 등 인터페이스
- [ ] `lib/templates/placeholder.ts` — 배열 → placeholder 평탄화 로직
- [ ] `db/migrations/*.sql` — 신규 컬럼/버킷
- [ ] **본 DESIGN-SPEC.md 갱신**
