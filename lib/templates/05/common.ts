import { svgId } from '@/lib/templates/shared/svgId';
// Template 05 — "MIDNIGHT EDITORIAL"
//
// 설계 의도 (04 의 한계 → 05 의 해법)
//  · 04 는 배경 이미지 위에 글자를 직접 올리고 halo(외곽선)만으로 가독성을 확보했다.
//    halo 는 밝은 배경에서 글자를 살려주지만, 배경이 복잡한 사진이면 글자 주변이 지저분해진다.
//  · 05 는 "글자를 배경에서 분리한다"는 원칙을 쓴다.
//      1) SCRIM — 배경 위 전면 그라디언트(좌→우 어둡게 + 상·하 어둡게). 어떤 배경이 와도
//         텍스트가 놓이는 좌측·상단·하단의 명도가 항상 일정하게 낮아진다.
//      2) PLATE — 명단/칩처럼 정보 밀도가 높은 블록은 반투명 판 위에 올린다.
//      3) 잔여 halo — 위 두 겹으로 이미 대비가 확보되므로 04 보다 훨씬 얇게(0.045em) 써서
//         글자 윤곽이 뭉개지지 않게 한다.
//  · 레이아웃은 중앙정렬(01~04)이 아니라 좌측 정렬 비대칭 — 큰 제목이 좌측 라인에 맞아
//    읽기 시작점이 항상 같고, 우측에는 배경 사진이 그대로 보인다.
//  · 타이포: 콘덴스드 산세리프(Oswald) 대문자 = 같은 폭에 더 큰 글자 → 원거리 가독성 상승.
//    숫자/코드(참가번호)는 모노스페이스로 분리해 이름과 혼동되지 않게 한다.

export const BG_IMAGE = '/templates/02/background.jpg';

// ── 팔레트 ──────────────────────────────────────────────────────────────────
export const INK = '#06060A';        // 스크림 기본색
export const PAPER = '#F7F5F0';      // 주 텍스트 (약간 따뜻한 화이트)
export const DIM = '#B7B2A9';        // 보조 텍스트
export const ACCENT = '#E9B44C';     // 앰버 골드 — 강조 1
export const ACCENT_DEEP = '#8A6A25';
export const COOL = '#D7DEE6';       // 팔로워 = 쿨 실버
export const LIVE = '#FF4747';

// ── 폰트 스택 ───────────────────────────────────────────────────────────────
// Oswald/Inter 는 app/layout.tsx (및 TemplatePicker 의 iframe) 에서 로드.
// 한글은 두 폰트 모두 글리프가 없으므로 Malgun Gothic 으로 폴백한다.
export const DISPLAY = "'Oswald', 'Archivo Narrow', 'Malgun Gothic', '맑은 고딕', 'Apple SD Gothic Neo', sans-serif";
export const BODY = "'Inter', 'Segoe UI', 'Malgun Gothic', '맑은 고딕', 'Apple SD Gothic Neo', sans-serif";
export const MONO = "ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace";

// ── 좌표 그리드 ─────────────────────────────────────────────────────────────
export const MX = 96;    // 좌측 기준선
export const RX = 1184;  // 우측 기준선
export const HEAD_Y = 92;
export const HEAD_RULE_Y = 110;
export const FOOT_RULE_Y = 626;

export const COMMON_DEFS = `
  <linearGradient id="scrimL" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="${INK}" stop-opacity="0.93"/>
    <stop offset="0.42" stop-color="${INK}" stop-opacity="0.74"/>
    <stop offset="1" stop-color="${INK}" stop-opacity="0.34"/>
  </linearGradient>
  <linearGradient id="scrimV" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${INK}" stop-opacity="0.82"/>
    <stop offset="0.24" stop-color="${INK}" stop-opacity="0.18"/>
    <stop offset="0.74" stop-color="${INK}" stop-opacity="0.34"/>
    <stop offset="1" stop-color="${INK}" stop-opacity="0.92"/>
  </linearGradient>
  <linearGradient id="accentV" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#FFD98A"/>
    <stop offset="1" stop-color="${ACCENT_DEEP}"/>
  </linearGradient>
  <linearGradient id="accentH" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="${ACCENT}"/>
    <stop offset="1" stop-color="${ACCENT}" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="coolV" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#F1F5F9"/>
    <stop offset="1" stop-color="#8C97A3"/>
  </linearGradient>
  <linearGradient id="liveG" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#FF6B6B"/>
    <stop offset="1" stop-color="#C22B2B"/>
  </linearGradient>
  <radialGradient id="halo" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0" stop-color="${ACCENT}" stop-opacity="0.32"/>
    <stop offset="1" stop-color="${ACCENT}" stop-opacity="0"/>
  </radialGradient>

  <!-- shared/ 모듈(judgesIntro·judgesVideo·reportSvg)이 참조하는 공용 id 를 05 팔레트로 정의 -->
  <linearGradient id="goldg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#FFD98A"/>
    <stop offset="1" stop-color="${ACCENT_DEEP}"/>
  </linearGradient>
  <linearGradient id="goldgh" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="${ACCENT}" stop-opacity="0"/>
    <stop offset="0.5" stop-color="${ACCENT}" stop-opacity="0.85"/>
    <stop offset="1" stop-color="${ACCENT}" stop-opacity="0"/>
  </linearGradient>
  <radialGradient id="hxg" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0" stop-color="#1A1A22"/>
    <stop offset="1" stop-color="#0B0B10"/>
  </radialGradient>
`;

export const BG_LAYER = `
  <svg x="0" y="0" width="1280" height="720" viewBox="280 0 1831 2834" preserveAspectRatio="xMidYMid slice">
    <image href="${BG_IMAGE}" x="0" y="0" width="2391" height="2834"/>
  </svg>
`;

/** 배경 위 2겹 스크림 — 어떤 사진/색이 배경으로 와도 텍스트 영역의 명도를 고정한다. */
export const SCRIM_LAYER = `
  <rect x="0" y="0" width="1280" height="720" fill="url(#scrimL)"/>
  <rect x="0" y="0" width="1280" height="720" fill="url(#scrimV)"/>
`;

/**
 * 05 의 가독성 규칙.
 *  · 스크림이 대비를 대부분 책임지므로 halo 는 04(0.09em) 의 절반 수준으로 얇게.
 *  · .on-plate 클래스가 붙은 텍스트(불투명 판 위)는 halo 를 아예 끈다 — 판 위에서는
 *    외곽선이 오히려 글자를 흐리게 만든다.
 */
export const TEXT_STYLE = `
  <style>
    svg.t05 text {
      paint-order: stroke fill;
      stroke: #03030A;
      stroke-opacity: 0.5;
      stroke-width: max(1.2px, 0.045em);
      stroke-linejoin: round;
      filter: drop-shadow(0 1px 3px rgba(0,0,0,0.55));
    }
    svg.t05 text.on-plate {
      stroke-opacity: 0;
      filter: none;
    }
  </style>
`;

export function shell(content: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" class="t05" viewBox="0 0 1280 720" preserveAspectRatio="xMidYMid meet">
  <defs>${COMMON_DEFS}</defs>
  ${TEXT_STYLE}
  ${BG_LAYER}
  <!--BG_OVERRIDE_SLOT-->
  ${SCRIM_LAYER}
  ${content}
  <!--ICON_SLOT-->
</svg>`;
}

// ── 레이아웃 프리미티브 ─────────────────────────────────────────────────────

export function rule(y: number, x1 = MX, x2 = RX, opacity = 0.16, color = PAPER): string {
  return `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${color}" stroke-width="1" opacity="${opacity}"/>`;
}

/** 제목 왼쪽의 세로 강조 바 — 05 의 시그니처. */
export function accentBar(y: number, h: number, x = MX): string {
  return `<rect x="${x}" y="${y}" width="5" height="${h}" fill="url(#accentV)"/>`;
}

/**
 * 상단 러너 — 대회명(좌) + 보조 정보(우) + 헤어라인.
 * right 를 '' 로 주면 우측을 비운다 (본문에서 stage_label 을 크게 쓰는 화면용 — 중복 방지).
 */
export function topBar(right = '{{stage_label}}'): string {
  const rightEl = right
    ? `<text x="${RX}" y="${HEAD_Y}" text-anchor="end" font-family="${MONO}" font-size="12" letter-spacing="5" fill="${DIM}">${right}</text>`
    : '';
  return `
    <text x="${MX}" y="${HEAD_Y}" font-family="${MONO}" font-size="13" letter-spacing="6" fill="${ACCENT}">{{festival_header}}</text>
    ${rightEl}
    ${rule(HEAD_RULE_Y)}
  `;
}

/** 하단 러너 — 헤어라인 + 태그라인(좌) + 스폰서 로고(우). */
export function footBar(): string {
  return `
    ${rule(FOOT_RULE_Y, MX, RX, 0.14)}
    <text x="${MX}" y="${FOOT_RULE_Y + 42}" font-family="${BODY}" font-size="13" letter-spacing="3.5" fill="${DIM}">{{tagline}}</text>
    ${sponsorRow()}
  `;
}

/**
 * 스폰서 로고 6슬롯 — 우측 정렬(태그라인과 좌우로 나뉘어 하단 러너를 구성).
 * 박스 108×40, 간격 20 → 총 폭 748, 우측 기준선(1184)에 끝을 맞춘다.
 */
export function sponsorRow(cy = FOOT_RULE_Y + 36, boxW = 108, boxH = 40, gap = 20): string {
  const total = 6 * boxW + 5 * gap;
  const startX = RX - total;
  let body = '';
  for (let i = 0; i < 6; i++) {
    const x = startX + i * (boxW + gap);
    body += `<image href="{{sponsor_logo_${i + 1}}}" x="${x}" y="${cy - boxH / 2}" width="${boxW}" height="${boxH}" preserveAspectRatio="xMidYMid meet" opacity="{{sponsor_opacity_${i + 1}}}"/>`;
  }
  return `<g>${body}</g>`;
}

/** 반투명 판 — 정보 밀도가 높은 블록(명단/칩)을 배경에서 완전히 분리한다. */
export function plate(
  x: number,
  y: number,
  w: number,
  h: number,
  opts: { rx?: number; fill?: string; opacity?: number; stroke?: string; strokeOpacity?: number } = {}
): string {
  const { rx = 4, fill = '#0A0A0F', opacity = 0.52, stroke = PAPER, strokeOpacity = 0.12 } = opts;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" fill-opacity="${opacity}" stroke="${stroke}" stroke-opacity="${strokeOpacity}" stroke-width="1"/>`;
}

/** 작은 라벨 — 모노스페이스 대문자 + 넓은 자간. 05 의 메타 정보 표기 규칙. */
export function metaLabel(
  x: number,
  y: number,
  text: string,
  opts: { size?: number; fill?: string; anchor?: 'start' | 'middle' | 'end'; tracking?: number } = {}
): string {
  const { size = 13, fill = ACCENT, anchor = 'start', tracking = 6 } = opts;
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${MONO}" font-size="${size}" letter-spacing="${tracking}" fill="${fill}">${text}</text>`;
}

// clipPath id 는 타일 좌표/크기에서 결정론적으로 생성 (SSR/CSR 동일).

/**
 * 인물 타일 — 04 의 육각형 대신 라운드 사각형(에디토리얼 그리드와 같은 리듬).
 * 사진이 없으면 어두운 판 + 얇은 앰버 테두리만 남아 빈 슬롯도 정돈돼 보인다.
 */
/**
 * 인물 타일 좌하단에 붙는 참가번호 배지.
 * 04 는 번호를 타일 "아래" 별도 줄에 뒀는데, 그러면 이름·번호·순위 라벨이 세로로 3줄
 * 쌓여 하단 여백을 잡아먹는다. 번호를 타일 안으로 넣으면 사진과 한 덩어리로 읽히고
 * 타일 밖에는 이름만 남아 시각적 계층이 단순해진다.
 */
export function numBadge(cx: number, cy: number, size: number, text: string, accent = ACCENT): string {
  const fs = Math.max(9, Math.min(15, size * 0.16));
  const padX = fs * 0.6;
  const bw = fs * 3.6;
  const bh = fs * 1.7;
  const x = cx - size / 2 + 5;
  const y = cy + size / 2 - bh - 5;
  return `
    <g>
      <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="2"
        fill="${INK}" fill-opacity="0.82" stroke="${accent}" stroke-opacity="0.55" stroke-width="0.8"/>
      <text class="on-plate" x="${(x + padX).toFixed(1)}" y="${(y + bh * 0.72).toFixed(1)}" font-family="${MONO}"
        font-size="${fs.toFixed(1)}" font-weight="700" letter-spacing="0.5" fill="${accent}">${text}</text>
    </g>
  `;
}

export function photoTile(
  cx: number,
  cy: number,
  size: number,
  photoKey: string,
  accent = ACCENT
): string {
  const id = svgId('t05tile', cx, cy, size);
  const x = cx - size / 2;
  const y = cy - size / 2;
  const r = Math.max(3, size * 0.06);
  return `
    <g>
      <defs><clipPath id="${id}"><rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${r}"/></clipPath></defs>
      <rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${r}" fill="url(#hxg)"/>
      <image href="${photoKey}" x="${x}" y="${y}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id})"/>
      <rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${r}" fill="none" stroke="${accent}" stroke-width="1.4" opacity="0.9"/>
      <rect x="${x + 4}" y="${y + 4}" width="${size - 8}" height="${size - 8}" rx="${Math.max(1, r - 2)}" fill="none" stroke="${PAPER}" stroke-width="0.6" opacity="0.18"/>
    </g>
  `;
}
