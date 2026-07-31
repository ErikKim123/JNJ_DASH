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
export const PAPER = '#FBF8F1';      // 지면
export const INK = '#17140F';        // 주 텍스트
export const INK_SOFT = '#655C4F';   // 보조 텍스트
export const LINE = '#17140F';       // 헤어라인 (낮은 opacity 로 사용)
export const ACCENT = '#A8792B';     // 앤티크 골드 — 리더 / 강조
export const TEAL = '#2E5B55';       // 딥 틸 — 팔로워
export const ROSE = '#9C4A3C';       // 테라코타 — LIVE / 3위

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
export const FOOT_RULE_Y = 592;

export const COMMON_DEFS = `
  <linearGradient id="washV" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#FFFCF6" stop-opacity="0.72"/>
    <stop offset="0.5" stop-color="#FFFCF6" stop-opacity="0.5"/>
    <stop offset="1" stop-color="#EFE7D8" stop-opacity="0.78"/>
  </linearGradient>
  <linearGradient id="goldg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#C89A45"/>
    <stop offset="1" stop-color="#8A5F1B"/>
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

/** 배경 위 밝은 워시 — 지면 바깥 여백까지 톤을 정돈해 사진이 튀지 않게 한다. */
export const WASH_LAYER = `<rect x="0" y="0" width="1280" height="720" fill="url(#washV)"/>`;

/** 아이보리 지면 — 06 의 가독성 보증 장치. 0.94 불투명도로 사실상 배경을 가린다. */
export const CARD_LAYER = `
  <g>
    <rect x="${CARD_X + 3}" y="${CARD_Y + 4}" width="${CARD_W}" height="${CARD_H}" rx="2" fill="#2A2318" opacity="0.14"/>
    <rect x="${CARD_X}" y="${CARD_Y}" width="${CARD_W}" height="${CARD_H}" rx="2" fill="${PAPER}" fill-opacity="0.94"/>
    <rect x="${CARD_X}" y="${CARD_Y}" width="${CARD_W}" height="${CARD_H}" rx="2" fill="none" stroke="${LINE}" stroke-opacity="0.24" stroke-width="1"/>
    <rect x="${CARD_X + 12}" y="${CARD_Y + 12}" width="${CARD_W - 24}" height="${CARD_H - 24}" rx="1" fill="none" stroke="${ACCENT}" stroke-opacity="0.3" stroke-width="0.8"/>
  </g>
`;

/**
 * 06 의 가독성 규칙.
 *  · 본문은 거의 불투명한 지면 위에 있으므로 halo 가 필요 없다 — 세리프의 가는 획을
 *    외곽선으로 덧그리면 오히려 뭉개진다. 기본값은 stroke 없음.
 *  · 지면 밖(사진 위)에 놓이는 텍스트만 .on-photo 로 밝은 halo 를 준다.
 */
export const TEXT_STYLE = `
  <style>
    svg.t06 text { paint-order: stroke fill; stroke: none; }
    svg.t06 text.on-photo {
      stroke: #FFFDF6;
      stroke-opacity: 0.75;
      stroke-width: max(1.6px, 0.06em);
      stroke-linejoin: round;
      filter: drop-shadow(0 1px 2px rgba(255,255,255,0.6));
    }
  </style>
`;

export function shell(content: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" class="t06" viewBox="0 0 1280 720" preserveAspectRatio="xMidYMid meet">
  <defs>${COMMON_DEFS}</defs>
  ${TEXT_STYLE}
  ${BG_LAYER}
  <!--BG_OVERRIDE_SLOT-->
  ${WASH_LAYER}
  ${CARD_LAYER}
  ${content}
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

/** 하단 러너 — 헤어라인 + 태그라인 + 스폰서 로고 6슬롯. */
export function footBar(): string {
  return `
    ${hairline(FOOT_RULE_Y, MX, RX, 0.14)}
    <text x="${CX}" y="${FOOT_RULE_Y + 26}" text-anchor="middle" font-family="${BODY}" font-weight="300"
      font-size="13" letter-spacing="4" fill="${INK_SOFT}">{{tagline}}</text>
    ${sponsorRow()}
  `;
}

/**
 * 스폰서 로고 6슬롯 — 지면 하단 중앙 정렬.
 * 박스 130×40, 간격 26 → 총 폭 910, 지면(1152) 안에 여유 있게 들어간다.
 */
export function sponsorRow(cy = 650, boxW = 130, boxH = 40, gap = 26): string {
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

/** 지면 위에 한 겹 더 얹는 옅은 구획 — 표/명단 블록의 배경. */
export function panel(x: number, y: number, w: number, h: number, opacity = 0.5): string {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="#EFE8D9" fill-opacity="${opacity}" stroke="${LINE}" stroke-opacity="0.1" stroke-width="1"/>`;
}

// clipPath id 충돌 방지 카운터.
let portraitCounter = 0;

/** 인물 초상 — 원형 + 얇은 두 겹 링(도록의 인물 사진 규칙). */
export function portrait(cx: number, cy: number, r: number, photoKey: string, ring = ACCENT): string {
  const id = `t06p-${++portraitCounter}`;
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
      <circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="${br.toFixed(1)}" fill="${PAPER}" stroke="${ring}" stroke-width="1"/>
      <text x="${bx.toFixed(1)}" y="${(by + br * 0.34).toFixed(1)}" text-anchor="middle" font-family="${MONO}"
        font-size="${(br * 0.86).toFixed(1)}" font-weight="700" fill="${ring}">${text}</text>
    </g>
  `;
}

/** 로마 숫자 순위 표기 — 도록 톤에 맞춘 1·2·3위 라벨. */
export const ROMAN: Record<1 | 2 | 3, string> = { 1: 'I', 2: 'II', 3: 'III' };
