// Template 09 — "SPOTLIGHT DUEL" (BATTLE_DASH_DB 09 이식 · 잭앤질 스텝 화면은 07 과 같다)
//
// 레퍼런스: 어두운 무대 좌우 천장에서 스포트라이트 두 개가 떨어지고, 가운데 은빛 사선 위에 크롬 "VS".
//  · 배경: 틸-차콜 바탕 위 좌(290)·우(990) 스포트라이트 — 천장 램프 섬광 + 가로 렌즈 플레어 +
//    아래로 퍼지는 부드러운 타원 광주 + 바닥에 떨어진 빛 웅덩이. 광주 안에 먼지가 천천히 떠오른다.
//    두 조명은 서로 다른 주기로 아주 미세하게 숨 쉰다. 이미지 파일 없이 벡터로만 그린다.
//  · 면: 장식을 덜어낸 반투명 차콜 패널 + 가는 실버 헤어라인 — 조명이 주인공이 되도록 면은 조용하게.
//  · 글자: 흰색 초굵은 산세리프. 대형 제목·숫자는 이탤릭 크롬(흰→은→흰 금속 띠) + 차가운 은빛 번짐.
//  · 역할 색: 리더 = 실버, 팔로워 = 아이스 블루 — 무채색 무대에서 두 역할이 온도로 갈린다.
//  · 모티프: 가운데 은빛 사선(바늘) — 구분선·상단 러너·대진 화면의 VS 에 반복된다.
//
// 화면 레이아웃(svg/*)은 07 과 같다 — 프리미티브가 같은 시그니처를 가지므로 좌표는 그대로 두고
// 외형만 바뀐다. ACCENT 는 07 의 GOLD 자리(라벨·강조), hero 옵션은 주인공 카드.
import { svgId } from '../shared/svgId';

// ── 팔레트 ──────────────────────────────────────────────────────────────────
export const NIGHT = '#050E13';      // 가장 어두운 면 / 밝은 칩 위 글자
export const WHITE = '#FFFFFF';      // 제목·이름
export const SOFT = '#D5E1E8';       // 보조 텍스트
export const DIM = '#7D929D';        // 3차 텍스트
export const ACCENT = '#BFD3DE';     // 라벨·강조 — 실버 블루
export const ACCENT_PALE = '#EEF4F7';
export const LEAD = '#E3ECF1';       // 리더 — 실버
export const FOLLOW = '#62C6F2';     // 팔로워 — 아이스 블루
export const LIVE_GREEN = '#3DDC97';
export const FRAME = '#9DB3BF';      // 사진 테두리 — 은회색
export const SILVER = '#C9D6DD';     // 2위
export const BRONZE = '#D9A273';     // 3위

// ── 폰트 ────────────────────────────────────────────────────────────────────
// Montserrat(이탤릭 포함)는 app/layout.tsx 와 TemplatePicker iframe 에서 로드. 한글은 Malgun Gothic 폴백.
export const DISPLAY =
  "'Montserrat', 'Arial Black', 'Malgun Gothic', '맑은 고딕', 'Apple SD Gothic Neo', sans-serif";

// ── 좌표 ────────────────────────────────────────────────────────────────────
export const CX = 640;
export const MX = 32;
export const RX = 1248;
export const HEAD_Y = 52;   // 상단 러너 baseline
export const FOOT_Y = 694;  // 하단 러너 baseline
const SPOT_X = [290, 990] as const;

/** 좌표 문자열 — 소수 1자리. */
export const f = (n: number): string => String(Math.round(n * 10) / 10);

export type Role = 'L' | 'F';
export const ROLE_FILL: Record<Role, string> = { L: 'url(#t09Lead)', F: 'url(#t09Follow)' };
export const ROLE_COLOR: Record<Role, string> = { L: LEAD, F: FOLLOW };

export const pad2 = (n: number): string => String(n).padStart(2, '0');

/** 결정적 의사난수 — SSR/CSR·빌드마다 같은 결과. */
export function seeded(i: number): number {
  const x = Math.sin(i * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}


export const COMMON_DEFS = `
  <linearGradient id="t09BgBase" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#0F2530"/>
    <stop offset="0.55" stop-color="#0A1A22"/>
    <stop offset="1" stop-color="#050D12"/>
  </linearGradient>
  <radialGradient id="t09BgGlow" cx="0.5" cy="0.55" r="0.6">
    <stop offset="0" stop-color="#1B3844" stop-opacity="0.5"/>
    <stop offset="1" stop-color="#0A1A22" stop-opacity="0"/>
  </radialGradient>
  <!-- 광주: 화면 위로 넘치는 큰 타원의 램프 높이(bbox y≈0.31)에 중심을 둔다. offset 0.85 에서 0 이 되게 해
       화면 안에 걸리는 타원 경계(offset ≥ 0.88)가 보이지 않는다. -->
  <radialGradient id="t09Beam" cx="0.5" cy="0.309" r="0.5" fx="0.5" fy="0.309">
    <stop offset="0" stop-color="#DCEBF2" stop-opacity="0.28"/>
    <stop offset="0.25" stop-color="#C6D9E2" stop-opacity="0.16"/>
    <stop offset="0.5" stop-color="#9FB7C3" stop-opacity="0.07"/>
    <stop offset="0.75" stop-color="#8FA9B6" stop-opacity="0.02"/>
    <stop offset="0.85" stop-color="#8FA9B6" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="t09Pool" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0" stop-color="#CFE2EA" stop-opacity="0.14"/>
    <stop offset="1" stop-color="#CFE2EA" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="t09Flare" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#FFFFFF" stop-opacity="0"/>
    <stop offset="0.5" stop-color="#FFFFFF" stop-opacity="0.9"/>
    <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
  </linearGradient>
  <radialGradient id="t09Lamp" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0" stop-color="#FFFFFF" stop-opacity="1"/>
    <stop offset="0.5" stop-color="#E8F6FF" stop-opacity="0.9"/>
    <stop offset="1" stop-color="#BFE6FF" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="t09Floor" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#BFD3DE" stop-opacity="0"/>
    <stop offset="0.55" stop-color="#BFD3DE" stop-opacity="0.07"/>
    <stop offset="1" stop-color="#BFD3DE" stop-opacity="0"/>
  </linearGradient>
  <radialGradient id="t09Vignette" cx="0.5" cy="0.5" r="0.75">
    <stop offset="0.55" stop-color="#02070A" stop-opacity="0"/>
    <stop offset="1" stop-color="#02070A" stop-opacity="0.7"/>
  </radialGradient>
  <linearGradient id="t09Needle" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#FFFFFF" stop-opacity="0"/>
    <stop offset="0.5" stop-color="#FFFFFF" stop-opacity="1"/>
    <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
  </linearGradient>

  <linearGradient id="t09CardFill" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#12272F" stop-opacity="0.74"/>
    <stop offset="1" stop-color="#08151B" stop-opacity="0.82"/>
  </linearGradient>
  <linearGradient id="t09CardStroke" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#D8E5EC" stop-opacity="0.5"/>
    <stop offset="1" stop-color="#5A717C" stop-opacity="0.18"/>
  </linearGradient>
  <linearGradient id="t09CardSheen" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.07"/>
    <stop offset="0.3" stop-color="#FFFFFF" stop-opacity="0.015"/>
    <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="t09HeroStroke" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#FFFFFF"/>
    <stop offset="1" stop-color="#8EA6B2"/>
  </linearGradient>
  <linearGradient id="t09Hair" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#FFFFFF" stop-opacity="0"/>
    <stop offset="0.5" stop-color="#FFFFFF" stop-opacity="0.55"/>
    <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="t09AccentStroke" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#FFFFFF"/>
    <stop offset="0.5" stop-color="#C9D8E0"/>
    <stop offset="1" stop-color="#7E97A3"/>
  </linearGradient>
  <linearGradient id="t09AccentNum" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#FFFFFF"/>
    <stop offset="0.46" stop-color="#E9F1F5"/>
    <stop offset="0.5" stop-color="#A9BDC8"/>
    <stop offset="0.66" stop-color="#D6E2E8"/>
    <stop offset="1" stop-color="#FFFFFF"/>
  </linearGradient>
  <linearGradient id="t09PhotoBg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#1A313B"/>
    <stop offset="1" stop-color="#0B181E"/>
  </linearGradient>
  <linearGradient id="t09Lead" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#F7FAFB"/>
    <stop offset="1" stop-color="#B7C7D0"/>
  </linearGradient>
  <linearGradient id="t09Follow" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#A5E3FF"/>
    <stop offset="1" stop-color="#3FA9DC"/>
  </linearGradient>
  <linearGradient id="t09LiveRed" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#FF4F7E"/>
    <stop offset="1" stop-color="#D3134C"/>
  </linearGradient>
  <linearGradient id="t09RuleH" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="${ACCENT}" stop-opacity="0"/>
    <stop offset="0.5" stop-color="${ACCENT_PALE}" stop-opacity="0.9"/>
    <stop offset="1" stop-color="${ACCENT}" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="t09RuleV" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${ACCENT}" stop-opacity="0"/>
    <stop offset="0.5" stop-color="${ACCENT_PALE}" stop-opacity="0.55"/>
    <stop offset="1" stop-color="${ACCENT}" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="t09Shine" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#FFFFFF" stop-opacity="0"/>
    <stop offset="0.5" stop-color="#FFFFFF" stop-opacity="0.85"/>
    <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="t09Eq" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#FFFFFF"/>
    <stop offset="0.5" stop-color="#BFD3DE"/>
    <stop offset="1" stop-color="#62C6F2"/>
  </linearGradient>
  <filter id="t09Soft" x="-20%" y="-20%" width="140%" height="140%">
    <feGaussianBlur stdDeviation="9"/>
  </filter>
  <filter id="t09Glint" x="-200%" y="-200%" width="500%" height="500%">
    <feGaussianBlur stdDeviation="2.5" result="b"/>
    <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <!-- shared/ 모듈(judgesIntro·judgesVideo·reportSvg)이 참조하는 공용 id 를 09 팔레트로 정의 -->
  <linearGradient id="goldg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#FFFFFF"/>
    <stop offset="0.46" stop-color="#E9F1F5"/>
    <stop offset="0.5" stop-color="#A9BDC8"/>
    <stop offset="0.66" stop-color="#D6E2E8"/>
    <stop offset="1" stop-color="#FFFFFF"/>
  </linearGradient>
  <linearGradient id="goldgh" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="${ACCENT}" stop-opacity="0"/>
    <stop offset="0.5" stop-color="${ACCENT}" stop-opacity="0.9"/>
    <stop offset="1" stop-color="${ACCENT}" stop-opacity="0"/>
  </linearGradient>
  <radialGradient id="hxg" cx="0.5" cy="0.4" r="0.6">
    <stop offset="0" stop-color="#1A313B"/>
    <stop offset="1" stop-color="#0B181E"/>
  </radialGradient>
`;

/** 벡터 바탕 — 틸-차콜 + 무대 가운데의 옅은 반사광. 커스텀 배경이 반투명일 때도 비친다. */
export const BG_VECTOR = `
  <rect x="0" y="0" width="1280" height="720" fill="url(#t09BgBase)"/>
  <rect x="0" y="0" width="1280" height="720" fill="url(#t09BgGlow)"/>
`;

/** 천장 스포트라이트 한 개 — 램프 섬광 · 가로 렌즈 플레어 · 타원 광주 · 바닥 빛 웅덩이. k 로 숨 쉬는 주기를 어긋나게 한다. */
function spotlight(x: number, k: number): string {
  const dur = (7 + k * 1.7).toFixed(1);
  return `
    <g>
      <animate attributeName="opacity" values="0.86;1;0.9;1;0.86" dur="${dur}s" repeatCount="indefinite"/>
      <ellipse cx="${x}" cy="260" rx="290" ry="560" fill="url(#t09Beam)"/>
      <ellipse cx="${x}" cy="612" rx="300" ry="46" fill="url(#t09Pool)"/>
      <rect x="${x - 260}" y="44.5" width="520" height="2" fill="url(#t09Flare)"/>
      <ellipse cx="${x}" cy="46" rx="62" ry="5.5" fill="url(#t09Lamp)"/>
    </g>`;
}

/** 광주 안에서 천천히 떠오르는 먼지 — 조명이 "공기 중에 떨어지고 있다"는 감각. */
function dust(): string {
  let body = '';
  for (let i = 0; i < 26; i++) {
    const x = SPOT_X[i % 2] + (seeded(i + 1) - 0.5) * 360;
    const y0 = 700 - seeded(i + 40) * 300;
    const rise = 160 + seeded(i + 80) * 220;
    const r = 0.8 + seeded(i + 120) * 1.6;
    const dur = (9 + seeded(i + 160) * 8).toFixed(2);
    const begin = (-seeded(i + 200) * Number(dur)).toFixed(2);
    const op = (0.25 + seeded(i + 240) * 0.35).toFixed(2);
    body += `
      <circle cx="${f(x)}" cy="${f(y0)}" r="${f(r)}" fill="#E6F3FA" opacity="0">
        <animate attributeName="cy" values="${f(y0)};${f(y0 - rise)}" dur="${dur}s" begin="${begin}s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0;${op};${op};0" keyTimes="0;0.2;0.8;1" dur="${dur}s" begin="${begin}s" repeatCount="indefinite"/>
      </circle>`;
  }
  return body;
}

/** 기본 배경 — 좌우 스포트라이트 + 바닥 수평광 + 먼지 + 비네트. 커스텀 배경이 없을 때만 깐다. */
export const BG_LAYER = `
  ${SPOT_X.map((x, k) => spotlight(x, k)).join('')}
  <rect x="0" y="500" width="1280" height="130" fill="url(#t09Floor)"/>
  ${dust()}
  <rect x="0" y="0" width="1280" height="720" fill="url(#t09Vignette)"/>
`;

/** 커스텀 배경 위 스크림 — 흰 글자가 밝은 사진에 묻히지 않도록 차콜로 누른다. */
export const OVERRIDE_SCRIM = `
  <rect x="0" y="0" width="1280" height="720" fill="${NIGHT}" fill-opacity="0.52"/>
  <rect x="0" y="0" width="1280" height="720" fill="url(#t09BgGlow)" opacity="0.5"/>
`;

/**
 * 09 의 가독성 규칙.
 *  · 기본: 얇은 어두운 외곽선.
 *  · .num  : 크롬 숫자 — 이탤릭 + 차가운 은빛 번짐.
 *  · .hero : 대형 제목 — 이탤릭 + 아래로 떨어지는 그림자와 은빛 후광 (조명을 받은 금속).
 *  · .flat : 밝은 칩(실버/아이스) 위 어두운 글자 — 외곽선을 끈다.
 */
export const TEXT_STYLE = `
  <style>
    svg.t09 text {
      paint-order: stroke fill;
      stroke: #02070A;
      stroke-opacity: 0.4;
      stroke-width: max(1px, 0.03em);
      stroke-linejoin: round;
    }
    svg.t09 text.num {
      font-style: italic;
      stroke: #02070A;
      stroke-opacity: 0.5;
      filter: drop-shadow(0 0.04em 0.02em rgba(0, 0, 0, 0.55)) drop-shadow(0 0 0.2em rgba(190, 230, 255, 0.4));
    }
    svg.t09 text.hero {
      font-style: italic;
      stroke-opacity: 0.2;
      filter: drop-shadow(0 0.04em 0.03em rgba(0, 0, 0, 0.6)) drop-shadow(0 0 0.32em rgba(170, 215, 240, 0.45));
    }
    svg.t09 text.flat { stroke-opacity: 0; }
  </style>
`;

export function shell(content: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" class="t09" viewBox="0 0 1280 720" preserveAspectRatio="xMidYMid meet">
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

/** 작은 실버 대문자 라벨 — CONTESTANT / COUPLE 같은 항목 이름. */
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

/** 크롬 숫자 — 참가번호·순위·인덱스. */
export function accentNumber(
  x: number,
  y: number,
  text: string,
  size: number,
  anchor: 'start' | 'middle' | 'end' = 'middle',
  fit?: number
): string {
  return `<text class="num"${fitAttr(fit, 0.55)} x="${f(x)}" y="${f(y)}" text-anchor="${anchor}" font-family="${DISPLAY}" font-weight="900" font-size="${f(size)}" letter-spacing="${f(-size * 0.01)}" fill="url(#t09AccentNum)">${text}</text>`;
}

const RANK_SUFFIX: Record<1 | 2 | 3, string> = { 1: 'ST', 2: 'ND', 3: 'RD' };

/** 순위 표기 — 큰 숫자 + 위첨자 서수(1ST / 2ND / 3RD). */
export function rankMark(cx: number, y: number, rank: 1 | 2 | 3, size: number, fill = 'url(#t09AccentNum)'): string {
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

/** 대형 크롬 제목 + 부제 — 화면 상단 중앙 헤더. sub 에는 <tspan> 마크업을 넣을 수 있다. */
export function heading(
  title: string,
  sub: string,
  opts: { titleY?: number; subY?: number; size?: number } = {}
): string {
  const { titleY = 120, subY = 150, size = 40 } = opts;
  return `
    ${strong(CX, titleY, title, size, { cls: 'hero', weight: 900, tracking: 1, fit: 1100, fill: 'url(#t09AccentNum)' })}
    <text${fitAttr(1100)} x="${CX}" y="${subY}" text-anchor="middle" font-family="${DISPLAY}" font-weight="800" font-size="14" letter-spacing="4" fill="${SOFT}">${sub}</text>
  `;
}

// ── 면 프리미티브 ───────────────────────────────────────────────────────────

/**
 * 패널 카드 — 09 의 기본 면. 반투명 차콜 + 가는 실버 테두리 + 상단 헤어라인 하이라이트.
 * rx 는 07 과의 호환용 — 09 는 모서리를 작게(최대 8) 눌러 단정하게 쓴다.
 * hero: 1위 등 주인공 카드. 흰→은 테두리 + 뒤에서 번지는 은빛 후광(블러는 이 카드에만 쓴다).
 */
export function panelCard(
  x: number,
  y: number,
  w: number,
  h: number,
  opts: { rx?: number; hero?: boolean } = {}
): string {
  const { rx = 18, hero = false } = opts;
  const r = Math.min(rx * 0.35, 8, h / 2, w / 2);
  const glow = hero
    ? `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${f(r)}" fill="none" stroke="#DDEBF2" stroke-width="8" stroke-opacity="0.3" filter="url(#t09Soft)"/>`
    : '';
  const inset = Math.min(w * 0.18, 60);
  return `
    <g>
      ${glow}
      <rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${f(r)}" fill="url(#t09CardFill)"
        stroke="${hero ? 'url(#t09HeroStroke)' : 'url(#t09CardStroke)'}" stroke-width="${hero ? 2 : 1.1}"/>
      <rect x="${f(x + 1)}" y="${f(y + 1)}" width="${f(w - 2)}" height="${f(h - 2)}" rx="${f(Math.max(0, r - 1))}" fill="url(#t09CardSheen)"/>
      <rect x="${f(x + inset)}" y="${f(y - 0.5)}" width="${f(w - inset * 2)}" height="1.2" fill="url(#t09Hair)"/>
    </g>`;
}

/** 화면 폭을 가로지르는 넓은 패널 — OPEN/LIVE/CALC/CLOSE 의 무대. */
export function stageBand(y: number, h: number, hero = false): string {
  return `
    ${panelCard(MX, y, RX - MX, h, { rx: 26, hero })}
    <rect x="${CX - 200}" y="${f(y - 0.5)}" width="400" height="2" fill="url(#t09RuleH)"/>
  `;
}

/** 가운데 폭이 가장 넓고 양 끝이 뾰족한 은빛 바늘 — (x1,y1)→(x2,y2), 가운데 폭 w. */
function needle(x1: number, y1: number, x2: number, y2: number, w: number): string {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  return `${f(x1)},${f(y1)} ${f(mx + w)},${f(my)} ${f(x2)},${f(y2)} ${f(mx - w)},${f(my)}`;
}

/** 구분선 + 가운데 짧은 은빛 사선 바늘. 선은 얇은 <rect fill=gradient> (수평 <line> 은 그라디언트가 칠해지지 않는다). */
export function accentRule(y: number, half = 220, cx = CX): string {
  return `
    <g>
      <rect x="${f(cx - half)}" y="${f(y - 0.6)}" width="${f(half * 2)}" height="1.2" fill="url(#t09RuleH)"/>
      <polygon points="${needle(cx + 6, y - 15, cx - 6, y + 15, 1.8)}" fill="#FFFFFF" filter="url(#t09Glint)"/>
    </g>`;
}

/**
 * 대결 화면의 VS — 은빛 사선 바늘 위에 크롬 V(좌상)·S(우하).
 * 바늘을 따라 작은 섬광이 위에서 아래로 반복해서 흘러내린다.
 */
export function vsSlash(cx: number, cy: number, reach = 200, size = 96): string {
  const dx = reach * 0.36;
  const pts = needle(cx + dx, cy - reach, cx - dx, cy + reach, 4.5);
  return `
    <g>
      <polygon points="${pts}" fill="#9FDBFF" opacity="0.5" filter="url(#t09Soft)"/>
      <polygon points="${pts}" fill="url(#t09Needle)"/>
      <circle r="4.5" fill="#FFFFFF" filter="url(#t09Glint)" opacity="0">
        <animateMotion path="M ${f(cx + dx)} ${f(cy - reach)} L ${f(cx - dx)} ${f(cy + reach)}" dur="2.8s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.2;0.8;1" dur="2.8s" repeatCount="indefinite"/>
      </circle>
      ${accentNumber(cx - size * 0.3, cy + size * 0.06, 'V', size)}
      ${accentNumber(cx + size * 0.3, cy + size * 0.5, 'S', size)}
    </g>`;
}

/** 역할 알약 — 리더(실버)/팔로워(아이스). 모서리를 조금만 둥글린 납작한 태그. */
export function rolePill(
  cx: number,
  cy: number,
  text: string,
  role: Role,
  opts: { w?: number; h?: number; size?: number; tracking?: number } = {}
): string {
  const { w = 120, h = 26, size = 12, tracking = 3 } = opts;
  return `
    <g>
      <rect x="${f(cx - w / 2)}" y="${f(cy - h / 2)}" width="${f(w)}" height="${f(h)}" rx="${f(Math.min(4, h / 2))}" fill="${ROLE_FILL[role]}"/>
      <text class="flat" x="${f(cx + tracking / 2)}" y="${f(cy + size * 0.36)}" text-anchor="middle" font-family="${DISPLAY}"
        font-weight="900" font-size="${f(size)}" letter-spacing="${f(tracking)}" fill="${NIGHT}">${text}</text>
    </g>`;
}

/** 이름 앞에 붙는 L / F 사각 칩. baseline 은 옆에 오는 글자의 baseline. */
export function roleChip(x: number, baseline: number, role: Role, size: number): string {
  const s = size * 0.86;
  const y = baseline - size * 0.76;
  return `
    <g>
      <rect x="${f(x)}" y="${f(y)}" width="${f(s)}" height="${f(s)}" rx="${f(s * 0.12)}" fill="${ROLE_FILL[role]}"/>
      <text class="flat" x="${f(x + s / 2)}" y="${f(y + s * 0.72)}" text-anchor="middle" font-family="${DISPLAY}"
        font-weight="900" font-size="${f(s * 0.62)}" fill="${NIGHT}">${role}</text>
    </g>`;
}

/**
 * 사진 프레임 — 작은 라운드 사각 + 은회색 테두리 + 위에서 조명을 받은 듯한 상단 하이라이트.
 * 사진이 없으면 인물 실루엣이 옅게 남아 빈 슬롯도 "사람 자리"로 읽힌다.
 * href 가 '' 이면 <image> 자체를 생략한다 (href="" 는 문서 URL 을 다시 요청한다).
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
  const id = svgId('t09ph', x, y, w, h);
  const s = Math.min(w, h);
  const r = Math.min(rx * 0.5, 6);
  const hx = x + w / 2;
  const image = href
    ? `<image href="${href}" x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id})"/>`
    : '';
  return `
    <g>
      <defs><clipPath id="${id}"><rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${f(r)}"/></clipPath></defs>
      <rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${f(r)}" fill="url(#t09PhotoBg)"/>
      <g clip-path="url(#${id})" fill="#FFFFFF" fill-opacity="0.12">
        <circle cx="${f(hx)}" cy="${f(y + h * 0.42)}" r="${f(s * 0.19)}"/>
        <ellipse cx="${f(hx)}" cy="${f(y + h + s * 0.12)}" rx="${f(s * 0.42)}" ry="${f(s * 0.38)}"/>
      </g>
      ${image}
      <rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${f(r)}" fill="none" stroke="${ring}" stroke-width="${ringW}"/>
      <rect x="${f(x + w * 0.2)}" y="${f(y - 0.4)}" width="${f(w * 0.6)}" height="1.4" fill="url(#t09Hair)"/>
    </g>`;
}

/** 사각 영역 밖으로 넘치는 글자(긴 이름 등)를 잘라낸다. */
export function clipBox(x: number, y: number, w: number, h: number, inner: string): string {
  const id = svgId('t09cl', x, y, w, h);
  return `<defs><clipPath id="${id}"><rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}"/></clipPath></defs><g clip-path="url(#${id})">${inner}</g>`;
}

/** 등장 — 살짝 떠오르며 나타난다. */
export function fadeUp(delay: number, inner: string, dy = 16): string {
  const b = `${delay.toFixed(2)}s`;
  return `
    <g opacity="0">
      <animate attributeName="opacity" values="0;1" dur="0.6s" begin="${b}" fill="freeze"/>
      <g transform="translate(0 ${dy})">
        <animateTransform attributeName="transform" type="translate" values="0 ${dy};0 0" keyTimes="0;1"
          calcMode="spline" keySplines="0.2 0.8 0.2 1" dur="0.7s" begin="${b}" fill="freeze"/>
        ${inner}
      </g>
    </g>`;
}

/** 제목 뒤에서 천천히 도는 조명 방사선 (은빛). */
export function lightRays(cx: number, cy: number, count = 18, len = 820): string {
  const id = svgId('t09ray', cx, cy);
  let body = '';
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const spread = 0.055;
    const x1 = cx + Math.cos(a - spread) * len;
    const y1 = cy + Math.sin(a - spread) * len;
    const x2 = cx + Math.cos(a + spread) * len;
    const y2 = cy + Math.sin(a + spread) * len;
    body += `<polygon points="${f(cx)},${f(cy)} ${f(x1)},${f(y1)} ${f(x2)},${f(y2)}"/>`;
  }
  return `
    <defs>
      <radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${f(cx)}" cy="${f(cy)}" r="${len}">
        <stop offset="0" stop-color="#E6F1F6" stop-opacity="0.14"/>
        <stop offset="0.55" stop-color="#E6F1F6" stop-opacity="0.03"/>
        <stop offset="1" stop-color="#E6F1F6" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <g fill="url(#${id})">
      <animateTransform attributeName="transform" type="rotate" from="0 ${f(cx)} ${f(cy)}" to="360 ${f(cx)} ${f(cy)}" dur="120s" repeatCount="indefinite"/>
      ${body}
    </g>`;
}

/** 4갈래 반짝이 — 금속에 맺힌 빛. */
export function sparkle(cx: number, cy: number, r: number, fill = ACCENT_PALE): string {
  const k = r * 0.22;
  return `<path d="M ${f(cx)} ${f(cy - r)} Q ${f(cx + k)} ${f(cy - k)} ${f(cx + r)} ${f(cy)} Q ${f(cx + k)} ${f(cy + k)} ${f(cx)} ${f(cy + r)} Q ${f(cx - k)} ${f(cy + k)} ${f(cx - r)} ${f(cy)} Q ${f(cx - k)} ${f(cy - k)} ${f(cx)} ${f(cy - r)} Z" fill="${fill}"/>`;
}

// ── 러너 (상단/하단) ────────────────────────────────────────────────────────

/** "● OFFICIAL LIVE DISPLAY" 가는 실버 외곽선 뱃지 — 우상단 방송 뱃지. */
function liveDisplayPill(rightX: number, cy: number): string {
  const w = 272;
  const h = 32;
  const x = rightX - w;
  return `
    <g>
      <rect x="${x}" y="${cy - h / 2}" width="${w}" height="${h}" rx="4" fill="${NIGHT}" fill-opacity="0.4"
        stroke="url(#t09AccentStroke)" stroke-width="1.1"/>
      <circle cx="${x + 22}" cy="${cy}" r="4.5" fill="${LIVE_GREEN}">
        <animate attributeName="opacity" values="1;0.25;1" dur="1.4s" repeatCount="indefinite"/>
      </circle>
      <text x="${x + 36}" y="${f(cy + 4.3)}" font-family="${DISPLAY}" font-weight="800" font-size="12"
        letter-spacing="2.2" fill="${SOFT}">OFFICIAL LIVE DISPLAY</text>
    </g>`;
}

/** 상단 러너 — 은빛 바늘 + 대회명(좌) · 라이브 뱃지(우). 대회명이 길면 말줄임. */
export function topBar(): string {
  return `
    ${clipBox(MX, 22, 420, 44, `
      <polygon points="${needle(MX + 9, HEAD_Y - 17, MX + 1, HEAD_Y + 5, 1.6)}" fill="#FFFFFF"/>
      <text${fitAttr(400, 0.72, true)} x="${MX + 20}" y="${HEAD_Y}" font-family="${DISPLAY}" font-weight="800" font-size="15"
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
      <text${fitAttr(262, 0.8, true)} x="${MX}" y="${FOOT_Y}" font-family="${DISPLAY}" font-weight="800" font-size="12.5"
        letter-spacing="1.6" fill="${SOFT}" opacity="0.92">{{tagline}}</text>
    `)}
    ${sponsorRow()}
    <g>
      <circle cx="${RX - 58}" cy="${FOOT_Y - 5}" r="5" fill="${LIVE_GREEN}">
        <animate attributeName="opacity" values="1;0.3;1" dur="1.4s" repeatCount="indefinite"/>
      </circle>
      <text x="${RX}" y="${FOOT_Y}" text-anchor="end" font-family="${DISPLAY}" font-weight="900" font-size="15"
        letter-spacing="2" fill="${LIVE_GREEN}">LIVE</text>
    </g>
  `;
}
