// Template 08 — "NEON VERSUS" (BATTLE_DASH_DB 08 이식 · 잭앤질 스텝 화면은 07 과 같다)
//
// 레퍼런스: 격투 게임 대결 화면의 "VS" 키 비주얼.
//  · 배경: 딥 네이비 위로 사선(약 62°) 빛줄기가 흐른다 — 중심선 좌상단은 시안, 우하단은 마젠타,
//    바깥은 옅은 블루. 빛줄기는 제 축을 따라 천천히 흘러가 화면이 멈춰 있지 않다.
//    이미지 파일 없이 벡터로만 그려 해상도·로딩과 무관하다.
//  · 면: 좌상·우하 모서리를 사선으로 깎은 반투명 네이비 카드 — 배경 빛줄기와 같은 방향의 컷.
//    깎인 두 모서리에 시안/마젠타 강조선을 얹어 "대결"의 두 색을 모든 카드에 반복한다.
//  · 글자: 흰색 초굵은 이탤릭. 대형 제목은 왼쪽으로 시안, 오른쪽으로 마젠타 글로우가 번진다.
//    숫자는 흰색 → 시안 그라디언트, 작은 라벨은 시안 대문자.
//  · 역할 색: 리더 = 마젠타, 팔로워 = 스카이블루 — 배경의 두 색과 같은 축.
//
// 화면 레이아웃(svg/*)은 07 과 같다 — 여기의 프리미티브가 07 과 같은 이름·시그니처를 가지므로
// 좌표는 그대로 두고 외형만 바뀐다. 그래서 이름에 남은 ACCENT(07 의 GOLD 자리) · hero 옵션도 같은 의미다.
import { svgId } from '../shared/svgId';

// ── 팔레트 ──────────────────────────────────────────────────────────────────
export const NIGHT = '#030920';      // 가장 어두운 면 / 밝은 칩 위 글자
export const WHITE = '#FFFFFF';      // 제목·이름
export const SOFT = '#CFE3FF';       // 보조 텍스트 (아이스 블루 화이트)
export const DIM = '#7F9BC8';        // 3차 텍스트
export const ACCENT = '#3EE6FF';     // 라벨·강조 — 네온 시안
export const ACCENT_PALE = '#C9F7FF';
export const LEAD = '#FF3D9A';       // 리더 — 마젠타
export const FOLLOW = '#4FB8FF';     // 팔로워 — 스카이블루
export const LIVE_GREEN = '#39F5A0';
export const FRAME = '#8FDFFF';      // 사진 테두리 — 옅은 시안
export const SILVER = '#D6E4FF';     // 2위
export const BRONZE = '#FF9A6B';     // 3위

// ── 폰트 ────────────────────────────────────────────────────────────────────
// Montserrat(이탤릭 포함)는 app/layout.tsx 와 TemplatePicker iframe 에서 로드. 한글은 Malgun Gothic 폴백.
// 이탤릭은 TEXT_STYLE 의 CSS 로 모든 글자에 일괄 적용한다 (화면별 <text> 를 고치지 않아도 되게).
export const DISPLAY =
  "'Montserrat', 'Arial Black', 'Malgun Gothic', '맑은 고딕', 'Apple SD Gothic Neo', sans-serif";

// ── 좌표 ────────────────────────────────────────────────────────────────────
export const CX = 640;
export const MX = 32;
export const RX = 1248;
export const HEAD_Y = 52;   // 상단 러너 baseline
export const FOOT_Y = 694;  // 하단 러너 baseline

/** 좌표 문자열 — 소수 1자리. */
export const f = (n: number): string => String(Math.round(n * 10) / 10);

export type Role = 'L' | 'F';
export const ROLE_FILL: Record<Role, string> = { L: 'url(#t08Lead)', F: 'url(#t08Follow)' };
export const ROLE_COLOR: Record<Role, string> = { L: LEAD, F: FOLLOW };

export const pad2 = (n: number): string => String(n).padStart(2, '0');

/** 결정적 의사난수 — SSR/CSR·빌드마다 같은 결과. */
export function seeded(i: number): number {
  const x = Math.sin(i * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}


/** 빛줄기 한 가닥용 가로 그라디언트 — 양 끝이 사라지는 광선. */
function streakGradient(id: string, color: string): string {
  return `
  <linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="${color}" stop-opacity="0"/>
    <stop offset="0.55" stop-color="${color}" stop-opacity="1"/>
    <stop offset="1" stop-color="${color}" stop-opacity="0"/>
  </linearGradient>`;
}

export const COMMON_DEFS = `
  <linearGradient id="t08BgBase" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#071640"/>
    <stop offset="0.5" stop-color="#051033"/>
    <stop offset="1" stop-color="#02061A"/>
  </linearGradient>
  <radialGradient id="t08BgGlow" cx="0.5" cy="0.46" r="0.62">
    <stop offset="0" stop-color="#1E55E0" stop-opacity="0.55"/>
    <stop offset="0.55" stop-color="#12348F" stop-opacity="0.22"/>
    <stop offset="1" stop-color="#051033" stop-opacity="0"/>
  </radialGradient>
  ${streakGradient('t08StreakC', '#3EE6FF')}
  ${streakGradient('t08StreakM', '#FF3D9A')}
  ${streakGradient('t08StreakB', '#2F6BFF')}
  ${streakGradient('t08StreakW', '#FFFFFF')}
  <linearGradient id="t08HazeC" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#1C9DFF" stop-opacity="0"/>
    <stop offset="1" stop-color="#3EE6FF" stop-opacity="0.5"/>
  </linearGradient>
  <linearGradient id="t08HazeM" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#FF3D9A" stop-opacity="0.45"/>
    <stop offset="1" stop-color="#7A2BFF" stop-opacity="0"/>
  </linearGradient>
  <radialGradient id="t08Bloom" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.32"/>
    <stop offset="0.4" stop-color="#7FEFFF" stop-opacity="0.12"/>
    <stop offset="1" stop-color="#3EE6FF" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="t08Vignette" cx="0.5" cy="0.5" r="0.75">
    <stop offset="0.55" stop-color="#01030F" stop-opacity="0"/>
    <stop offset="1" stop-color="#01030F" stop-opacity="0.75"/>
  </radialGradient>

  <linearGradient id="t08CardFill" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#0C2566" stop-opacity="0.8"/>
    <stop offset="1" stop-color="#060F33" stop-opacity="0.84"/>
  </linearGradient>
  <linearGradient id="t08CardStroke" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#6FE9FF" stop-opacity="0.8"/>
    <stop offset="0.5" stop-color="#3B5BD9" stop-opacity="0.35"/>
    <stop offset="1" stop-color="#FF5FAE" stop-opacity="0.65"/>
  </linearGradient>
  <linearGradient id="t08CardSheen" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.1"/>
    <stop offset="0.35" stop-color="#FFFFFF" stop-opacity="0.02"/>
    <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="t08AccentStroke" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#7FF1FF"/>
    <stop offset="0.5" stop-color="#8A7CFF"/>
    <stop offset="1" stop-color="#FF3D9A"/>
  </linearGradient>
  <linearGradient id="t08AccentNum" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#FFFFFF"/>
    <stop offset="0.45" stop-color="#C4F8FF"/>
    <stop offset="1" stop-color="#3EE6FF"/>
  </linearGradient>
  <linearGradient id="t08PhotoBg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#13306F"/>
    <stop offset="1" stop-color="#071434"/>
  </linearGradient>
  <linearGradient id="t08Lead" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#FF7BC0"/>
    <stop offset="1" stop-color="#E0237A"/>
  </linearGradient>
  <linearGradient id="t08Follow" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#A6EDFF"/>
    <stop offset="1" stop-color="#2AA8F0"/>
  </linearGradient>
  <linearGradient id="t08LiveRed" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#FF4F7E"/>
    <stop offset="1" stop-color="#D3134C"/>
  </linearGradient>
  <linearGradient id="t08RuleH" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="${ACCENT}" stop-opacity="0"/>
    <stop offset="0.45" stop-color="${ACCENT}" stop-opacity="0.95"/>
    <stop offset="0.55" stop-color="${LEAD}" stop-opacity="0.95"/>
    <stop offset="1" stop-color="${LEAD}" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="t08RuleV" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${ACCENT}" stop-opacity="0"/>
    <stop offset="0.5" stop-color="${ACCENT}" stop-opacity="0.6"/>
    <stop offset="1" stop-color="${LEAD}" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="t08Shine" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#FFFFFF" stop-opacity="0"/>
    <stop offset="0.5" stop-color="#FFFFFF" stop-opacity="0.85"/>
    <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="t08Eq" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#C9F7FF"/>
    <stop offset="0.5" stop-color="#3EE6FF"/>
    <stop offset="1" stop-color="#FF3D9A"/>
  </linearGradient>
  <filter id="t08Soft" x="-20%" y="-20%" width="140%" height="140%">
    <feGaussianBlur stdDeviation="9"/>
  </filter>
  <!-- shared/ 모듈(judgesIntro·judgesVideo·reportSvg)이 참조하는 공용 id 를 08 팔레트로 정의 -->
  <linearGradient id="goldg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#FFFFFF"/>
    <stop offset="0.45" stop-color="#C4F8FF"/>
    <stop offset="1" stop-color="#3EE6FF"/>
  </linearGradient>
  <linearGradient id="goldgh" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="${ACCENT}" stop-opacity="0"/>
    <stop offset="0.5" stop-color="${ACCENT}" stop-opacity="0.9"/>
    <stop offset="1" stop-color="${ACCENT}" stop-opacity="0"/>
  </linearGradient>
  <radialGradient id="hxg" cx="0.5" cy="0.4" r="0.6">
    <stop offset="0" stop-color="#13306F"/>
    <stop offset="1" stop-color="#071434"/>
  </radialGradient>
`;

/** 벡터 바탕 — 딥 네이비 + 중앙의 푸른 조명. 커스텀 배경이 반투명일 때도 비친다. */
export const BG_VECTOR = `
  <rect x="0" y="0" width="1280" height="720" fill="url(#t08BgBase)"/>
  <rect x="0" y="0" width="1280" height="720" fill="url(#t08BgGlow)"/>
`;

// 중심선 가까이 고정으로 놓는 주인공 빛줄기 — [가로 오프셋, 두께, 색, 불투명도]
const HERO_STREAKS: ReadonlyArray<readonly [number, number, 'C' | 'M' | 'W', number]> = [
  [-96, 30, 'C', 0.5], [-38, 4, 'W', 0.85], [-8, 12, 'C', 0.7], [34, 22, 'M', 0.55], [78, 5, 'W', 0.6], [132, 16, 'M', 0.45],
];

/**
 * 사선 빛줄기 — 로컬 좌표를 -62° 돌려 빛줄기를 로컬 x 축(좌하→우상)으로 늘어놓는다.
 * 로컬 y(가로 오프셋)가 음수면 화면 좌상 = 시안, 양수면 우하 = 마젠타, 중심에서 멀면 블루.
 * 각 줄기는 x 를 따라 흘러가며 양 끝에서 사라진다 (begin 음수 → 로드 즉시 흐르는 중).
 */
function streaks(): string {
  const beam = (i: number, lat: number, thick: number, color: string, op: number): string => {
    const len = 320 + seeded(i + 100) * 640;
    const x0 = -1000 + seeded(i + 150) * 1100;
    const travel = 520 + seeded(i + 200) * 520;
    const dur = (4.5 + seeded(i + 250) * 6).toFixed(2);
    const begin = (-seeded(i + 300) * Number(dur)).toFixed(2);
    const o = op.toFixed(2);
    return `
      <rect x="${f(x0)}" y="${f(lat - thick / 2)}" width="${f(len)}" height="${f(thick)}" fill="url(#t08Streak${color})" opacity="0">
        <animate attributeName="x" values="${f(x0)};${f(x0 + travel)}" dur="${dur}s" begin="${begin}s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0;${o};${o};0" keyTimes="0;0.2;0.75;1" dur="${dur}s" begin="${begin}s" repeatCount="indefinite"/>
      </rect>`;
  };

  let body = '';
  for (let i = 0; i < 46; i++) {
    const lat = (seeded(i + 1) - 0.5) * 1500;
    const d = Math.abs(lat);
    const thick = 1.2 + Math.pow(seeded(i + 50), 3) * 16;
    const near = d < 280;
    const color = near || (d < 540 && seeded(i + 350) > 0.5) ? (lat < 0 ? 'C' : 'M') : 'B';
    const op = (near ? 0.8 : d < 540 ? 0.5 : 0.32) * (0.5 + seeded(i + 400) * 0.5);
    body += beam(i, lat, thick, color, op);
  }
  body += HERO_STREAKS.map(([lat, thick, color, op], k) => beam(900 + k, lat, thick, color, op)).join('');

  return `
    <g transform="translate(640 360) rotate(-62)">
      <rect x="-1000" y="-320" width="2000" height="320" fill="url(#t08HazeC)" opacity="0.55"/>
      <rect x="-1000" y="0" width="2000" height="320" fill="url(#t08HazeM)" opacity="0.5"/>
      ${body}
    </g>
    <ellipse cx="640" cy="340" rx="300" ry="230" fill="url(#t08Bloom)"/>
    <rect x="0" y="0" width="1280" height="720" fill="url(#t08Vignette)"/>
  `;
}

/** 기본 배경 — 사선 네온 빛줄기. 커스텀 배경이 없을 때만 깐다. */
export const BG_LAYER = streaks();

/**
 * 커스텀 배경 위 스크림 — 흰 글자가 밝은 사진에 묻히지 않도록 네이비로 누르고
 * 중앙의 푸른 조명을 얇게 되살려 운영자 이미지 위에서도 08 톤을 유지한다.
 */
export const OVERRIDE_SCRIM = `
  <rect x="0" y="0" width="1280" height="720" fill="${NIGHT}" fill-opacity="0.5"/>
  <rect x="0" y="0" width="1280" height="720" fill="url(#t08BgGlow)" opacity="0.4"/>
`;

/**
 * 08 의 가독성 규칙.
 *  · 모든 글자: 이탤릭 + 얇은 어두운 외곽선.
 *  · .num  : 흰→시안 숫자 — 시안 네온 번짐.
 *  · .hero : 대형 제목 — 왼쪽 시안 · 오른쪽 마젠타로 갈라지는 글로우 (레퍼런스의 "VS").
 *  · .flat : 밝은 칩(마젠타/스카이) 위 어두운 글자 — 외곽선을 끈다.
 */
export const TEXT_STYLE = `
  <style>
    svg.t08 text {
      font-style: italic;
      paint-order: stroke fill;
      stroke: #01040F;
      stroke-opacity: 0.4;
      stroke-width: max(1px, 0.03em);
      stroke-linejoin: round;
    }
    svg.t08 text.num {
      stroke: #001A2E;
      stroke-opacity: 0.5;
      filter: drop-shadow(0 0 0.18em rgba(62, 230, 255, 0.55));
    }
    svg.t08 text.hero {
      stroke-opacity: 0.2;
      filter: drop-shadow(-0.04em 0 0.14em rgba(62, 230, 255, 0.85)) drop-shadow(0.04em 0 0.14em rgba(255, 61, 154, 0.75));
    }
    svg.t08 text.flat { stroke-opacity: 0; }
  </style>
`;

export function shell(content: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" class="t08" viewBox="0 0 1280 720" preserveAspectRatio="xMidYMid meet">
  <defs>${COMMON_DEFS}</defs>
  ${TEXT_STYLE}
  ${BG_VECTOR}
  <!--BG_DEFAULT_SLOT-->
  <!--BG_OVERRIDE_SLOT-->
  ${content}
  <!--ICON_SLOT-->
</svg>`;
}

// ── 텍스트 프리미티브 ───────────────────────────────────────────────────────

/**
 * 자동 맞춤 표시 — 07/fit.ts 의 applyTextFit 이 실제 글자 폭을 추정해 maxW 안에 들어오도록 줄인다.
 * ellipsis=true 면 압축 대신 최소 크기에서 말줄임(…).
 */
export function fitAttr(maxW?: number, minRatio = 0.6, ellipsis = false): string {
  return maxW ? ` data-fit="${f(maxW)},${minRatio}${ellipsis ? ',t' : ''}"` : '';
}

/** 작은 시안 대문자 라벨 — CONTESTANT / COUPLE 같은 항목 이름. */
export function label(
  x: number,
  y: number,
  text: string,
  opts: {
    size?: number; fill?: string; anchor?: 'start' | 'middle' | 'end'; tracking?: number; weight?: number;
    fit?: number; fitMin?: number; ellipsis?: boolean;
  } = {}
): string {
  const { size = 12, fill = ACCENT, anchor = 'middle', tracking = 3, weight = 800 } = opts;
  return `<text${fitAttr(opts.fit, opts.fitMin, opts.ellipsis)} x="${f(x)}" y="${f(y)}" text-anchor="${anchor}" font-family="${DISPLAY}" font-weight="${weight}" font-size="${f(size)}" letter-spacing="${f(tracking)}" fill="${fill}">${text}</text>`;
}

/** 흰→시안 그라디언트 숫자 — 참가번호·순위·인덱스. */
export function accentNumber(
  x: number,
  y: number,
  text: string,
  size: number,
  anchor: 'start' | 'middle' | 'end' = 'middle',
  fit?: number
): string {
  return `<text class="num"${fitAttr(fit, 0.55)} x="${f(x)}" y="${f(y)}" text-anchor="${anchor}" font-family="${DISPLAY}" font-weight="900" font-size="${f(size)}" letter-spacing="${f(-size * 0.01)}" fill="url(#t08AccentNum)">${text}</text>`;
}

const RANK_SUFFIX: Record<1 | 2 | 3, string> = { 1: 'ST', 2: 'ND', 3: 'RD' };

/** 순위 표기 — 큰 숫자 + 위첨자 서수(1ST / 2ND / 3RD). */
export function rankMark(cx: number, y: number, rank: 1 | 2 | 3, size: number, fill = 'url(#t08AccentNum)'): string {
  return `<text class="num" x="${f(cx)}" y="${f(y)}" text-anchor="middle" font-family="${DISPLAY}" font-weight="900" fill="${fill}"><tspan font-size="${f(size)}">${rank}</tspan><tspan font-size="${f(size * 0.42)}" dx="2" dy="${f(-size * 0.4)}">${RANK_SUFFIX[rank]}</tspan></text>`;
}

/** 흰색 초굵은 텍스트 — 이름·값. */
export function strong(
  x: number,
  y: number,
  text: string,
  size: number,
  opts: {
    anchor?: 'start' | 'middle' | 'end'; fill?: string; tracking?: number; weight?: number; cls?: string;
    fit?: number; fitMin?: number; ellipsis?: boolean;
  } = {}
): string {
  const { anchor = 'middle', fill = WHITE, tracking = 0.3, weight = 800, cls } = opts;
  return `<text${cls ? ` class="${cls}"` : ''}${fitAttr(opts.fit, opts.fitMin, opts.ellipsis)} x="${f(x)}" y="${f(y)}" text-anchor="${anchor}" font-family="${DISPLAY}" font-weight="${weight}" font-size="${f(size)}" letter-spacing="${f(tracking)}" fill="${fill}">${text}</text>`;
}

/** 대형 제목 + 부제 — 화면 상단 중앙 헤더. sub 에는 <tspan> 마크업을 넣을 수 있다. */
export function heading(
  title: string,
  sub: string,
  opts: { titleY?: number; subY?: number; size?: number } = {}
): string {
  const { titleY = 120, subY = 150, size = 40 } = opts;
  return `
    ${strong(CX, titleY, title, size, { cls: 'hero', weight: 900, tracking: 1, fit: 1100 })}
    <text${fitAttr(1100)} x="${CX}" y="${subY}" text-anchor="middle" font-family="${DISPLAY}" font-weight="800" font-size="14" letter-spacing="4" fill="${SOFT}">${sub}</text>
  `;
}

// ── 면 프리미티브 ───────────────────────────────────────────────────────────

/** 좌상·우하 모서리를 c 만큼 사선으로 깎은 사각 — 08 의 기본 윤곽. */
function chamfer(x: number, y: number, w: number, h: number, c: number): string {
  return `M ${f(x + c)} ${f(y)} H ${f(x + w)} V ${f(y + h - c)} L ${f(x + w - c)} ${f(y + h)} H ${f(x)} V ${f(y + c)} Z`;
}

/**
 * 네온 카드 — 08 의 기본 면. rx 는 07 과의 호환용으로 받아 모서리 컷 크기로 쓴다.
 * hero: 1위 등 주인공 카드. 시안→마젠타 테두리 + 뒤에서 번지는 네온 글로우(블러는 이 카드에만 쓴다).
 */
export function neonCard(
  x: number,
  y: number,
  w: number,
  h: number,
  opts: { rx?: number; hero?: boolean } = {}
): string {
  const { rx = 18, hero = false } = opts;
  const c = Math.max(0, Math.min(Math.max(6, rx * 0.8), h * 0.3, w * 0.3));
  const d = chamfer(x, y, w, h, c);
  const glow = hero
    ? `<path d="${d}" fill="none" stroke="${ACCENT}" stroke-width="8" stroke-opacity="0.5" filter="url(#t08Soft)"/>`
    : '';
  const tick = Math.max(2, Math.min(3, h * 0.05));
  return `
    <g>
      ${glow}
      <path d="${d}" fill="url(#t08CardFill)" stroke="${hero ? 'url(#t08AccentStroke)' : 'url(#t08CardStroke)'}" stroke-width="${hero ? 2.4 : 1.3}"/>
      <path d="${chamfer(x + 1.5, y + 1.5, w - 3, h - 3, Math.max(0, c - 1))}" fill="url(#t08CardSheen)"/>
      <line x1="${f(x)}" y1="${f(y + c)}" x2="${f(x + c)}" y2="${f(y)}" stroke="${ACCENT}" stroke-width="${f(tick)}" stroke-linecap="round"/>
      <line x1="${f(x + w - c)}" y1="${f(y + h)}" x2="${f(x + w)}" y2="${f(y + h - c)}" stroke="${LEAD}" stroke-width="${f(tick)}" stroke-linecap="round"/>
    </g>`;
}

/** 화면 폭을 가로지르는 넓은 네온 띠 — OPEN/LIVE/CALC/CLOSE 의 무대. 상단 중앙에 시안→마젠타 하이라이트. */
export function stageBand(y: number, h: number, hero = false): string {
  return `
    ${neonCard(MX, y, RX - MX, h, { rx: 26, hero })}
    <rect x="${CX - 200}" y="${f(y - 0.5)}" width="400" height="2.5" fill="url(#t08RuleH)"/>
  `;
}

/**
 * 구분선 + 가운데 사선 두 줄(시안 / 마젠타) — "//" 모티프.
 * 선은 얇은 <rect fill=gradient> 로 그린다 — 수평 <line> 은 bbox 높이가 0 이라 그라디언트가 칠해지지 않는다.
 */
export function accentRule(y: number, half = 220, cx = CX): string {
  return `
    <g transform="translate(${f(cx)} ${f(y)})">
      <rect x="${f(-half)}" y="-1" width="${f(half * 2)}" height="2" fill="url(#t08RuleH)"/>
      <path d="M -7 7 L -1 -7 L 3 -7 L -3 7 Z" fill="${ACCENT}"/>
      <path d="M 3 7 L 9 -7 L 13 -7 L 7 7 Z" fill="${LEAD}"/>
    </g>`;
}

/** 역할 알약 — 리더(마젠타)/팔로워(스카이) 라벨. 사선으로 기운 평행사변형. */
export function rolePill(
  cx: number,
  cy: number,
  text: string,
  role: Role,
  opts: { w?: number; h?: number; size?: number; tracking?: number } = {}
): string {
  const { w = 120, h = 26, size = 12, tracking = 3 } = opts;
  const s = h * 0.35;
  const x0 = cx - w / 2;
  const y0 = cy - h / 2;
  return `
    <g>
      <path d="M ${f(x0 + s)} ${f(y0)} H ${f(x0 + w)} L ${f(x0 + w - s)} ${f(y0 + h)} H ${f(x0)} Z" fill="${ROLE_FILL[role]}"/>
      <text class="flat" x="${f(cx + tracking / 2)}" y="${f(cy + size * 0.36)}" text-anchor="middle" font-family="${DISPLAY}"
        font-weight="900" font-size="${f(size)}" letter-spacing="${f(tracking)}" fill="${NIGHT}">${text}</text>
    </g>`;
}

/** 이름 앞에 붙는 L / F 사각 칩. baseline 은 옆에 오는 글자의 baseline. */
export function roleChip(x: number, baseline: number, role: Role, size: number): string {
  const s = size * 0.86;
  const y = baseline - size * 0.76;
  const k = s * 0.25;
  return `
    <g>
      <path d="M ${f(x + k)} ${f(y)} H ${f(x + s)} L ${f(x + s - k)} ${f(y + s)} H ${f(x)} Z" fill="${ROLE_FILL[role]}"/>
      <text class="flat" x="${f(x + s / 2)}" y="${f(y + s * 0.72)}" text-anchor="middle" font-family="${DISPLAY}"
        font-weight="900" font-size="${f(s * 0.62)}" fill="${NIGHT}">${role}</text>
    </g>`;
}

/**
 * 사진 프레임 — 좌상·우하를 깎은 사각 + 옅은 시안 테두리.
 * 사진이 없으면 인물 실루엣이 옅게 남아 빈 슬롯도 "사람 자리"로 읽힌다.
 * href 가 '' 이면 <image> 자체를 생략한다 (href="" 는 문서 URL 을 다시 요청한다).
 * href 는 호출 측에서 속성용으로 이스케이프해 넘긴다.
 */
export function photoFrame(
  x: number,
  y: number,
  w: number,
  h: number,
  href: string,
  opts: { rx?: number; ring?: string; ringW?: number } = {}
): string {
  const { rx = 10, ring = FRAME, ringW = 2.4 } = opts;
  const id = svgId('t08ph', x, y, w, h);
  const s = Math.min(w, h);
  const c = Math.min(rx * 1.3, s * 0.2);
  const d = chamfer(x, y, w, h, c);
  const hx = x + w / 2;
  const image = href
    ? `<image href="${href}" x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id})"/>`
    : '';
  return `
    <g>
      <defs><clipPath id="${id}"><path d="${d}"/></clipPath></defs>
      <path d="${d}" fill="url(#t08PhotoBg)"/>
      <g clip-path="url(#${id})" fill="#FFFFFF" fill-opacity="0.13">
        <circle cx="${f(hx)}" cy="${f(y + h * 0.42)}" r="${f(s * 0.19)}"/>
        <ellipse cx="${f(hx)}" cy="${f(y + h + s * 0.12)}" rx="${f(s * 0.42)}" ry="${f(s * 0.38)}"/>
      </g>
      ${image}
      <path d="${d}" fill="none" stroke="${ring}" stroke-width="${ringW}"/>
    </g>`;
}

/** 사각 영역 밖으로 넘치는 글자(긴 이름 등)를 잘라낸다. */
export function clipBox(x: number, y: number, w: number, h: number, inner: string): string {
  const id = svgId('t08cl', x, y, w, h);
  return `<defs><clipPath id="${id}"><rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}"/></clipPath></defs><g clip-path="url(#${id})">${inner}</g>`;
}

/** 등장 — 빛줄기 방향(좌하→제자리)으로 사선을 그리며 나타난다. */
export function fadeUp(delay: number, inner: string, dy = 16): string {
  const b = `${delay.toFixed(2)}s`;
  const dx = -dy * 0.55;
  return `
    <g opacity="0">
      <animate attributeName="opacity" values="0;1" dur="0.5s" begin="${b}" fill="freeze"/>
      <g transform="translate(${f(dx)} ${dy})">
        <animateTransform attributeName="transform" type="translate" values="${f(dx)} ${dy};0 0" keyTimes="0;1"
          calcMode="spline" keySplines="0.2 0.8 0.2 1" dur="0.6s" begin="${b}" fill="freeze"/>
        ${inner}
      </g>
    </g>`;
}

/** 4갈래 반짝이. */
export function sparkle(cx: number, cy: number, r: number, fill = ACCENT): string {
  const k = r * 0.22;
  return `<path d="M ${f(cx)} ${f(cy - r)} Q ${f(cx + k)} ${f(cy - k)} ${f(cx + r)} ${f(cy)} Q ${f(cx + k)} ${f(cy + k)} ${f(cx)} ${f(cy + r)} Q ${f(cx - k)} ${f(cy + k)} ${f(cx - r)} ${f(cy)} Q ${f(cx - k)} ${f(cy - k)} ${f(cx)} ${f(cy - r)} Z" fill="${fill}"/>`;
}

// ── 러너 (상단/하단) ────────────────────────────────────────────────────────

/** "● OFFICIAL LIVE DISPLAY" 사선 외곽선 뱃지 — 우상단 방송 뱃지. */
function liveDisplayPill(rightX: number, cy: number): string {
  const w = 280;
  const h = 34;
  const x = rightX - w;
  const s = h * 0.4;
  return `
    <g>
      <path d="M ${f(x + s)} ${f(cy - h / 2)} H ${f(rightX)} L ${f(rightX - s)} ${f(cy + h / 2)} H ${f(x)} Z" fill="${NIGHT}" fill-opacity="0.45"
        stroke="url(#t08AccentStroke)" stroke-width="1.5"/>
      <circle cx="${x + 30}" cy="${cy}" r="5" fill="${LIVE_GREEN}">
        <animate attributeName="opacity" values="1;0.25;1" dur="1.4s" repeatCount="indefinite"/>
      </circle>
      <text x="${x + 44}" y="${f(cy + 4.3)}" font-family="${DISPLAY}" font-weight="800" font-size="12"
        letter-spacing="2.2" fill="${WHITE}">OFFICIAL LIVE DISPLAY</text>
    </g>`;
}

/** 상단 러너 — 사선 두 줄(시안/마젠타) + 대회명(좌) · 라이브 뱃지(우). 대회명이 길면 말줄임. */
export function topBar(): string {
  return `
    ${clipBox(MX, 22, 420, 44, `
      <path d="M ${MX + 6} ${HEAD_Y - 15} h 5 l -6 19 h -5 Z" fill="${ACCENT}"/>
      <path d="M ${MX + 14} ${HEAD_Y - 15} h 5 l -6 19 h -5 Z" fill="${LEAD}"/>
      <text${fitAttr(394, 0.72, true)} x="${MX + 26}" y="${HEAD_Y}" font-family="${DISPLAY}" font-weight="800" font-size="15"
        letter-spacing="2.4" fill="${WHITE}">{{festival_header}}</text>
    `)}
    ${liveDisplayPill(RX, HEAD_Y - 5)}
  `;
}

/**
 * 스폰서 로고 6슬롯 — 하단 중앙.
 * 박스 100×34, 간격 12 → 총 폭 660 (x 310~970). 좌측 태그라인(~296)·우측 LIVE(1180~) 와 겹치지 않는다.
 */
export function sponsorRow(cy = FOOT_Y - 10, boxW = 100, boxH = 34, gap = 12): string {
  const total = 6 * boxW + 5 * gap;
  const startX = CX - total / 2;
  let body = '';
  for (let i = 0; i < 6; i++) {
    const x = startX + i * (boxW + gap);
    body += `<image href="{{sponsor_logo_${i + 1}}}" x="${x}" y="${cy - boxH / 2}" width="${boxW}" height="${boxH}" preserveAspectRatio="xMidYMid meet" opacity="{{sponsor_opacity_${i + 1}}}"/>`;
  }
  return `<g>${body}</g>`;
}

/** 하단 러너 — 태그라인(좌) · 스폰서(중앙, finish.ts 가 채움) · ● LIVE(우). */
export function footBar(): string {
  return `
    ${clipBox(MX, FOOT_Y - 22, 264, 32, `
      <text${fitAttr(258, 0.8, true)} x="${MX + 2}" y="${FOOT_Y}" font-family="${DISPLAY}" font-weight="800" font-size="12.5"
        letter-spacing="1.6" fill="${WHITE}" opacity="0.92">{{tagline}}</text>
    `)}
    ${sponsorRow()}
    <g>
      <circle cx="${RX - 58}" cy="${FOOT_Y - 5}" r="5.5" fill="${LIVE_GREEN}">
        <animate attributeName="opacity" values="1;0.3;1" dur="1.4s" repeatCount="indefinite"/>
      </circle>
      <text x="${RX}" y="${FOOT_Y}" text-anchor="end" font-family="${DISPLAY}" font-weight="900" font-size="15"
        letter-spacing="2" fill="${LIVE_GREEN}">LIVE</text>
    </g>
  `;
}
