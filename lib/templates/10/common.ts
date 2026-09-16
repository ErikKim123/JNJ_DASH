// Template 10 — "SPORTS WAVE" (BATTLE_DASH_DB 10 이식 · 잭앤질 스텝 화면은 07 과 같다)
//
// 레퍼런스: 스포츠 방송 배경 — 딥 네이비 위로 가는 선 수십 가닥이 모여 꼬인 리본처럼 흐르고,
// 흰색 속도선이 비스듬히 스치며, 뒤로는 번진 가로 빛 얼룩이 깔린다.
//  · 배경: 네이비 바탕 + 가로로 번진 블루 빛 얼룩(블러 없이 그라디언트 타원) +
//    좌하→우상으로 오르는 라인 리본(블루→퍼플). 리본은 폭이 좁아졌다 넓어지며 세 번 꼬이고,
//    천천히 출렁인다(path d 모핑). 흰 속도선이 리본을 가로질러 흘러간다. 이미지 파일 없이 벡터로만 그린다.
//  · 면: 둥근 네이비 글래스 카드 + 블루→퍼플 헤어라인 테두리 — 리본과 같은 두 색.
//  · 글자: 흰색 초굵은 이탤릭 + 은은한 흰 빛 번짐(레퍼런스의 "SPORTS"). 숫자는 흰→라벤더.
//  · 역할 색: 리더 = 퍼플, 팔로워 = 블루 — 리본 그라디언트의 양 끝.
//
// 화면 레이아웃(svg/*)은 07 과 같다 — 프리미티브가 같은 시그니처를 가지므로 좌표는 그대로 두고
// 외형만 바뀐다. ACCENT 는 07 의 GOLD 자리(라벨·강조), hero 옵션은 주인공 카드.
import { svgId } from '../shared/svgId';

// ── 팔레트 ──────────────────────────────────────────────────────────────────
export const NIGHT = '#030A2A';      // 가장 어두운 면 / 밝은 칩 위 글자
export const WHITE = '#FFFFFF';      // 제목·이름
export const SOFT = '#D3DCFF';       // 보조 텍스트 (라벤더 화이트)
export const DIM = '#7F8BC2';        // 3차 텍스트
export const ACCENT = '#9DB4FF';     // 라벨·강조 — 페리윙클 블루
export const ACCENT_PALE = '#DDE5FF';
export const LEAD = '#B84DFF';       // 리더 — 퍼플
export const FOLLOW = '#4C8DFF';     // 팔로워 — 블루
export const LIVE_GREEN = '#3DE39A';
export const FRAME = '#8FA8FF';      // 사진 테두리 — 옅은 블루
export const SILVER = '#D6DCF2';     // 2위
export const BRONZE = '#F0A77A';     // 3위

// ── 폰트 ────────────────────────────────────────────────────────────────────
// Montserrat(이탤릭 포함)는 app/layout.tsx 와 TemplatePicker iframe 에서 로드. 한글은 Malgun Gothic 폴백.
// 이탤릭은 TEXT_STYLE 의 CSS 로 모든 글자에 일괄 적용한다.
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
export const ROLE_FILL: Record<Role, string> = { L: 'url(#t10Lead)', F: 'url(#t10Follow)' };
export const ROLE_COLOR: Record<Role, string> = { L: LEAD, F: FOLLOW };

export const pad2 = (n: number): string => String(n).padStart(2, '0');

/** 결정적 의사난수 — SSR/CSR·빌드마다 같은 결과. */
export function seeded(i: number): number {
  const x = Math.sin(i * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}


export const COMMON_DEFS = `
  <linearGradient id="t10BgBase" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#06124A"/>
    <stop offset="0.5" stop-color="#040C36"/>
    <stop offset="1" stop-color="#020622"/>
  </linearGradient>
  <radialGradient id="t10BgGlow" cx="0.45" cy="0.4" r="0.7">
    <stop offset="0" stop-color="#1B3AB8" stop-opacity="0.45"/>
    <stop offset="0.6" stop-color="#0E2280" stop-opacity="0.15"/>
    <stop offset="1" stop-color="#040C36" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="t10Smear" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0" stop-color="#3A64FF" stop-opacity="0.3"/>
    <stop offset="0.6" stop-color="#2A4BD6" stop-opacity="0.1"/>
    <stop offset="1" stop-color="#2A4BD6" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="t10Wave" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="1280" y2="0">
    <stop offset="0" stop-color="#3F6BFF"/>
    <stop offset="0.42" stop-color="#9B45FF"/>
    <stop offset="0.62" stop-color="#D14BFF"/>
    <stop offset="1" stop-color="#4F66FF"/>
  </linearGradient>
  <linearGradient id="t10Line" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#FFFFFF" stop-opacity="0"/>
    <stop offset="0.5" stop-color="#FFFFFF" stop-opacity="0.9"/>
    <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
  </linearGradient>
  <radialGradient id="t10Vignette" cx="0.5" cy="0.5" r="0.75">
    <stop offset="0.55" stop-color="#01031A" stop-opacity="0"/>
    <stop offset="1" stop-color="#01031A" stop-opacity="0.7"/>
  </radialGradient>

  <linearGradient id="t10CardFill" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#0E1D5E" stop-opacity="0.66"/>
    <stop offset="1" stop-color="#070F3A" stop-opacity="0.76"/>
  </linearGradient>
  <linearGradient id="t10CardStroke" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#7C9CFF" stop-opacity="0.7"/>
    <stop offset="0.5" stop-color="#5A5FD8" stop-opacity="0.3"/>
    <stop offset="1" stop-color="#C05CFF" stop-opacity="0.6"/>
  </linearGradient>
  <linearGradient id="t10CardSheen" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.1"/>
    <stop offset="0.35" stop-color="#FFFFFF" stop-opacity="0.02"/>
    <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="t10AccentStroke" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#A9BEFF"/>
    <stop offset="0.5" stop-color="#8C6CFF"/>
    <stop offset="1" stop-color="#D66BFF"/>
  </linearGradient>
  <linearGradient id="t10AccentNum" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#FFFFFF"/>
    <stop offset="0.5" stop-color="#E4DCFF"/>
    <stop offset="1" stop-color="#A98CFF"/>
  </linearGradient>
  <linearGradient id="t10PhotoBg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#172A78"/>
    <stop offset="1" stop-color="#08123F"/>
  </linearGradient>
  <linearGradient id="t10Lead" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#D892FF"/>
    <stop offset="1" stop-color="#9A38F0"/>
  </linearGradient>
  <linearGradient id="t10Follow" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#9DBBFF"/>
    <stop offset="1" stop-color="#3D72F2"/>
  </linearGradient>
  <linearGradient id="t10LiveRed" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#FF4F7E"/>
    <stop offset="1" stop-color="#D3134C"/>
  </linearGradient>
  <linearGradient id="t10RuleH" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="${FOLLOW}" stop-opacity="0"/>
    <stop offset="0.5" stop-color="#A98CFF" stop-opacity="0.95"/>
    <stop offset="1" stop-color="${LEAD}" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="t10RuleV" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${FOLLOW}" stop-opacity="0"/>
    <stop offset="0.5" stop-color="#A98CFF" stop-opacity="0.6"/>
    <stop offset="1" stop-color="${LEAD}" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="t10Shine" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#FFFFFF" stop-opacity="0"/>
    <stop offset="0.5" stop-color="#FFFFFF" stop-opacity="0.85"/>
    <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="t10Eq" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#FFFFFF"/>
    <stop offset="0.5" stop-color="#9DB4FF"/>
    <stop offset="1" stop-color="#B84DFF"/>
  </linearGradient>
  <filter id="t10Soft" x="-20%" y="-20%" width="140%" height="140%">
    <feGaussianBlur stdDeviation="9"/>
  </filter>
  <!-- shared/ 모듈(judgesIntro·judgesVideo·reportSvg)이 참조하는 공용 id 를 10 팔레트로 정의 -->
  <linearGradient id="goldg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#FFFFFF"/>
    <stop offset="0.5" stop-color="#E4DCFF"/>
    <stop offset="1" stop-color="#A98CFF"/>
  </linearGradient>
  <linearGradient id="goldgh" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="${ACCENT}" stop-opacity="0"/>
    <stop offset="0.5" stop-color="${ACCENT}" stop-opacity="0.9"/>
    <stop offset="1" stop-color="${ACCENT}" stop-opacity="0"/>
  </linearGradient>
  <radialGradient id="hxg" cx="0.5" cy="0.4" r="0.6">
    <stop offset="0" stop-color="#172A78"/>
    <stop offset="1" stop-color="#08123F"/>
  </radialGradient>
`;

/** 벡터 바탕 — 딥 네이비 + 좌상단 쪽 푸른 조명. 커스텀 배경이 반투명일 때도 비친다. */
export const BG_VECTOR = `
  <rect x="0" y="0" width="1280" height="720" fill="url(#t10BgBase)"/>
  <rect x="0" y="0" width="1280" height="720" fill="url(#t10BgGlow)"/>
`;

// 가로로 번진 빛 얼룩 — [cx, cy, rx, ry, 불투명도]
const SMEARS: ReadonlyArray<readonly [number, number, number, number, number]> = [
  [330, 118, 320, 38, 1], [990, 206, 280, 32, 0.85], [230, 470, 240, 30, 0.8], [900, 560, 340, 42, 0.9], [620, 360, 420, 56, 0.55],
];

// 리본 — 가닥 수 · 가닥당 샘플 수 · 출렁임 키프레임(위상)
const WAVE_LINES = 18;
const WAVE_STEPS = 48;
const WAVE_PHASES = [0, 0.16, 0.32, 0] as const;

/**
 * 리본의 k번째 가닥. 중심선은 좌하(≈577)에서 우상(≈340)으로 오르며 완만히 굽고,
 * 가닥 사이 간격 = 폭 × cos(꼬임각) — 꼬임각이 x 를 따라 돌면서 리본이 좁아졌다(꼬임) 다시 벌어진다.
 */
function wavePath(k: number, phase: number): string {
  const t = k / (WAVE_LINES - 1) - 0.5;
  let d = '';
  for (let i = 0; i <= WAVE_STEPS; i++) {
    const x = -60 + (1400 * i) / WAVE_STEPS;
    const u = x / 1280;
    const base = 520 - 250 * u + 70 * Math.sin(2 * Math.PI * (u * 1.1 + 0.15 + phase * 0.3));
    const twist = Math.cos(2 * Math.PI * (u * 1.35 + phase));
    const width = 110 + 60 * Math.sin(Math.PI * Math.min(1, Math.max(0, u)));
    const y = base + width * t * twist + 14 * t * Math.sin(2 * Math.PI * (u * 3 + phase));
    d += `${i ? 'L' : 'M'}${f(x)} ${f(y)}`;
  }
  return d;
}

function ribbon(): string {
  const spline = WAVE_PHASES.slice(1).map(() => '0.45 0 0.55 1').join(';');
  let body = '';
  for (let k = 0; k < WAVE_LINES; k++) {
    const ds = WAVE_PHASES.map((p) => wavePath(k, p));
    const edge = Math.abs(k / (WAVE_LINES - 1) - 0.5) * 2; // 0 = 가운데 가닥, 1 = 바깥 가닥
    body += `
      <path d="${ds[0]}" fill="none" stroke="url(#t10Wave)" stroke-width="1.3" stroke-opacity="${(0.95 - edge * 0.45).toFixed(2)}">
        <animate attributeName="d" values="${ds.join(';')}" keyTimes="0;0.33;0.66;1" calcMode="spline" keySplines="${spline}" dur="16s" repeatCount="indefinite"/>
      </path>`;
  }
  return `<g>${body}</g>`;
}

// 흰 속도선 — [y, 길이, 흐름 시작 x, 주기(s)]. 전체를 -10° 기울여 리본과 엇갈리게 긋는다.
const SPEED_LINES: ReadonlyArray<readonly [number, number, number, number]> = [
  [250, 820, -300, 7.5], [430, 1100, -700, 9.5], [600, 760, -200, 8.5],
];

function speedLines(): string {
  const lines = SPEED_LINES.map(
    ([y, len, x0, dur], i) => `
      <rect x="${x0}" y="${y}" width="${len}" height="1.8" fill="url(#t10Line)" opacity="0.75">
        <animate attributeName="x" values="${x0 - 400};${x0 + 900}" dur="${dur}s" begin="-${(i * 2.3).toFixed(1)}s" repeatCount="indefinite"/>
      </rect>`
  ).join('');
  return `<g transform="rotate(-10 640 360)">${lines}</g>`;
}

/** 기본 배경 — 빛 얼룩 · 라인 리본 · 속도선 · 비네트. 커스텀 배경이 없을 때만 깐다. */
export const BG_LAYER = `
  ${SMEARS.map(([cx, cy, rx, ry, o]) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#t10Smear)" opacity="${o}"/>`).join('')}
  ${ribbon()}
  ${speedLines()}
  <rect x="0" y="0" width="1280" height="720" fill="url(#t10Vignette)"/>
`;

/** 커스텀 배경 위 스크림 — 흰 글자가 밝은 사진에 묻히지 않도록 네이비로 누른다. */
export const OVERRIDE_SCRIM = `
  <rect x="0" y="0" width="1280" height="720" fill="${NIGHT}" fill-opacity="0.5"/>
  <rect x="0" y="0" width="1280" height="720" fill="url(#t10BgGlow)" opacity="0.45"/>
`;

/**
 * 10 의 가독성 규칙.
 *  · 모든 글자: 이탤릭 + 얇은 어두운 외곽선.
 *  · .num  : 흰→라벤더 숫자 — 퍼플 번짐.
 *  · .hero : 대형 제목 — 흰 빛 번짐 + 바깥으로 퍼지는 블루-퍼플 후광 (레퍼런스의 "SPORTS").
 *  · .flat : 밝은 칩(퍼플/블루) 위 어두운 글자 — 외곽선을 끈다.
 */
export const TEXT_STYLE = `
  <style>
    svg.t10 text {
      font-style: italic;
      paint-order: stroke fill;
      stroke: #01031A;
      stroke-opacity: 0.4;
      stroke-width: max(1px, 0.03em);
      stroke-linejoin: round;
    }
    svg.t10 text.num {
      stroke: #10063A;
      stroke-opacity: 0.5;
      filter: drop-shadow(0 0 0.18em rgba(169, 140, 255, 0.55));
    }
    svg.t10 text.hero {
      stroke-opacity: 0.15;
      filter: drop-shadow(0 0 0.12em rgba(255, 255, 255, 0.6)) drop-shadow(0 0 0.45em rgba(120, 110, 255, 0.5));
    }
    svg.t10 text.flat { stroke-opacity: 0; }
  </style>
`;

export function shell(content: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" class="t10" viewBox="0 0 1280 720" preserveAspectRatio="xMidYMid meet">
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

/** 작은 페리윙클 대문자 라벨 — CONTESTANT / COUPLE 같은 항목 이름. */
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

/** 흰→라벤더 그라디언트 숫자 — 참가번호·순위·인덱스. */
export function accentNumber(
  x: number,
  y: number,
  text: string,
  size: number,
  anchor: 'start' | 'middle' | 'end' = 'middle',
  fit?: number
): string {
  return `<text class="num"${fitAttr(fit, 0.55)} x="${f(x)}" y="${f(y)}" text-anchor="${anchor}" font-family="${DISPLAY}" font-weight="900" font-size="${f(size)}" letter-spacing="${f(-size * 0.01)}" fill="url(#t10AccentNum)">${text}</text>`;
}

const RANK_SUFFIX: Record<1 | 2 | 3, string> = { 1: 'ST', 2: 'ND', 3: 'RD' };

/** 순위 표기 — 큰 숫자 + 위첨자 서수(1ST / 2ND / 3RD). */
export function rankMark(cx: number, y: number, rank: 1 | 2 | 3, size: number, fill = 'url(#t10AccentNum)'): string {
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
 * 웨이브 카드 — 10 의 기본 면. 둥근 네이비 글래스 + 블루→퍼플 헤어라인 테두리 + 상단 광택.
 * hero: 1위 등 주인공 카드. 밝은 블루→퍼플 테두리 + 뒤에서 번지는 퍼플 후광(블러는 이 카드에만 쓴다).
 */
export function waveCard(
  x: number,
  y: number,
  w: number,
  h: number,
  opts: { rx?: number; hero?: boolean } = {}
): string {
  const { rx = 18, hero = false } = opts;
  const r = Math.min(rx * 0.8, h / 2, w / 2);
  const glow = hero
    ? `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${f(r)}" fill="none" stroke="#9B6BFF" stroke-width="8" stroke-opacity="0.5" filter="url(#t10Soft)"/>`
    : '';
  return `
    <g>
      ${glow}
      <rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${f(r)}" fill="url(#t10CardFill)"
        stroke="${hero ? 'url(#t10AccentStroke)' : 'url(#t10CardStroke)'}" stroke-width="${hero ? 2.2 : 1.2}"/>
      <rect x="${f(x + 1.5)}" y="${f(y + 1.5)}" width="${f(w - 3)}" height="${f(h - 3)}" rx="${f(Math.max(0, r - 1.5))}" fill="url(#t10CardSheen)"/>
    </g>`;
}

/** 화면 폭을 가로지르는 넓은 글래스 띠 — OPEN/LIVE/CALC/CLOSE 의 무대. 상단 중앙에 블루→퍼플 하이라이트. */
export function stageBand(y: number, h: number, hero = false): string {
  return `
    ${waveCard(MX, y, RX - MX, h, { rx: 26, hero })}
    <rect x="${CX - 200}" y="${f(y - 0.5)}" width="400" height="2.5" fill="url(#t10RuleH)"/>
  `;
}

/**
 * 구분선 + 가운데 작은 물결 — 리본 모티프.
 * 선은 얇은 <rect fill=gradient> 로 그린다 — 수평 <line> 은 bbox 높이가 0 이라 그라디언트가 칠해지지 않는다.
 */
export function accentRule(y: number, half = 220, cx = CX): string {
  return `
    <g transform="translate(${f(cx)} ${f(y)})">
      <rect x="${f(-half)}" y="-1" width="${f(half * 2)}" height="2" fill="url(#t10RuleH)"/>
      <path d="M -18 0 C -12 -9 -6 -9 0 0 S 12 9 18 0" fill="none" stroke="${NIGHT}" stroke-width="7" stroke-opacity="0.85" stroke-linecap="round"/>
      <path d="M -18 0 C -12 -9 -6 -9 0 0 S 12 9 18 0" fill="none" stroke="#C9B8FF" stroke-width="2.4" stroke-linecap="round"/>
    </g>`;
}

/** 역할 알약 — 리더(퍼플)/팔로워(블루) 라벨. */
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
        font-weight="900" font-size="${f(size)}" letter-spacing="${f(tracking)}" fill="${WHITE}">${text}</text>
    </g>`;
}

/** 이름 앞에 붙는 L / F 사각 칩. baseline 은 옆에 오는 글자의 baseline. */
export function roleChip(x: number, baseline: number, role: Role, size: number): string {
  const s = size * 0.86;
  const y = baseline - size * 0.76;
  return `
    <g>
      <rect x="${f(x)}" y="${f(y)}" width="${f(s)}" height="${f(s)}" rx="${f(s * 0.3)}" fill="${ROLE_FILL[role]}"/>
      <text class="flat" x="${f(x + s / 2)}" y="${f(y + s * 0.72)}" text-anchor="middle" font-family="${DISPLAY}"
        font-weight="900" font-size="${f(s * 0.62)}" fill="${WHITE}">${role}</text>
    </g>`;
}

/**
 * 사진 프레임 — 라운드 사각 + 옅은 블루 테두리.
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
  const id = svgId('t10ph', x, y, w, h);
  const s = Math.min(w, h);
  const hx = x + w / 2;
  const image = href
    ? `<image href="${href}" x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id})"/>`
    : '';
  return `
    <g>
      <defs><clipPath id="${id}"><rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${f(rx)}"/></clipPath></defs>
      <rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${f(rx)}" fill="url(#t10PhotoBg)"/>
      <g clip-path="url(#${id})" fill="#FFFFFF" fill-opacity="0.13">
        <circle cx="${f(hx)}" cy="${f(y + h * 0.42)}" r="${f(s * 0.19)}"/>
        <ellipse cx="${f(hx)}" cy="${f(y + h + s * 0.12)}" rx="${f(s * 0.42)}" ry="${f(s * 0.38)}"/>
      </g>
      ${image}
      <rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${f(rx)}" fill="none" stroke="${ring}" stroke-width="${ringW}"/>
    </g>`;
}

/** 사각 영역 밖으로 넘치는 글자(긴 이름 등)를 잘라낸다. */
export function clipBox(x: number, y: number, w: number, h: number, inner: string): string {
  const id = svgId('t10cl', x, y, w, h);
  return `<defs><clipPath id="${id}"><rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}"/></clipPath></defs><g clip-path="url(#${id})">${inner}</g>`;
}

/** 등장 — 왼쪽에서 미끄러져 들어오며 나타난다 (속도선 방향). */
export function fadeUp(delay: number, inner: string, dy = 16): string {
  const b = `${delay.toFixed(2)}s`;
  const dx = -dy * 1.1;
  const ddy = dy * 0.35;
  return `
    <g opacity="0">
      <animate attributeName="opacity" values="0;1" dur="0.5s" begin="${b}" fill="freeze"/>
      <g transform="translate(${f(dx)} ${f(ddy)})">
        <animateTransform attributeName="transform" type="translate" values="${f(dx)} ${f(ddy)};0 0" keyTimes="0;1"
          calcMode="spline" keySplines="0.2 0.8 0.2 1" dur="0.6s" begin="${b}" fill="freeze"/>
        ${inner}
      </g>
    </g>`;
}

/** 4갈래 반짝이. */
export function sparkle(cx: number, cy: number, r: number, fill = ACCENT_PALE): string {
  const k = r * 0.22;
  return `<path d="M ${f(cx)} ${f(cy - r)} Q ${f(cx + k)} ${f(cy - k)} ${f(cx + r)} ${f(cy)} Q ${f(cx + k)} ${f(cy + k)} ${f(cx)} ${f(cy + r)} Q ${f(cx - k)} ${f(cy + k)} ${f(cx - r)} ${f(cy)} Q ${f(cx - k)} ${f(cy - k)} ${f(cx)} ${f(cy - r)} Z" fill="${fill}"/>`;
}

// ── 러너 (상단/하단) ────────────────────────────────────────────────────────

/** "● OFFICIAL LIVE DISPLAY" 블루→퍼플 외곽선 알약 — 우상단 방송 뱃지. */
function liveDisplayPill(rightX: number, cy: number): string {
  const w = 272;
  const h = 34;
  const x = rightX - w;
  return `
    <g>
      <rect x="${x}" y="${cy - h / 2}" width="${w}" height="${h}" rx="${h / 2}" fill="${NIGHT}" fill-opacity="0.4"
        stroke="url(#t10AccentStroke)" stroke-width="1.4"/>
      <circle cx="${x + 22}" cy="${cy}" r="5" fill="${LIVE_GREEN}">
        <animate attributeName="opacity" values="1;0.25;1" dur="1.4s" repeatCount="indefinite"/>
      </circle>
      <text x="${x + 36}" y="${f(cy + 4.3)}" font-family="${DISPLAY}" font-weight="800" font-size="12"
        letter-spacing="2.2" fill="${WHITE}">OFFICIAL LIVE DISPLAY</text>
    </g>`;
}

/** 상단 러너 — 작은 물결 + 대회명(좌) · 라이브 뱃지(우). 대회명이 길면 말줄임. */
export function topBar(): string {
  return `
    ${clipBox(MX, 22, 420, 44, `
      <path d="M ${MX} ${HEAD_Y - 5} c 4 -8 8 -8 12 0 s 8 8 12 0" fill="none" stroke="url(#t10AccentStroke)" stroke-width="2.6" stroke-linecap="round"/>
      <text${fitAttr(388, 0.72, true)} x="${MX + 34}" y="${HEAD_Y}" font-family="${DISPLAY}" font-weight="800" font-size="15"
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
