import { svgId } from '@/lib/templates/shared/svgId';
// Template 07 — "LIVE ARENA"
//
// 레퍼런스: 대회장 LED 월에 걸린 "OFFICIAL LIVE DISPLAY" 방송 그래픽.
//  · 배경: 상단 중앙에서 번지는 크림슨-매젠타 조명이 딥 인디고로 떨어지는 무대 조명 톤.
//    실제 이미지(/templates/07/background.jpg)를 깔되, 로딩 전·실패 시에도 같은 톤이 보이도록
//    같은 색의 벡터 그라디언트를 그 아래에 한 겹 더 둔다.
//  · 정보는 전부 "유리 카드"(반투명 라벤더 판 + 밝은 테두리 + 상단 광택) 위에 올린다.
//    카드 격자가 화면을 꽉 채우는 것이 07 의 시그니처 — 여백이 아니라 밀도로 무게를 만든다.
//  · 위계는 색으로 즉시 갈린다:
//      흰색 초굵은 산세리프 = 제목·이름 / 황금 그라디언트 숫자 = 참가번호·순위 /
//      작은 황금 대문자 라벨 = 항목 이름(CONTESTANT, COUPLE …).
//  · 역할 색: 리더 = 핫핑크, 팔로워 = 스카이블루 — 인디고 위에서 서로와도, 골드와도 구분된다.

export const BG_IMAGE = '/templates/07/background.jpg';

// ── 팔레트 ──────────────────────────────────────────────────────────────────
export const NIGHT = '#140F2A';      // 가장 어두운 면 / 밝은 칩 위 글자
export const WHITE = '#FFFFFF';      // 제목·이름
export const SOFT = '#DCD4F5';       // 보조 텍스트 (라벤더 화이트)
export const DIM = '#A89ED0';        // 3차 텍스트
export const GOLD = '#FFC93C';       // 라벨·강조
export const GOLD_PALE = '#FFF1B8';
export const LEAD = '#FF4F9A';       // 리더 — 핫핑크
export const FOLLOW = '#6CCBFF';     // 팔로워 — 스카이블루
export const LIVE_GREEN = '#35E67D';
export const FRAME = '#F6D98F';      // 사진 테두리 — 크림 골드

// ── 폰트 ────────────────────────────────────────────────────────────────────
// Montserrat 는 app/layout.tsx (및 TemplatePicker 의 iframe) 에서 로드.
// 한글 글리프가 없으므로 Malgun Gothic 으로 폴백한다.
export const DISPLAY =
  "'Montserrat', 'Arial Black', 'Malgun Gothic', '맑은 고딕', 'Apple SD Gothic Neo', sans-serif";

// ── 좌표 ────────────────────────────────────────────────────────────────────
// 좌우 여백을 32 로 좁게 잡아 카드 격자가 화면을 가득 채운다.
export const CX = 640;
export const MX = 32;
export const RX = 1248;
export const HEAD_Y = 52;   // 상단 러너 baseline
export const FOOT_Y = 694;  // 하단 러너 baseline

/** 좌표 문자열 — 소수 1자리. */
export const f = (n: number): string => String(Math.round(n * 10) / 10);

export type Role = 'L' | 'F';
export const ROLE_FILL: Record<Role, string> = { L: 'url(#t07Lead)', F: 'url(#t07Follow)' };
export const ROLE_COLOR: Record<Role, string> = { L: LEAD, F: FOLLOW };

export const pad2 = (n: number): string => String(n).padStart(2, '0');

/** 결정적 의사난수 — SSR/CSR·빌드마다 같은 결과. */
export function seeded(i: number): number {
  const x = Math.sin(i * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

export const COMMON_DEFS = `
  <linearGradient id="t07BgBase" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#2B1946"/>
    <stop offset="0.38" stop-color="#221B42"/>
    <stop offset="0.72" stop-color="#1B1739"/>
    <stop offset="1" stop-color="#110E23"/>
  </linearGradient>
  <radialGradient id="t07BgGlow" cx="0.5" cy="0" r="0.78" fx="0.48" fy="0">
    <stop offset="0" stop-color="#E4336F" stop-opacity="0.95"/>
    <stop offset="0.28" stop-color="#AE1F5E" stop-opacity="0.7"/>
    <stop offset="0.58" stop-color="#4C1D56" stop-opacity="0.3"/>
    <stop offset="1" stop-color="#1B1739" stop-opacity="0"/>
  </radialGradient>

  <linearGradient id="t07CardFill" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#4C3F80" stop-opacity="0.7"/>
    <stop offset="1" stop-color="#2A2154" stop-opacity="0.62"/>
  </linearGradient>
  <linearGradient id="t07CardStroke" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#D4C8FF" stop-opacity="0.78"/>
    <stop offset="1" stop-color="#7B6BB8" stop-opacity="0.32"/>
  </linearGradient>
  <linearGradient id="t07CardSheen" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.14"/>
    <stop offset="0.36" stop-color="#FFFFFF" stop-opacity="0.025"/>
    <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="t07GoldStroke" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#FFF3BF"/>
    <stop offset="0.5" stop-color="#FFC93C"/>
    <stop offset="1" stop-color="#D98A1A"/>
  </linearGradient>
  <linearGradient id="t07GoldNum" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#FFF7CC"/>
    <stop offset="0.46" stop-color="#FFD24A"/>
    <stop offset="1" stop-color="#E8941C"/>
  </linearGradient>
  <linearGradient id="t07PhotoBg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#3B2F6A"/>
    <stop offset="1" stop-color="#1C1740"/>
  </linearGradient>
  <linearGradient id="t07Lead" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#FF78B4"/>
    <stop offset="1" stop-color="#E4217A"/>
  </linearGradient>
  <linearGradient id="t07Follow" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#AEE7FF"/>
    <stop offset="1" stop-color="#3EA6E4"/>
  </linearGradient>
  <linearGradient id="t07LiveRed" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#FF4F7E"/>
    <stop offset="1" stop-color="#D3134C"/>
  </linearGradient>
  <linearGradient id="t07RuleH" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="${GOLD}" stop-opacity="0"/>
    <stop offset="0.5" stop-color="${GOLD}" stop-opacity="0.95"/>
    <stop offset="1" stop-color="${GOLD}" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="t07RuleV" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${GOLD}" stop-opacity="0"/>
    <stop offset="0.5" stop-color="${GOLD}" stop-opacity="0.55"/>
    <stop offset="1" stop-color="${GOLD}" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="t07Shine" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#FFFFFF" stop-opacity="0"/>
    <stop offset="0.5" stop-color="#FFFFFF" stop-opacity="0.85"/>
    <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="t07Eq" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#FFE58A"/>
    <stop offset="0.5" stop-color="#FF9BC4"/>
    <stop offset="1" stop-color="#FF3D8D"/>
  </linearGradient>
  <filter id="t07Soft" x="-20%" y="-20%" width="140%" height="140%">
    <feGaussianBlur stdDeviation="9"/>
  </filter>

  <!-- shared/ 모듈(judgesIntro·judgesVideo·reportSvg)이 참조하는 공용 id 를 07 팔레트로 정의 -->
  <linearGradient id="goldg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#FFF3BF"/>
    <stop offset="0.5" stop-color="#FFC93C"/>
    <stop offset="1" stop-color="#E0901C"/>
  </linearGradient>
  <linearGradient id="goldgh" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="${GOLD}" stop-opacity="0"/>
    <stop offset="0.5" stop-color="${GOLD}" stop-opacity="0.9"/>
    <stop offset="1" stop-color="${GOLD}" stop-opacity="0"/>
  </linearGradient>
  <radialGradient id="hxg" cx="0.5" cy="0.4" r="0.6">
    <stop offset="0" stop-color="#3B2F6A"/>
    <stop offset="1" stop-color="#1C1740"/>
  </radialGradient>
`;

/** 벡터 배경 — 이미지 로딩 전/실패 시에도 07 의 조명 톤을 유지한다. 커스텀 배경이 반투명일 때도 비친다. */
export const BG_VECTOR = `
  <rect x="0" y="0" width="1280" height="720" fill="url(#t07BgBase)"/>
  <rect x="0" y="0" width="1280" height="720" fill="url(#t07BgGlow)"/>
`;

/** 기본 배경 이미지 — 커스텀 배경이 없을 때만 깐다. */
export const BG_LAYER = `<image href="${BG_IMAGE}" x="0" y="0" width="1280" height="720" preserveAspectRatio="xMidYMid slice"/>`;

/**
 * 커스텀 배경 위 스크림 — 07 은 흰 글자라 밝은 사진이 오면 글자가 묻힌다.
 * 인디고로 한 번 누르고 상단 매젠타 조명을 얇게 되살려 운영자 이미지 위에서도 07 톤을 유지한다.
 */
export const OVERRIDE_SCRIM = `
  <rect x="0" y="0" width="1280" height="720" fill="${NIGHT}" fill-opacity="0.5"/>
  <rect x="0" y="0" width="1280" height="720" fill="url(#t07BgGlow)" opacity="0.4"/>
`;

/**
 * 07 의 가독성 규칙.
 *  · 기본: 얇은 어두운 외곽선 — 유리 카드 위 흰 글자의 윤곽을 잡는다.
 *  · .num  : 황금 숫자 — LED 전광판처럼 아래로 떨어지는 짙은 그림자 + 은은한 금빛 번짐.
 *  · .hero : 대형 제목 — 매젠타 조명이 글자 뒤에서 번지는 글로우.
 *  · .flat : 밝은 칩(핑크/스카이) 위 어두운 글자 — 외곽선을 끈다.
 */
export const TEXT_STYLE = `
  <style>
    svg.t07 text {
      paint-order: stroke fill;
      stroke: #0C0820;
      stroke-opacity: 0.35;
      stroke-width: max(1px, 0.03em);
      stroke-linejoin: round;
    }
    svg.t07 text.num {
      stroke: #3A1E00;
      stroke-opacity: 0.55;
      stroke-width: max(1.2px, 0.04em);
      filter: drop-shadow(0 0.05em 0 rgba(58, 24, 0, 0.6)) drop-shadow(0 0 0.25em rgba(255, 184, 48, 0.3));
    }
    svg.t07 text.hero {
      stroke-opacity: 0.25;
      filter: drop-shadow(0 0.04em 0.02em rgba(8, 4, 24, 0.55)) drop-shadow(0 0 0.35em rgba(255, 61, 141, 0.45));
    }
    svg.t07 text.flat { stroke-opacity: 0; }
  </style>
`;

export function shell(content: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" class="t07" viewBox="0 0 1280 720" preserveAspectRatio="xMidYMid meet">
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

/** 작은 황금 대문자 라벨 — CONTESTANT / COUPLE 같은 항목 이름. */
export function label(
  x: number,
  y: number,
  text: string,
  opts: { size?: number; fill?: string; anchor?: 'start' | 'middle' | 'end'; tracking?: number; weight?: number } = {}
): string {
  const { size = 12, fill = GOLD, anchor = 'middle', tracking = 3, weight = 800 } = opts;
  return `<text x="${f(x)}" y="${f(y)}" text-anchor="${anchor}" font-family="${DISPLAY}" font-weight="${weight}" font-size="${f(size)}" letter-spacing="${f(tracking)}" fill="${fill}">${text}</text>`;
}

/** 황금 그라디언트 숫자 — 참가번호·순위. */
export function goldNumber(x: number, y: number, text: string, size: number, anchor: 'start' | 'middle' | 'end' = 'middle'): string {
  return `<text class="num" x="${f(x)}" y="${f(y)}" text-anchor="${anchor}" font-family="${DISPLAY}" font-weight="900" font-size="${f(size)}" letter-spacing="${f(-size * 0.01)}" fill="url(#t07GoldNum)">${text}</text>`;
}

const RANK_SUFFIX: Record<1 | 2 | 3, string> = { 1: 'ST', 2: 'ND', 3: 'RD' };

/** 순위 표기 — 큰 황금 숫자 + 위첨자 서수(1ST / 2ND / 3RD). */
export function rankMark(cx: number, y: number, rank: 1 | 2 | 3, size: number): string {
  return `<text class="num" x="${f(cx)}" y="${f(y)}" text-anchor="middle" font-family="${DISPLAY}" font-weight="900" fill="url(#t07GoldNum)"><tspan font-size="${f(size)}">${rank}</tspan><tspan font-size="${f(size * 0.42)}" dx="2" dy="${f(-size * 0.4)}">${RANK_SUFFIX[rank]}</tspan></text>`;
}

/** 흰색 초굵은 텍스트 — 이름·값. */
export function strong(
  x: number,
  y: number,
  text: string,
  size: number,
  opts: { anchor?: 'start' | 'middle' | 'end'; fill?: string; tracking?: number; weight?: number; cls?: string } = {}
): string {
  const { anchor = 'middle', fill = WHITE, tracking = 0.3, weight = 800, cls } = opts;
  return `<text${cls ? ` class="${cls}"` : ''} x="${f(x)}" y="${f(y)}" text-anchor="${anchor}" font-family="${DISPLAY}" font-weight="${weight}" font-size="${f(size)}" letter-spacing="${f(tracking)}" fill="${fill}">${text}</text>`;
}

/** 대형 제목 + 부제 — 화면 상단 중앙 헤더. sub 에는 <tspan> 마크업을 넣을 수 있다. */
export function heading(
  title: string,
  sub: string,
  opts: { titleY?: number; subY?: number; size?: number } = {}
): string {
  const { titleY = 120, subY = 150, size = 40 } = opts;
  return `
    ${strong(CX, titleY, title, size, { cls: 'hero', weight: 900, tracking: 1 })}
    <text x="${CX}" y="${subY}" text-anchor="middle" font-family="${DISPLAY}" font-weight="800" font-size="14" letter-spacing="4" fill="${SOFT}">${sub}</text>
  `;
}

// ── 면 프리미티브 ───────────────────────────────────────────────────────────

/**
 * 유리 카드 — 07 의 기본 면.
 * gold: 1위 등 주인공 카드. 금색 테두리 + 뒤에서 번지는 금빛 글로우(블러는 이 카드에만 쓴다).
 */
export function glassCard(
  x: number,
  y: number,
  w: number,
  h: number,
  opts: { rx?: number; gold?: boolean } = {}
): string {
  const { rx = 18, gold = false } = opts;
  const r = Math.min(rx, h / 2, w / 2);
  const glow = gold
    ? `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${f(r)}" fill="none" stroke="${GOLD}" stroke-width="8" stroke-opacity="0.6" filter="url(#t07Soft)"/>`
    : '';
  return `
    <g>
      ${glow}
      <rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${f(r)}" fill="url(#t07CardFill)"
        stroke="${gold ? 'url(#t07GoldStroke)' : 'url(#t07CardStroke)'}" stroke-width="${gold ? 2.6 : 1.5}"/>
      <rect x="${f(x + 1.5)}" y="${f(y + 1.5)}" width="${f(w - 3)}" height="${f(h - 3)}" rx="${f(Math.max(0, r - 1.5))}" fill="url(#t07CardSheen)"/>
    </g>`;
}

/** 화면 폭을 가로지르는 넓은 유리 띠 — OPEN/LIVE/CALC/CLOSE 의 무대. 상단 중앙에 금빛 하이라이트. */
export function stageBand(y: number, h: number, gold = false): string {
  return `
    ${glassCard(MX, y, RX - MX, h, { rx: 26, gold })}
    <rect x="${CX - 200}" y="${f(y - 0.5)}" width="400" height="2.5" fill="url(#t07RuleH)"/>
  `;
}

/**
 * 금빛 구분선 + 가운데 마름모.
 * 선은 <line stroke=gradient> 가 아니라 얇은 <rect fill=gradient> 로 그린다 — 수평선은 bbox 높이가 0 이라
 * objectBoundingBox 그라디언트가 칠해지지 않는다(선이 통째로 사라진다).
 */
export function goldRule(y: number, half = 220, cx = CX): string {
  return `
    <g transform="translate(${f(cx)} ${f(y)})">
      <rect x="${-half}" y="-1" width="${half * 2}" height="2" fill="url(#t07RuleH)"/>
      <path d="M 0 -6 L 6 0 L 0 6 L -6 0 Z" fill="${GOLD}"/>
    </g>`;
}

/** 역할 알약 — 리더(핑크)/팔로워(스카이) 라벨. */
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

/** 번호 앞에 붙는 L / F 사각 칩. baseline 은 옆에 오는 번호의 baseline. */
export function roleChip(x: number, baseline: number, role: Role, size: number): string {
  const s = size * 0.86;
  const y = baseline - size * 0.76;
  return `
    <g>
      <rect x="${f(x)}" y="${f(y)}" width="${f(s)}" height="${f(s)}" rx="${f(s * 0.22)}" fill="${ROLE_FILL[role]}"/>
      <text class="flat" x="${f(x + s / 2)}" y="${f(y + s * 0.72)}" text-anchor="middle" font-family="${DISPLAY}"
        font-weight="900" font-size="${f(s * 0.62)}" fill="${NIGHT}">${role}</text>
    </g>`;
}

/**
 * 사진 프레임 — 라운드 사각 + 크림 골드 테두리.
 * 사진이 없으면 인물 실루엣이 옅게 남아 빈 슬롯도 "사람 자리"로 읽힌다.
 * photoKey 가 '' 이면 <image> 자체를 생략한다 (href="" 는 문서 URL 을 다시 요청한다).
 */
export function photoFrame(
  x: number,
  y: number,
  w: number,
  h: number,
  photoKey: string,
  opts: { rx?: number; ring?: string; ringW?: number } = {}
): string {
  const { rx = 10, ring = FRAME, ringW = 2.4 } = opts;
  const id = svgId('t07ph', x, y, w, h);
  const s = Math.min(w, h);
  const hx = x + w / 2;
  const image = photoKey
    ? `<image href="${photoKey}" x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id})"/>`
    : '';
  return `
    <g>
      <defs><clipPath id="${id}"><rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${f(rx)}"/></clipPath></defs>
      <rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${f(rx)}" fill="url(#t07PhotoBg)"/>
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
  const id = svgId('t07cl', x, y, w, h);
  return `<defs><clipPath id="${id}"><rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}"/></clipPath></defs><g clip-path="url(#${id})">${inner}</g>`;
}

/** 등장 — 살짝 떠오르며 나타난다. */
export function fadeUp(delay: number, inner: string, dy = 16): string {
  const b = `${delay.toFixed(2)}s`;
  return `
    <g opacity="0">
      <animate attributeName="opacity" values="0;1" dur="0.5s" begin="${b}" fill="freeze"/>
      <g transform="translate(0 ${dy})">
        <animateTransform attributeName="transform" type="translate" values="0 ${dy};0 0" keyTimes="0;1"
          calcMode="spline" keySplines="0.2 0.8 0.2 1" dur="0.6s" begin="${b}" fill="freeze"/>
        ${inner}
      </g>
    </g>`;
}

/** 제목 뒤에서 천천히 도는 무대 조명 방사선. */
export function lightRays(cx: number, cy: number, count = 18, len = 820): string {
  const id = svgId('t07ray', cx, cy);
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
        <stop offset="0" stop-color="#FFD7E6" stop-opacity="0.16"/>
        <stop offset="0.55" stop-color="#FFD7E6" stop-opacity="0.035"/>
        <stop offset="1" stop-color="#FFD7E6" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <g fill="url(#${id})">
      <animateTransform attributeName="transform" type="rotate" from="0 ${f(cx)} ${f(cy)}" to="360 ${f(cx)} ${f(cy)}" dur="120s" repeatCount="indefinite"/>
      ${body}
    </g>`;
}

/** 4갈래 반짝이. */
export function sparkle(cx: number, cy: number, r: number, fill = GOLD): string {
  const k = r * 0.22;
  return `<path d="M ${f(cx)} ${f(cy - r)} Q ${f(cx + k)} ${f(cy - k)} ${f(cx + r)} ${f(cy)} Q ${f(cx + k)} ${f(cy + k)} ${f(cx)} ${f(cy + r)} Q ${f(cx - k)} ${f(cy + k)} ${f(cx - r)} ${f(cy)} Q ${f(cx - k)} ${f(cy - k)} ${f(cx)} ${f(cy - r)} Z" fill="${fill}"/>`;
}

// ── 러너 (상단/하단) ────────────────────────────────────────────────────────

/** "● OFFICIAL LIVE DISPLAY" 외곽선 알약 — 레퍼런스의 우상단 방송 뱃지. */
function liveDisplayPill(rightX: number, cy: number): string {
  const w = 272;
  const h = 34;
  const x = rightX - w;
  return `
    <g>
      <rect x="${x}" y="${cy - h / 2}" width="${w}" height="${h}" rx="${h / 2}" fill="${NIGHT}" fill-opacity="0.32"
        stroke="${WHITE}" stroke-opacity="0.6" stroke-width="1.3"/>
      <circle cx="${x + 22}" cy="${cy}" r="5" fill="${LIVE_GREEN}">
        <animate attributeName="opacity" values="1;0.25;1" dur="1.4s" repeatCount="indefinite"/>
      </circle>
      <text x="${x + 36}" y="${f(cy + 4.3)}" font-family="${DISPLAY}" font-weight="800" font-size="12"
        letter-spacing="2.2" fill="${WHITE}">OFFICIAL LIVE DISPLAY</text>
    </g>`;
}

/**
 * 상단 러너 — 대회명(좌) · 대회 아이콘 슬롯(중앙, index.ts ICON_RECT) · 라이브 뱃지(우).
 * 대회명이 길어도 아이콘 슬롯을 침범하지 않도록 잘라낸다.
 */
export function topBar(): string {
  return `
    ${clipBox(MX, 22, 420, 44, `
      <rect x="${MX}" y="${HEAD_Y - 14}" width="5" height="18" rx="2.5" fill="${GOLD}"/>
      <text x="${MX + 16}" y="${HEAD_Y}" font-family="${DISPLAY}" font-weight="800" font-size="15"
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

/** 하단 러너 — 태그라인(좌) · 스폰서(중앙) · ● LIVE(우). 레퍼런스의 "ALL CONTESTANTS … ● LIVE" 줄. */
export function footBar(): string {
  return `
    ${clipBox(MX, FOOT_Y - 22, 264, 32, `
      <text x="${MX}" y="${FOOT_Y}" font-family="${DISPLAY}" font-weight="800" font-size="12.5"
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
