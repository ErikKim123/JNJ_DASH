// Template 11 — "SOLAR SLASH" (BATTLE_DASH_DB 11 이식 · 잭앤질 스텝 화면은 07 과 같다)
//
// 레퍼런스: 거의 검은 틸 배경 한가운데를 주황-금빛 사선 광선이 가르고, 광선을 따라 가는 빛줄기가
// 머리카락처럼 흩어지며, 그 위에 어두운 실루엣 "VS"가 역광으로 떠오르는 대결 키 비주얼.
//  · 배경: 딥 틸-블랙 바탕 + 화면 중앙을 약 -68° 로 가르는 광선
//    (넓은 주황 헤이즈 → 밝은 금빛 번짐 → 흰-노랑 심지 + 광선과 평행한 가는 빛줄기 수십 가닥 + 떠오르는 불티).
//    광선은 천천히 숨 쉬고 빛줄기는 반짝이며 광선 방향으로 흐른다. 이미지 파일 없이 벡터로만 그린다.
//  · 면: 반투명 차콜-틸 패널 + 가는 앰버 헤어라인, 우상단에 짧은 사선 컷 — 광선 모티프를 모든 카드에 반복.
//  · 글자: 흰색 초굵은 산세리프 + 주황 역광 글로우. 숫자는 금빛→주황 그라디언트.
//  · 역할 색: 리더 = 오렌지, 팔로워 = 틸 — 광선 색과 배경 색.
//  · 대진 화면의 VS: 레퍼런스 그대로 광선 위 어두운 V·S + 앰버 윤곽.
//
// 화면 레이아웃(svg/*)은 07 과 같다 — 프리미티브가 같은 시그니처를 가지므로 좌표는 그대로 두고
// 외형만 바뀐다. ACCENT 는 07 의 GOLD 자리(라벨·강조), hero 옵션은 주인공 카드.
import { svgId } from '../shared/svgId';

// ── 팔레트 ──────────────────────────────────────────────────────────────────
export const NIGHT = '#020B0E';      // 가장 어두운 면 / 밝은 칩 위 글자
export const WHITE = '#FFFFFF';      // 제목·이름
export const SOFT = '#F1E4D0';       // 보조 텍스트 (웜 화이트)
export const DIM = '#8C9A9C';        // 3차 텍스트
export const ACCENT = '#FFB23F';     // 라벨·강조 — 앰버
export const ACCENT_PALE = '#FFE3A8';
export const LEAD = '#FF8A1F';       // 리더 — 오렌지
export const FOLLOW = '#3FC8D4';     // 팔로워 — 틸
export const LIVE_GREEN = '#3DDC97';
export const FRAME = '#D9A55A';      // 사진 테두리 — 웜 앰버
export const SILVER = '#D5DDE0';     // 2위
export const BRONZE = '#D98A4E';     // 3위

// ── 폰트 ────────────────────────────────────────────────────────────────────
// Montserrat 는 app/layout.tsx 와 TemplatePicker iframe 에서 로드. 한글은 Malgun Gothic 폴백.
export const DISPLAY =
  "'Montserrat', 'Arial Black', 'Malgun Gothic', '맑은 고딕', 'Apple SD Gothic Neo', sans-serif";

// ── 좌표 ────────────────────────────────────────────────────────────────────
export const CX = 640;
export const MX = 32;
export const RX = 1248;
export const HEAD_Y = 52;   // 상단 러너 baseline
export const FOOT_Y = 694;  // 하단 러너 baseline
const SLASH_ANGLE = -68;    // 광선 기울기 (도)

/** 좌표 문자열 — 소수 1자리. */
export const f = (n: number): string => String(Math.round(n * 10) / 10);

export type Role = 'L' | 'F';
export const ROLE_FILL: Record<Role, string> = { L: 'url(#t11Lead)', F: 'url(#t11Follow)' };
export const ROLE_COLOR: Record<Role, string> = { L: LEAD, F: FOLLOW };

export const pad2 = (n: number): string => String(n).padStart(2, '0');

/** 결정적 의사난수 — SSR/CSR·빌드마다 같은 결과. */
export function seeded(i: number): number {
  const x = Math.sin(i * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}


export const COMMON_DEFS = `
  <linearGradient id="t11BgBase" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#04161B"/>
    <stop offset="0.5" stop-color="#030F13"/>
    <stop offset="1" stop-color="#01080A"/>
  </linearGradient>
  <radialGradient id="t11BgGlow" cx="0.5" cy="0.5" r="0.55">
    <stop offset="0" stop-color="#3A2208" stop-opacity="0.55"/>
    <stop offset="1" stop-color="#030F13" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="t11Haze" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0" stop-color="#FF7A12" stop-opacity="0.35"/>
    <stop offset="0.5" stop-color="#C24A06" stop-opacity="0.12"/>
    <stop offset="1" stop-color="#7A2A00" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="t11Flare" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0" stop-color="#FFC04A" stop-opacity="0.9"/>
    <stop offset="0.35" stop-color="#FF8A1F" stop-opacity="0.45"/>
    <stop offset="1" stop-color="#FF6A00" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="t11Core" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0" stop-color="#FFFBE6" stop-opacity="1"/>
    <stop offset="0.4" stop-color="#FFD66B" stop-opacity="0.85"/>
    <stop offset="1" stop-color="#FF9A2A" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="t11Streak" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#FFB23F" stop-opacity="0"/>
    <stop offset="0.5" stop-color="#FFD27A" stop-opacity="1"/>
    <stop offset="1" stop-color="#FFB23F" stop-opacity="0"/>
  </linearGradient>
  <radialGradient id="t11Vignette" cx="0.5" cy="0.5" r="0.75">
    <stop offset="0.5" stop-color="#000405" stop-opacity="0"/>
    <stop offset="1" stop-color="#000405" stop-opacity="0.8"/>
  </radialGradient>

  <linearGradient id="t11CardFill" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#0E1F24" stop-opacity="0.78"/>
    <stop offset="1" stop-color="#050E11" stop-opacity="0.86"/>
  </linearGradient>
  <linearGradient id="t11CardStroke" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#FFB23F" stop-opacity="0.45"/>
    <stop offset="0.6" stop-color="#5E6E70" stop-opacity="0.2"/>
    <stop offset="1" stop-color="#3FC8D4" stop-opacity="0.22"/>
  </linearGradient>
  <linearGradient id="t11CardSheen" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#FFE3A8" stop-opacity="0.07"/>
    <stop offset="0.3" stop-color="#FFFFFF" stop-opacity="0.015"/>
    <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="t11HeroStroke" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#FFE3A8"/>
    <stop offset="0.5" stop-color="#FFB23F"/>
    <stop offset="1" stop-color="#FF6A00"/>
  </linearGradient>
  <linearGradient id="t11AccentStroke" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#FFE3A8"/>
    <stop offset="0.5" stop-color="#FFB23F"/>
    <stop offset="1" stop-color="#E0701A"/>
  </linearGradient>
  <linearGradient id="t11AccentNum" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#FFF4D2"/>
    <stop offset="0.45" stop-color="#FFC04A"/>
    <stop offset="1" stop-color="#FF7A12"/>
  </linearGradient>
  <linearGradient id="t11PhotoBg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#15292E"/>
    <stop offset="1" stop-color="#081417"/>
  </linearGradient>
  <linearGradient id="t11Lead" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#FFB45C"/>
    <stop offset="1" stop-color="#F0700F"/>
  </linearGradient>
  <linearGradient id="t11Follow" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#8EE6EE"/>
    <stop offset="1" stop-color="#2AA8B5"/>
  </linearGradient>
  <linearGradient id="t11LiveRed" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#FF4F5E"/>
    <stop offset="1" stop-color="#D3132C"/>
  </linearGradient>
  <linearGradient id="t11RuleH" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="${ACCENT}" stop-opacity="0"/>
    <stop offset="0.5" stop-color="${ACCENT_PALE}" stop-opacity="0.95"/>
    <stop offset="1" stop-color="${ACCENT}" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="t11RuleV" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${ACCENT}" stop-opacity="0"/>
    <stop offset="0.5" stop-color="${ACCENT_PALE}" stop-opacity="0.6"/>
    <stop offset="1" stop-color="${ACCENT}" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="t11Shine" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#FFFFFF" stop-opacity="0"/>
    <stop offset="0.5" stop-color="#FFF4D2" stop-opacity="0.85"/>
    <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="t11Eq" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#FFF4D2"/>
    <stop offset="0.5" stop-color="#FFB23F"/>
    <stop offset="1" stop-color="#FF6A00"/>
  </linearGradient>
  <filter id="t11Soft" x="-20%" y="-20%" width="140%" height="140%">
    <feGaussianBlur stdDeviation="9"/>
  </filter>
  <filter id="t11Glint" x="-200%" y="-200%" width="500%" height="500%">
    <feGaussianBlur stdDeviation="2.5" result="b"/>
    <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <!-- shared/ 모듈(judgesIntro·judgesVideo·reportSvg)이 참조하는 공용 id 를 11 팔레트로 정의 -->
  <linearGradient id="goldg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#FFF4D2"/>
    <stop offset="0.45" stop-color="#FFC04A"/>
    <stop offset="1" stop-color="#FF7A12"/>
  </linearGradient>
  <linearGradient id="goldgh" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="${ACCENT}" stop-opacity="0"/>
    <stop offset="0.5" stop-color="${ACCENT}" stop-opacity="0.9"/>
    <stop offset="1" stop-color="${ACCENT}" stop-opacity="0"/>
  </linearGradient>
  <radialGradient id="hxg" cx="0.5" cy="0.4" r="0.6">
    <stop offset="0" stop-color="#15292E"/>
    <stop offset="1" stop-color="#081417"/>
  </radialGradient>
`;

/** 벡터 바탕 — 딥 틸-블랙 + 가운데 옅은 웜 반사광. 커스텀 배경이 반투명일 때도 비친다. */
export const BG_VECTOR = `
  <rect x="0" y="0" width="1280" height="720" fill="url(#t11BgBase)"/>
  <rect x="0" y="0" width="1280" height="720" fill="url(#t11BgGlow)"/>
`;

/**
 * 광선 본체 — 로컬 좌표를 SLASH_ANGLE 로 돌려 광선이 로컬 x 축을 따라 눕는다.
 * scale 로 크기를, idBase 로 반복 단위(애니메이션 시작점)를 바꿔 배경 광선과 VS 광선이 같은 문법을 공유한다.
 */
function slashBody(cx: number, cy: number, reach: number, width: number, streakCount: number, seedBase: number): string {
  let streaks = '';
  for (let i = 0; i < streakCount; i++) {
    const r1 = seeded(seedBase + i * 3 + 1);
    const r2 = seeded(seedBase + i * 3 + 2);
    const r3 = seeded(seedBase + i * 3 + 3);
    // 빛줄기는 레퍼런스처럼 광선 한쪽(화면 좌상)으로 더 많이 흩어진다.
    const lat = -width * 0.2 - Math.pow(r1, 1.6) * width * 1.4 + (r2 > 0.8 ? width * 0.9 * r3 : 0);
    const len = reach * (0.18 + r2 * 0.55);
    const x0 = -reach * 0.85 + r3 * reach * 1.4;
    const h = 0.6 + seeded(seedBase + i * 7) * 1.6;
    const dur = (2.6 + seeded(seedBase + i * 11) * 3.4).toFixed(2);
    const begin = (-seeded(seedBase + i * 13) * Number(dur)).toFixed(2);
    const peak = (0.35 + seeded(seedBase + i * 17) * 0.55).toFixed(2);
    streaks += `
      <rect x="${f(x0)}" y="${f(lat)}" width="${f(len)}" height="${f(h)}" fill="url(#t11Streak)" opacity="${peak}">
        <animate attributeName="x" values="${f(x0 - reach * 0.06)};${f(x0 + reach * 0.06)};${f(x0 - reach * 0.06)}" dur="${dur}s" begin="${begin}s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="${peak};0.1;${peak}" dur="${dur}s" begin="${begin}s" repeatCount="indefinite"/>
      </rect>`;
  }
  return `
    <g transform="translate(${f(cx)} ${f(cy)}) rotate(${SLASH_ANGLE})">
      <ellipse cx="0" cy="0" rx="${f(reach * 1.25)}" ry="${f(width * 3.2)}" fill="url(#t11Haze)"/>
      <ellipse cx="0" cy="0" rx="${f(reach)}" ry="${f(width)}" fill="url(#t11Flare)">
        <animate attributeName="opacity" values="0.85;1;0.85" dur="5.5s" repeatCount="indefinite"/>
      </ellipse>
      ${streaks}
      <ellipse cx="0" cy="0" rx="${f(reach * 0.72)}" ry="${f(Math.max(2.5, width * 0.12))}" fill="url(#t11Core)"/>
    </g>`;
}

/** 광선을 따라 떠오르는 불티. */
function embers(): string {
  const a = (SLASH_ANGLE * Math.PI) / 180;
  let body = '';
  for (let i = 0; i < 22; i++) {
    const t = (seeded(i + 500) - 0.5) * 820;
    const off = (seeded(i + 540) - 0.5) * 120;
    const x = CX + Math.cos(a) * t - Math.sin(a) * off;
    const y = 360 + Math.sin(a) * t + Math.cos(a) * off;
    const r = 0.8 + seeded(i + 580) * 1.8;
    const dur = (5 + seeded(i + 620) * 6).toFixed(2);
    const begin = (-seeded(i + 660) * Number(dur)).toFixed(2);
    const rise = 60 + seeded(i + 700) * 120;
    body += `
      <circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="#FFD27A" opacity="0">
        <animate attributeName="cy" values="${f(y)};${f(y - rise)}" dur="${dur}s" begin="${begin}s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0;0.85;0" dur="${dur}s" begin="${begin}s" repeatCount="indefinite"/>
      </circle>`;
  }
  return body;
}

/** 기본 배경 — 중앙 사선 광선 + 빛줄기 + 불티 + 비네트. 커스텀 배경이 없을 때만 깐다. */
export const BG_LAYER = `
  ${slashBody(CX, 360, 470, 64, 70, 1)}
  ${embers()}
  <rect x="0" y="0" width="1280" height="720" fill="url(#t11Vignette)"/>
`;

/** 커스텀 배경 위 스크림 — 흰 글자가 밝은 사진에 묻히지 않도록 틸-블랙으로 누르고 웜 반사광을 얇게 되살린다. */
export const OVERRIDE_SCRIM = `
  <rect x="0" y="0" width="1280" height="720" fill="${NIGHT}" fill-opacity="0.52"/>
  <rect x="0" y="0" width="1280" height="720" fill="url(#t11BgGlow)" opacity="0.5"/>
`;

/**
 * 11 의 가독성 규칙.
 *  · 기본: 어두운 외곽선 — 광선 위를 지나는 흰 글자도 윤곽이 선다.
 *  · .num  : 금빛→주황 숫자 — 주황 번짐.
 *  · .hero : 대형 제목 — 아래로 떨어지는 짙은 그림자 + 뒤에서 번지는 주황 역광.
 *  · .vs   : 대진 화면의 V·S — 어두운 실루엣 + 앰버 윤곽 + 역광 (레퍼런스).
 *  · .flat : 밝은 칩(오렌지/틸) 위 어두운 글자 — 외곽선을 끈다.
 */
export const TEXT_STYLE = `
  <style>
    svg.t11 text {
      paint-order: stroke fill;
      stroke: #010608;
      stroke-opacity: 0.55;
      stroke-width: max(1px, 0.035em);
      stroke-linejoin: round;
    }
    svg.t11 text.num {
      stroke: #2A1200;
      stroke-opacity: 0.55;
      filter: drop-shadow(0 0 0.2em rgba(255, 140, 30, 0.5));
    }
    svg.t11 text.hero {
      stroke-opacity: 0.35;
      filter: drop-shadow(0 0.05em 0.03em rgba(0, 0, 0, 0.7)) drop-shadow(0 0 0.4em rgba(255, 130, 20, 0.45));
    }
    svg.t11 text.vs {
      paint-order: stroke fill;
      stroke: #FFB23F;
      stroke-opacity: 0.9;
      stroke-width: 2px;
      filter: drop-shadow(0 0 0.12em rgba(255, 150, 40, 0.9)) drop-shadow(0 0 0.4em rgba(255, 110, 10, 0.6));
    }
    svg.t11 text.flat { stroke-opacity: 0; }
  </style>
`;

export function shell(content: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" class="t11" viewBox="0 0 1280 720" preserveAspectRatio="xMidYMid meet">
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

/** 작은 앰버 대문자 라벨 — CONTESTANT / COUPLE 같은 항목 이름. */
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

/** 금빛→주황 숫자 — 참가번호·순위·인덱스. */
export function accentNumber(
  x: number,
  y: number,
  text: string,
  size: number,
  anchor: 'start' | 'middle' | 'end' = 'middle',
  fit?: number
): string {
  return `<text class="num"${fitAttr(fit, 0.55)} x="${f(x)}" y="${f(y)}" text-anchor="${anchor}" font-family="${DISPLAY}" font-weight="900" font-size="${f(size)}" letter-spacing="${f(-size * 0.01)}" fill="url(#t11AccentNum)">${text}</text>`;
}

const RANK_SUFFIX: Record<1 | 2 | 3, string> = { 1: 'ST', 2: 'ND', 3: 'RD' };

/** 순위 표기 — 큰 숫자 + 위첨자 서수(1ST / 2ND / 3RD). */
export function rankMark(cx: number, y: number, rank: 1 | 2 | 3, size: number, fill = 'url(#t11AccentNum)'): string {
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

/**
 * 패널 카드 — 11 의 기본 면. 반투명 차콜-틸 + 앰버 헤어라인 + 우상단 짧은 사선 컷(광선 모티프).
 * rx 는 07 과의 호환용 — 11 은 모서리를 작게(최대 8) 눌러 단정하게 쓴다.
 * hero: 1위 등 주인공 카드. 금빛→주황 테두리 + 뒤에서 번지는 주황 역광(블러는 이 카드에만 쓴다).
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
    ? `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${f(r)}" fill="none" stroke="#FF8A1F" stroke-width="8" stroke-opacity="0.45" filter="url(#t11Soft)"/>`
    : '';
  // 우상단 사선 컷 — 큰 카드에만. 작은 칩(브래킷 칸·시드 칩)에서는 옆 숫자와 붙어 "/1" 처럼 읽힌다.
  const k = Math.min(18, h * 0.32, w * 0.12);
  const tx = x + w - k * 1.6;
  const cut =
    h >= 60 && w >= 140
      ? `<path d="M ${f(tx)} ${f(y + k * 1.1)} L ${f(tx + k * 0.45)} ${f(y + 1.5)}" stroke="${ACCENT}" stroke-width="${f(Math.max(1.4, k * 0.12))}" stroke-linecap="round" stroke-opacity="0.9"/>`
      : '';
  return `
    <g>
      ${glow}
      <rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${f(r)}" fill="url(#t11CardFill)"
        stroke="${hero ? 'url(#t11HeroStroke)' : 'url(#t11CardStroke)'}" stroke-width="${hero ? 2 : 1.1}"/>
      <rect x="${f(x + 1)}" y="${f(y + 1)}" width="${f(w - 2)}" height="${f(h - 2)}" rx="${f(Math.max(0, r - 1))}" fill="url(#t11CardSheen)"/>
      ${cut}
    </g>`;
}

/** 화면 폭을 가로지르는 넓은 패널 — OPEN/LIVE/CALC/CLOSE 의 무대. 상단 중앙에 앰버 하이라이트. */
export function stageBand(y: number, h: number, hero = false): string {
  return `
    ${panelCard(MX, y, RX - MX, h, { rx: 26, hero })}
    <rect x="${CX - 200}" y="${f(y - 0.5)}" width="400" height="2" fill="url(#t11RuleH)"/>
  `;
}

/** 구분선 + 가운데 짧은 빛나는 사선. 선은 얇은 <rect fill=gradient> (수평 <line> 은 그라디언트가 칠해지지 않는다). */
export function accentRule(y: number, half = 220, cx = CX): string {
  return `
    <g>
      <rect x="${f(cx - half)}" y="${f(y - 0.6)}" width="${f(half * 2)}" height="1.2" fill="url(#t11RuleH)"/>
      <path d="M ${f(cx - 5)} ${f(y + 13)} L ${f(cx + 5)} ${f(y - 13)}" stroke="#FFE3A8" stroke-width="3" stroke-linecap="round" filter="url(#t11Glint)"/>
    </g>`;
}

/**
 * 대결 화면의 VS — 레퍼런스 그대로: 사선 광선 위에 어두운 실루엣 V(좌상)·S(우하) + 앰버 윤곽.
 * reach = 광선 반길이, size = 글자 크기.
 */
export function vsSlash(cx: number, cy: number, reach = 200, size = 96): string {
  return `
    <g>
      ${slashBody(cx, cy, reach, reach * 0.16, 34, 900)}
      <text class="vs" x="${f(cx - size * 0.3)}" y="${f(cy + size * 0.12)}" text-anchor="middle" font-family="${DISPLAY}" font-weight="900"
        font-size="${f(size)}" fill="#0A0F10">V</text>
      <text class="vs" x="${f(cx + size * 0.28)}" y="${f(cy + size * 0.52)}" text-anchor="middle" font-family="${DISPLAY}" font-weight="900"
        font-size="${f(size)}" fill="#0A0F10">S</text>
    </g>`;
}

/** 역할 알약 — 리더(오렌지)/팔로워(틸). */
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
      <rect x="${f(cx - w / 2)}" y="${f(cy - h / 2)}" width="${f(w)}" height="${f(h)}" rx="${f(h / 2)}" fill="${ROLE_FILL[role]}"/>
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
      <rect x="${f(x)}" y="${f(y)}" width="${f(s)}" height="${f(s)}" rx="${f(s * 0.18)}" fill="${ROLE_FILL[role]}"/>
      <text class="flat" x="${f(x + s / 2)}" y="${f(y + s * 0.72)}" text-anchor="middle" font-family="${DISPLAY}"
        font-weight="900" font-size="${f(s * 0.62)}" fill="${NIGHT}">${role}</text>
    </g>`;
}

/**
 * 사진 프레임 — 작은 라운드 사각 + 웜 앰버 테두리 + 상단 역광 하이라이트.
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
  const id = svgId('t11ph', x, y, w, h);
  const s = Math.min(w, h);
  const r = Math.min(rx * 0.5, 6);
  const hx = x + w / 2;
  const image = href
    ? `<image href="${href}" x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id})"/>`
    : '';
  return `
    <g>
      <defs><clipPath id="${id}"><rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${f(r)}"/></clipPath></defs>
      <rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${f(r)}" fill="url(#t11PhotoBg)"/>
      <g clip-path="url(#${id})" fill="#FFFFFF" fill-opacity="0.12">
        <circle cx="${f(hx)}" cy="${f(y + h * 0.42)}" r="${f(s * 0.19)}"/>
        <ellipse cx="${f(hx)}" cy="${f(y + h + s * 0.12)}" rx="${f(s * 0.42)}" ry="${f(s * 0.38)}"/>
      </g>
      ${image}
      <rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${f(r)}" fill="none" stroke="${ring}" stroke-width="${ringW}"/>
    </g>`;
}

/** 사각 영역 밖으로 넘치는 글자(긴 이름 등)를 잘라낸다. */
export function clipBox(x: number, y: number, w: number, h: number, inner: string): string {
  const id = svgId('t11cl', x, y, w, h);
  return `<defs><clipPath id="${id}"><rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}"/></clipPath></defs><g clip-path="url(#${id})">${inner}</g>`;
}

/** 등장 — 살짝 떠오르며 나타난다. */
export function fadeUp(delay: number, inner: string, dy = 16): string {
  const b = `${delay.toFixed(2)}s`;
  return `
    <g opacity="0">
      <animate attributeName="opacity" values="0;1" dur="0.55s" begin="${b}" fill="freeze"/>
      <g transform="translate(0 ${dy})">
        <animateTransform attributeName="transform" type="translate" values="0 ${dy};0 0" keyTimes="0;1"
          calcMode="spline" keySplines="0.2 0.8 0.2 1" dur="0.65s" begin="${b}" fill="freeze"/>
        ${inner}
      </g>
    </g>`;
}

/** 4갈래 반짝이 — 불꽃. */
export function sparkle(cx: number, cy: number, r: number, fill = ACCENT_PALE): string {
  const k = r * 0.22;
  return `<path d="M ${f(cx)} ${f(cy - r)} Q ${f(cx + k)} ${f(cy - k)} ${f(cx + r)} ${f(cy)} Q ${f(cx + k)} ${f(cy + k)} ${f(cx)} ${f(cy + r)} Q ${f(cx - k)} ${f(cy + k)} ${f(cx - r)} ${f(cy)} Q ${f(cx - k)} ${f(cy - k)} ${f(cx)} ${f(cy - r)} Z" fill="${fill}"/>`;
}

// ── 러너 (상단/하단) ────────────────────────────────────────────────────────

/** "● OFFICIAL LIVE DISPLAY" 가는 앰버 외곽선 뱃지 — 우상단 방송 뱃지. */
function liveDisplayPill(rightX: number, cy: number): string {
  const w = 272;
  const h = 32;
  const x = rightX - w;
  return `
    <g>
      <rect x="${x}" y="${cy - h / 2}" width="${w}" height="${h}" rx="4" fill="${NIGHT}" fill-opacity="0.45"
        stroke="url(#t11AccentStroke)" stroke-width="1.2"/>
      <circle cx="${x + 22}" cy="${cy}" r="4.5" fill="${LIVE_GREEN}">
        <animate attributeName="opacity" values="1;0.25;1" dur="1.4s" repeatCount="indefinite"/>
      </circle>
      <text x="${x + 36}" y="${f(cy + 4.3)}" font-family="${DISPLAY}" font-weight="800" font-size="12"
        letter-spacing="2.2" fill="${SOFT}">OFFICIAL LIVE DISPLAY</text>
    </g>`;
}

/** 상단 러너 — 빛나는 사선 + 대회명(좌) · 라이브 뱃지(우). 대회명이 길면 말줄임. */
export function topBar(): string {
  return `
    ${clipBox(MX, 22, 420, 44, `
      <path d="M ${MX + 2} ${HEAD_Y + 4} L ${MX + 10} ${HEAD_Y - 16}" stroke="#FFD27A" stroke-width="3.2" stroke-linecap="round"/>
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
