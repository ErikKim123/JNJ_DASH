import { svgId } from '@/lib/templates/shared/svgId';
// Template 06 — "IVORY GALLERY"
//
// 05 와 정반대 전략으로 "배경 무관 가독성"을 푼다.
//  · 05: 배경을 어둡게 깔고 밝은 글자를 올린다(다크 스크림).
//  · 06: 배경 위에 아이보리 "지면(card)"을 거의 불투명하게 올리고 그 위에 진한 잉크색 글자를 쓴다.
//    → 배경이 흰색이든 검정 사진이든 지면 안쪽의 명도가 고정되므로 대비가 항상 동일하다.
//    → 배경 사진은 지면 바깥 여백(테두리 32~64px)과 6% 투과로만 비쳐 분위기만 남긴다.
//  · 레이아웃은 중앙 대칭 — 전시 도록/초대장 문법. 05(좌측 비대칭)와 한눈에 구분된다.
//  · 타이포: 고대비 세리프(Playfair Display) 대문자 제목 + 산세리프 소문자 본문 +
//    모노스페이스 번호. 세 층위가 폰트로 분리돼 정보 종류가 즉시 구분된다.

export const BG_IMAGE = '/templates/02/background.jpg';

// ── 팔레트 ──────────────────────────────────────────────────────────────────
//
// 06 은 "화이트 모드" 템플릿 — 배경으로 밝은 이미지(또는 흰 배경)를 깐다는 전제.
// 그래서 글자는 전부 어두운 계열이고, 대비는 TEXT_STYLE 의 밝은 halo 가 보강한다.
// 강조색도 흰 배경에서 눈부시지 않도록 노란기를 뺀 진한 톤을 쓴다
// (밝은 골드/노랑은 흰 배경에서 대비가 급락하고 눈이 쉽게 피로해진다).
export const PAPER = '#FBF8F1';      // 어두운 칩 위에 얹는 글자 / 밝은 면
export const INK = '#141110';        // 주 텍스트
export const INK_SOFT = '#544C40';   // 보조 텍스트
export const INK_DEEP = '#0E0C09';   // 최상위 대비가 필요한 글자
export const LINE = '#141110';       // 헤어라인 (낮은 opacity 로 사용)
export const PLATE = '#E9E1D1';      // 반투명 밝은 판 — 정보 밀도 높은 블록 배경
export const ACCENT = '#6E5119';     // 딥 브론즈 — 리더 / 강조 (노란기 뺀 진한 금)
export const TEAL = '#1E4A44';       // 딥 틸 — 팔로워
export const ROSE = '#7E3A2D';       // 딥 테라코타 — LIVE / 3위

// ── 폰트 스택 ───────────────────────────────────────────────────────────────
export const DISPLAY = "'Playfair Display', 'Cormorant Garamond', Georgia, 'Batang', '바탕', serif";
export const BODY = "'Inter', 'Segoe UI', 'Malgun Gothic', '맑은 고딕', 'Apple SD Gothic Neo', sans-serif";
export const MONO = "ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace";

// ── 지면 좌표 ───────────────────────────────────────────────────────────────
export const CARD_X = 64;
export const CARD_Y = 44;
export const CARD_W = 1152;
export const CARD_H = 632;
export const MX = 120;               // 지면 안쪽 좌측 기준선
export const RX = 1160;              // 지면 안쪽 우측 기준선
export const CX = 640;
export const HEAD_Y = 104;
// 하단 러너 라인 — 지면 하단(CARD_Y + CARD_H = 676) 바로 위.
// 상단 러너(124)와 짝을 이뤄 화면 위·아래를 잡아주는 경계선이라, 예전 위치(592)처럼
// 중간에 떠 있으면 아래쪽에 빈 띠가 남는다. 태그라인·스폰서는 이 선 위쪽에 배치.
export const FOOT_RULE_Y = 664;

export const COMMON_DEFS = `
  <linearGradient id="washV" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#FFFCF6" stop-opacity="0.72"/>
    <stop offset="0.5" stop-color="#FFFCF6" stop-opacity="0.5"/>
    <stop offset="1" stop-color="#EFE7D8" stop-opacity="0.78"/>
  </linearGradient>
  <linearGradient id="goldg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#8A6725"/>
    <stop offset="1" stop-color="#4E3A12"/>
  </linearGradient>
  <linearGradient id="goldgh" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="${ACCENT}" stop-opacity="0"/>
    <stop offset="0.5" stop-color="${ACCENT}" stop-opacity="0.75"/>
    <stop offset="1" stop-color="${ACCENT}" stop-opacity="0"/>
  </linearGradient>
  <radialGradient id="hxg" cx="0.5" cy="0.4" r="0.6">
    <stop offset="0" stop-color="#EFE9DC"/>
    <stop offset="1" stop-color="#DCD3C2"/>
  </radialGradient>
  <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0" stop-color="${ACCENT}" stop-opacity="0.18"/>
    <stop offset="1" stop-color="${ACCENT}" stop-opacity="0"/>
  </radialGradient>
`;

export const BG_LAYER = `
  <svg x="0" y="0" width="1280" height="720" viewBox="280 0 1831 2834" preserveAspectRatio="xMidYMid slice">
    <image href="${BG_IMAGE}" x="0" y="0" width="2391" height="2834"/>
  </svg>
`;

/**
 * 기본 배경 사진 위 밝은 워시 — 커스텀 배경이 없을 때만 쓴다.
 * 06 은 어두운 글자를 쓰므로 기본 사진도 밝게 눌러 화이트 모드 톤을 맞춘다.
 * 커스텀 배경을 올리면 운영자가 고른 이미지를 그대로 보여야 하므로 렌더하지 않는다.
 */
export const WASH_LAYER = `<rect x="0" y="0" width="1280" height="720" fill="url(#washV)"/>`;

/**
 * 지면(card) — 완전 제거.
 * 원래는 아이보리 판(0.94) + 이중 테두리 프레임이었지만,
 *   1) 운영자가 올린 배경 이미지가 그대로 보여야 해서 면(fill)을 없앴고,
 *   2) 남아 있던 바깥 테두리 라인도 배경 위에 액자처럼 걸려 보여 함께 걷어냈다.
 * CARD_X/Y/W/H 는 여전히 콘텐츠 배치 기준(안전 영역)으로 쓰이므로 상수는 유지한다.
 * 가독성은 TEXT_STYLE 의 halo 가 담당한다.
 */
export const CARD_LAYER = '';

/**
 * 06 의 가독성 규칙 (화이트 모드).
 *  · 지면(card)이 투명하므로 어두운 글자가 배경 이미지 위에 바로 놓인다 — 사진의 어두운
 *    부분에서 글자가 묻히지 않도록 밝은 halo 를 얇게 깐다. 세리프의 가는 획이 뭉개지지
 *    않을 만큼만(0.04em) 쓴다.
 *  · .on-photo 는 배경 대비가 특히 나쁜 자리(큰 제목 등)에 쓰는 강한 halo.
 */
export const TEXT_STYLE = `
  <style>
    svg.t06 text {
      paint-order: stroke fill;
      stroke: #FFFDF6;
      stroke-opacity: 0.62;
      stroke-width: max(1.1px, 0.04em);
      stroke-linejoin: round;
    }
    svg.t06 text.on-photo {
      stroke-opacity: 0.85;
      stroke-width: max(1.8px, 0.07em);
      filter: drop-shadow(0 1px 2px rgba(255,255,255,0.7));
    }
  </style>
`;

export function shell(content: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" class="t06" viewBox="0 0 1280 720" preserveAspectRatio="xMidYMid meet">
  <defs>${COMMON_DEFS}</defs>
  ${TEXT_STYLE}
  <!--BG_DEFAULT_SLOT-->
  <!--BG_OVERRIDE_SLOT-->
  ${CARD_LAYER}
  ${content}
  <!--ICON_SLOT-->
</svg>`;
}

// ── 레이아웃 프리미티브 ─────────────────────────────────────────────────────

export function hairline(y: number, x1 = MX, x2 = RX, opacity = 0.18, color = LINE): string {
  return `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${color}" stroke-width="1" opacity="${opacity}"/>`;
}

/** 중앙 오너먼트 — 얇은 선 두 줄 사이에 작은 마름모. 도록의 절 구분자. */
export function ornament(y: number, half = 220, color = ACCENT): string {
  return `
    <g transform="translate(${CX} ${y})">
      <line x1="${-half}" y1="0" x2="-16" y2="0" stroke="url(#goldgh)" stroke-width="1"/>
      <line x1="16" y1="0" x2="${half}" y2="0" stroke="url(#goldgh)" stroke-width="1"/>
      <path d="M 0 -5 L 5 0 L 0 5 L -5 0 Z" fill="${color}"/>
    </g>
  `;
}

/** 상단 러너 — 대회명(중앙, 넓은 자간) + 양옆 헤어라인. */
export function topBar(): string {
  return `
    <text x="${CX}" y="${HEAD_Y}" text-anchor="middle" font-family="${MONO}" font-size="13"
      letter-spacing="9" fill="${ACCENT}">{{festival_header}}</text>
    ${hairline(124, MX, RX, 0.16)}
  `;
}

/**
 * 하단 러너 — 태그라인 + 스폰서 로고 6슬롯 + 헤어라인.
 * 헤어라인이 화면 하단 경계 역할을 하므로 태그라인·스폰서를 그 "위"에 쌓는다
 * (태그라인 596 → 스폰서 608~648 → 라인 664).
 */
export function footBar(): string {
  return `
    <text x="${CX}" y="${FOOT_RULE_Y - 68}" text-anchor="middle" font-family="${BODY}" font-weight="300"
      font-size="13" letter-spacing="4" fill="${INK_SOFT}">{{tagline}}</text>
    ${sponsorRow()}
    ${hairline(FOOT_RULE_Y, MX, RX, 0.14)}
  `;
}

/**
 * 스폰서 로고 6슬롯 — 하단 러너 라인 바로 위 중앙 정렬.
 * 박스 130×40, 간격 26 → 총 폭 910, 지면(1152) 안에 여유 있게 들어간다.
 */
export function sponsorRow(cy = FOOT_RULE_Y - 36, boxW = 130, boxH = 40, gap = 26): string {
  const total = 6 * boxW + 5 * gap;
  const startX = CX - total / 2;
  let body = '';
  for (let i = 0; i < 6; i++) {
    const x = startX + i * (boxW + gap);
    body += `<image href="{{sponsor_logo_${i + 1}}}" x="${x}" y="${cy - boxH / 2}" width="${boxW}" height="${boxH}" preserveAspectRatio="xMidYMid meet" opacity="{{sponsor_opacity_${i + 1}}}"/>`;
  }
  return `<g>${body}</g>`;
}

/** 작은 라벨 — 모노스페이스 + 넓은 자간. 06 의 메타 표기 규칙. */
export function metaLabel(
  x: number,
  y: number,
  text: string,
  opts: { size?: number; fill?: string; anchor?: 'start' | 'middle' | 'end'; tracking?: number } = {}
): string {
  const { size = 13, fill = ACCENT, anchor = 'middle', tracking = 8 } = opts;
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${MONO}" font-size="${size}" letter-spacing="${tracking}" fill="${fill}">${text}</text>`;
}

/**
 * 배경 위에 얹는 구획 판 — 표/명단처럼 정보 밀도가 높은 블록의 배경.
 * 어두운 글자를 쓰므로 판은 밝게(따뜻한 아이보리) 깔아 명단 영역만 명도를 고정한다.
 */
export function panel(x: number, y: number, w: number, h: number, opacity = 0.5): string {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${PLATE}" fill-opacity="${opacity}" stroke="${LINE}" stroke-opacity="0.1" stroke-width="1"/>`;
}

// clipPath id 는 초상 좌표/반지름에서 결정론적으로 생성 (SSR/CSR 동일).

/** 인물 초상 — 원형 + 얇은 두 겹 링(도록의 인물 사진 규칙). */
export function portrait(cx: number, cy: number, r: number, photoKey: string, ring = ACCENT): string {
  const id = svgId('t06p', cx, cy, r);
  return `
    <g>
      <defs><clipPath id="${id}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath></defs>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#hxg)"/>
      <image href="${photoKey}" x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}"
        preserveAspectRatio="xMidYMid slice" clip-path="url(#${id})"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${ring}" stroke-width="1.4"/>
      <circle cx="${cx}" cy="${cy}" r="${r + 5}" fill="none" stroke="${ring}" stroke-width="0.6" opacity="0.45"/>
    </g>
  `;
}

/**
 * 초상 우하단에 겹치는 참가번호 배지.
 * 이름·번호를 세로로 두 줄 쌓으면 하단 여백이 부족해지므로 번호는 사진에 붙인다.
 */
export function numBadge(cx: number, cy: number, r: number, text: string, ring = ACCENT): string {
  const br = Math.max(13, r * 0.34);
  const bx = cx + r * 0.72;
  const by = cy + r * 0.72;
  return `
    <g>
      <circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="${br.toFixed(1)}" fill="${PAPER}" fill-opacity="0.92" stroke="${ring}" stroke-width="1"/>
      <text x="${bx.toFixed(1)}" y="${(by + br * 0.34).toFixed(1)}" text-anchor="middle" font-family="${MONO}"
        font-size="${(br * 0.86).toFixed(1)}" font-weight="700" fill="${ring}">${text}</text>
    </g>
  `;
}

/** 로마 숫자 순위 표기 — 도록 톤에 맞춘 1·2·3위 라벨. */
export const ROMAN: Record<1 | 2 | 3, string> = { 1: 'I', 2: 'II', 3: 'III' };
