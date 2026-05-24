// Design Ref: §11.1 #6 — Template 01의 공통 SVG 빌딩 블록.
// 원본: DashDesignTemplates/01/jeju_bachata_process_templates.html (lines 184-456)
// 함수 시그니처는 그대로 유지하되 TS로 마이그레이션. 모든 함수는 SVG 문자열 반환.

export const COMMON_DEFS = `
  <radialGradient id="bgr" cx="0.5" cy="0.42" r="0.95">
    <stop offset="0" stop-color="#1B4232"/>
    <stop offset="0.45" stop-color="#0F2C20"/>
    <stop offset="1" stop-color="#040C08"/>
  </radialGradient>
  <linearGradient id="goldg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#FFEBA0"/>
    <stop offset="0.5" stop-color="#FFD56B"/>
    <stop offset="1" stop-color="#C68F3C"/>
  </linearGradient>
  <linearGradient id="goldgh" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#9C7C2C" stop-opacity="0"/>
    <stop offset="0.5" stop-color="#FFD56B"/>
    <stop offset="1" stop-color="#9C7C2C" stop-opacity="0"/>
  </linearGradient>
  <radialGradient id="sgw" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0" stop-color="#FFFAE0"/>
    <stop offset="0.25" stop-color="#FFD56B" stop-opacity="0.95"/>
    <stop offset="0.7" stop-color="#FFD56B" stop-opacity="0.25"/>
    <stop offset="1" stop-color="#FFD56B" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="palmg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#FFD56B"/>
    <stop offset="0.5" stop-color="#D4AF37"/>
    <stop offset="1" stop-color="#9C7C2C"/>
  </linearGradient>
  <linearGradient id="silverg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#F0F0F2"/>
    <stop offset="0.5" stop-color="#C0C0C8"/>
    <stop offset="1" stop-color="#7A7A82"/>
  </linearGradient>
  <linearGradient id="bronzeg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#E89F65"/>
    <stop offset="0.5" stop-color="#B07050"/>
    <stop offset="1" stop-color="#6E4030"/>
  </linearGradient>
  <linearGradient id="liveg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#FF8B8B"/>
    <stop offset="1" stop-color="#D04040"/>
  </linearGradient>
  <radialGradient id="hxg" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0" stop-color="#1A4030"/>
    <stop offset="1" stop-color="#0A2018"/>
  </radialGradient>
  <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
    <feGaussianBlur stdDeviation="3" result="blur"/>
    <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
`;

export const BG_LAYER = `
  <rect width="1280" height="720" fill="url(#bgr)"/>
  <g fill="none" stroke-linecap="round" opacity="0.55">
    <path d="M 110 -30 Q 160 200 80 400 T 130 750" stroke="url(#goldg)" stroke-width="11" opacity="0.5"/>
    <path d="M 1170 -30 Q 1120 220 1200 420 T 1150 750" stroke="url(#goldg)" stroke-width="11" opacity="0.5"/>
    <path d="M 50 -30 Q 100 220 30 460 T 80 750" stroke="url(#goldg)" stroke-width="6" opacity="0.3"/>
    <path d="M 1230 -30 Q 1180 220 1250 460 T 1200 750" stroke="url(#goldg)" stroke-width="6" opacity="0.3"/>
  </g>
`;

export const PALM_LAYER = `
  <g opacity="0.5">
    <g transform="translate(80 540)">
      <path d="M 5 0 Q 3 -80 6 -160 Q 9 -220 12 -270" stroke="url(#palmg)" stroke-width="4" fill="none"/>
      <g fill="url(#palmg)">
        <path d="M 12 -270 Q -25 -290 -65 -278 Q -38 -282 -2 -266 Q 5 -267 12 -270 Z"/>
        <path d="M 12 -270 Q 50 -295 85 -282 Q 56 -286 22 -267 Z"/>
        <path d="M 12 -270 Q -10 -315 -28 -345 Q -2 -325 14 -278 Z"/>
        <path d="M 12 -270 Q 34 -315 48 -348 Q 28 -325 18 -278 Z"/>
        <path d="M 5 -266 Q -42 -252 -68 -232 Q -36 -255 -2 -262 Z"/>
        <path d="M 12 -270 Q 56 -255 80 -238 Q 48 -258 18 -264 Z"/>
      </g>
    </g>
    <g transform="translate(1200 540)">
      <path d="M -5 0 Q -3 -80 -6 -160 Q -9 -220 -12 -270" stroke="url(#palmg)" stroke-width="4" fill="none"/>
      <g fill="url(#palmg)">
        <path d="M -12 -270 Q 25 -290 65 -278 Q 38 -282 2 -266 Q -5 -267 -12 -270 Z"/>
        <path d="M -12 -270 Q -50 -295 -85 -282 Q -56 -286 -22 -267 Z"/>
        <path d="M -12 -270 Q 10 -315 28 -345 Q 2 -325 -14 -278 Z"/>
        <path d="M -12 -270 Q -34 -315 -48 -348 Q -28 -325 -18 -278 Z"/>
        <path d="M -5 -266 Q 42 -252 68 -232 Q 36 -255 2 -262 Z"/>
        <path d="M -12 -270 Q -56 -255 -80 -238 Q -48 -258 -18 -264 Z"/>
      </g>
    </g>
  </g>
`;

export const FRAME_LAYER = `
  <rect x="22" y="22" width="1236" height="676" fill="none" stroke="#D4AF37" stroke-width="2"/>
  <rect x="34" y="34" width="1212" height="652" fill="none" stroke="#D4AF37" stroke-width="0.6" opacity="0.55"/>
  <g fill="#D4AF37">
    <polygon points="22,22 124,22 112,34 46,34 34,46 34,112 22,124"/>
    <g transform="translate(1280 0) scale(-1 1)"><polygon points="22,22 124,22 112,34 46,34 34,46 34,112 22,124"/></g>
    <g transform="translate(0 720) scale(1 -1)"><polygon points="22,22 124,22 112,34 46,34 34,46 34,112 22,124"/></g>
    <g transform="translate(1280 720) scale(-1 -1)"><polygon points="22,22 124,22 112,34 46,34 34,46 34,112 22,124"/></g>
  </g>
  <g fill="#D4AF37" opacity="0.8">
    <circle cx="640" cy="32" r="3.5"/>
    <circle cx="640" cy="688" r="3.5"/>
    <circle cx="32" cy="360" r="3.5"/>
    <circle cx="1248" cy="360" r="3.5"/>
  </g>
`;

export function divider(y: number, w = 380): string {
  const half = w / 2;
  return `
    <g transform="translate(640 ${y})">
      <line x1="${-half}" y1="0" x2="${half}" y2="0" stroke="url(#goldgh)" stroke-width="1"/>
      <g fill="#D4AF37">
        <circle cx="0" cy="0" r="3"/>
        <circle cx="${-half - 8}" cy="0" r="2" opacity="0.6"/>
        <circle cx="${half + 8}" cy="0" r="2" opacity="0.6"/>
        <path d="M -16 -5 L 0 0 L -16 5 Z" opacity="0.7"/>
        <path d="M 16 -5 L 0 0 L 16 5 Z" opacity="0.7"/>
      </g>
    </g>
  `;
}

export function topHeader(): string {
  return `
    <text x="640" y="78" text-anchor="middle" font-family="'Cormorant Garamond', Georgia, 'Gulim', '굴림', serif" font-size="22" letter-spacing="5" fill="#D4AF37" font-style="italic" font-weight="500">{{festival_header}}</text>
    ${divider(96, 320)}
  `;
}

export function bottomSeal(): string {
  return `
    <g transform="translate(640 660)">
      <line x1="-180" y1="0" x2="-30" y2="0" stroke="url(#goldgh)" stroke-width="0.8"/>
      <line x1="30" y1="0" x2="180" y2="0" stroke="url(#goldgh)" stroke-width="0.8"/>
      <text text-anchor="middle" y="4" font-family="'Cormorant Garamond', Georgia, 'Gulim', '굴림', serif" font-style="italic" font-size="13" fill="#D4AF37" letter-spacing="2">{{tagline}}</text>
    </g>
  `;
}

// BG_OVERRIDE_SLOT 마커: 대회별 커스텀 배경 업로드 시 template render() 가 이 마커를 <image> 로 치환.
export function shell(content: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" preserveAspectRatio="xMidYMid meet">
  <defs>${COMMON_DEFS}</defs>
  ${BG_LAYER}
  <!--BG_OVERRIDE_SLOT-->
  ${PALM_LAYER}
  ${FRAME_LAYER}
  ${content}
</svg>`;
}

export function sunburstTop(cx = 640, cy = 110, scale = 1): string {
  let rays = '';
  const baseR1 = 12 * scale;
  const longR2 = 56 * scale;
  const shortR2 = 36 * scale;
  for (let i = 0; i < 32; i++) {
    const ang = (i * 11.25) * Math.PI / 180;
    const isLong = i % 2 === 0;
    const r2 = isLong ? longR2 : shortR2;
    const w = isLong ? 1.4 : 0.8;
    const op = isLong ? 0.95 : 0.6;
    const x1 = (Math.cos(ang) * baseR1).toFixed(1);
    const y1 = (Math.sin(ang) * baseR1).toFixed(1);
    const x2 = (Math.cos(ang) * r2).toFixed(1);
    const y2 = (Math.sin(ang) * r2).toFixed(1);
    rays += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="url(#goldg)" stroke-width="${w}" opacity="${op}"/>`;
  }
  return `
    <g transform="translate(${cx} ${cy})">
      <circle r="${(64 * scale).toFixed(1)}" fill="url(#sgw)" opacity="0.85"/>
      <g>
        <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="60s" repeatCount="indefinite"/>
        ${rays}
      </g>
      <circle r="${(9 * scale).toFixed(1)}" fill="#FFEBA0">
        <animate attributeName="r" values="${(9 * scale).toFixed(1)};${(11 * scale).toFixed(1)};${(9 * scale).toFixed(1)}" dur="2.4s" repeatCount="indefinite"/>
      </circle>
      <circle r="${(3 * scale).toFixed(1)}" fill="#FFFAE0"/>
    </g>
  `;
}

// 같은 SVG 안에서 여러 hexagonFrame이 호출될 때 clipPath id가 충돌하지 않도록 고유 카운터.
let hexClipCounter = 0;

export function hexagonFrame(
  cx: number,
  cy: number,
  nameKey: string,
  size = 38,
  animDelay = 0,
  nameFontSize = 18,
  numKey: string | null = null,
  photoKey: string | null = null
): string {
  const outer: string[] = [];
  const inner: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i * 60 - 30) * Math.PI / 180;
    outer.push(`${(cx + Math.cos(a) * size).toFixed(1)},${(cy + Math.sin(a) * size).toFixed(1)}`);
    inner.push(`${(cx + Math.cos(a) * (size - 6)).toFixed(1)},${(cy + Math.sin(a) * (size - 6)).toFixed(1)}`);
  }
  // 순서: 헥사곤 → 번호 → 이름 (번호 먼저, 이름이 아래)
  const numFontSize = Math.max(11, nameFontSize * 0.8);
  const numY = cy + size + numFontSize + 4;
  const nameY = numY + nameFontSize + 2;
  const numTextEl = numKey
    ? `<text x="${cx}" y="${numY.toFixed(1)}" text-anchor="middle" font-family="ui-monospace, monospace" font-size="${numFontSize.toFixed(1)}" letter-spacing="2" fill="#FFFFFF" font-weight="600">${numKey}</text>`
    : '';

  // 사진: photoKey가 주어지면 hex 폴리곤으로 clip한 <image> 삽입.
  // placeholder가 빈 문자열로 치환되면 href=""가 되는데, 이 경우 브라우저는 아무것도 렌더하지 않음(broken icon 회피).
  let photoEl = '';
  if (photoKey) {
    const clipId = `hxclip-${++hexClipCounter}`;
    const ix = cx - size;
    const iy = cy - size;
    const iw = size * 2;
    const ih = size * 2;
    photoEl = `
      <defs>
        <clipPath id="${clipId}"><polygon points="${outer.join(' ')}"/></clipPath>
      </defs>
      <image href="${photoKey}" x="${ix.toFixed(1)}" y="${iy.toFixed(1)}" width="${iw.toFixed(1)}" height="${ih.toFixed(1)}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})"/>
    `;
  }

  return `
    <g opacity="0">
      <animate attributeName="opacity" values="0;1" dur="0.6s" begin="${animDelay.toFixed(2)}s" fill="freeze"/>
      <polygon points="${outer.join(' ')}" fill="url(#hxg)" stroke="url(#goldg)" stroke-width="1.6"/>
      ${photoEl}
      <polygon points="${inner.join(' ')}" fill="none" stroke="#D4AF37" stroke-width="0.5" opacity="0.55"/>
      <text x="${cx}" y="${nameY.toFixed(1)}" text-anchor="middle" font-family="'Gulim', '굴림', sans-serif" font-size="${nameFontSize}" letter-spacing="2" fill="#FFEBA0" font-weight="700">${nameKey}</text>
      ${numTextEl}
    </g>
  `;
}

export function trophyIcon(cx = 640, cy = 420, scale = 1): string {
  const rays = Array.from({ length: 12 })
    .map((_, i) => {
      const ang = (i * 30 - 90) * Math.PI / 180;
      const x1 = (Math.cos(ang) * 78).toFixed(1);
      const y1 = (Math.sin(ang) * 78).toFixed(1);
      const x2 = (Math.cos(ang) * 110).toFixed(1);
      const y2 = (Math.sin(ang) * 110).toFixed(1);
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
    })
    .join('');
  return `
    <g transform="translate(${cx} ${cy}) scale(${scale})">
      <g stroke="url(#goldg)" stroke-width="1" opacity="0.5">${rays}</g>
      <circle r="60" fill="url(#sgw)" opacity="0.5"/>
      <path d="M -34 -18 Q -58 -18 -58 8 Q -58 30 -38 32" fill="none" stroke="url(#goldg)" stroke-width="3.5" stroke-linecap="round"/>
      <path d="M 34 -18 Q 58 -18 58 8 Q 58 30 38 32" fill="none" stroke="url(#goldg)" stroke-width="3.5" stroke-linecap="round"/>
      <path d="M -36 -22 L 36 -22 Q 36 36 0 42 Q -36 36 -36 -22 Z" fill="url(#goldg)" stroke="#9C7C2C" stroke-width="0.8"/>
      <ellipse cx="0" cy="-22" rx="38" ry="6" fill="url(#goldg)" stroke="#9C7C2C" stroke-width="0.6"/>
      <ellipse cx="0" cy="-22" rx="30" ry="4" fill="#9C7C2C" opacity="0.4"/>
      <path d="M -22 -16 Q -28 6 -22 30" stroke="#FFFAE0" stroke-width="2.6" fill="none" stroke-linecap="round" opacity="0.7"/>
      <rect x="-10" y="42" width="20" height="14" fill="url(#goldg)"/>
      <rect x="-30" y="56" width="60" height="8" rx="1" fill="url(#goldg)" stroke="#9C7C2C" stroke-width="0.5"/>
      <rect x="-36" y="64" width="72" height="6" rx="1" fill="url(#goldg)" stroke="#9C7C2C" stroke-width="0.5"/>
    </g>
  `;
}

export function citiesFooter(y = 660): string {
  return `
    <g transform="translate(640 ${y})">
      <line x1="-380" y1="-14" x2="-100" y2="-14" stroke="url(#goldgh)" stroke-width="0.5" opacity="0.7"/>
      <line x1="100" y1="-14" x2="380" y2="-14" stroke="url(#goldgh)" stroke-width="0.5" opacity="0.7"/>
      <text text-anchor="middle" y="4" font-family="'Cormorant Garamond', Georgia, 'Gulim', '굴림', serif" font-style="italic" font-size="13" fill="#D4AF37" letter-spacing="2">{{tagline}}</text>
    </g>
  `;
}

/**
 * PREP 화면 하단 광고/스폰서 로고 6개 가로 배치.
 * 빈 URL 슬롯은 <image href=""/> 로 렌더 → 브라우저가 표시하지 않음.
 */
export function sponsorRow(y = 658, boxW = 140, boxH = 48, gap = 44): string {
  const total = 6 * boxW + 5 * gap;
  const startX = (1280 - total) / 2;
  let body = '';
  for (let i = 0; i < 6; i++) {
    const x = startX + i * (boxW + gap);
    body += `
      <image
        href="{{sponsor_logo_${i + 1}}}"
        x="${x}" y="${y - boxH / 2}"
        width="${boxW}" height="${boxH}"
        preserveAspectRatio="xMidYMid meet"
        opacity="{{sponsor_opacity_${i + 1}}}"
      />
    `;
  }
  return `<g>${body}</g>`;
}

export function heroHeader(): string {
  return `
    ${sunburstTop(640, 110, 1)}
    <g transform="translate(640 212)">
      <text text-anchor="middle" font-family="'Cormorant Garamond', Georgia, 'Gulim', '굴림', serif" font-size="22" letter-spacing="5" fill="#D4AF37" font-style="italic" font-weight="500">{{festival_header}}</text>
      <text x="-228" y="-3" text-anchor="middle" font-family="'Cormorant Garamond', Georgia, 'Gulim', '굴림', serif" font-size="14" fill="#D4AF37">★</text>
      <text x="228" y="-3" text-anchor="middle" font-family="'Cormorant Garamond', Georgia, 'Gulim', '굴림', serif" font-size="14" fill="#D4AF37">★</text>
    </g>
    ${divider(232, 320)}
  `;
}
