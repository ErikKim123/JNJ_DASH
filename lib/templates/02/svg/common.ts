// Design Ref: Template 02 (JLCF — Jeju Latin Culture Festival).
// 구조는 Template 01과 동일하고 배경 이미지만 고객 제공 PDF에서 추출한 JPEG로 교체.
// 원본: DashDesignTemplates/02/2026배경2.pdf → public/templates/02/background.jpg

export const BG_IMAGE = '/templates/02/background.jpg';
// JLCF 골드 스탬프 (RGBA 투명 배경 PNG, 437×407)
export const STAMP_IMAGE = '/templates/02/stamp.png';

export const COMMON_DEFS = `
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

// 풀블리드 배경 = 고객 제공 이미지로 1280×720 viewBox 채움.
// 원본 이미지(2391×2834)의 좌우 가장자리에 빛 번짐/띠 흔적이 보여서 nested SVG의
// viewBox를 사용해 좌·우 각 280px씩 크롭한 뒤 slice cover로 채움.
//   crop 영역: x=280, w=1831, h=2834 (좌우 각 280 제거, 세로는 그대로)
//   이후 1280×720에 cover → 자연스럽게 swirl 패턴이 가장자리까지 차오름
export const BG_LAYER = `
  <svg x="0" y="0" width="1280" height="720" viewBox="280 0 1831 2834" preserveAspectRatio="xMidYMid slice">
    <image href="${BG_IMAGE}" x="0" y="0" width="2391" height="2834"/>
  </svg>
`;

// PALM_LAYER는 Template 01의 야자수 라인 — 02에서는 배경에 이미 swirl 패턴이 있어 생략
export const PALM_LAYER = '';

// Template 02는 외곽 골드 프레임/코너/사이드 마커를 모두 제거 (배경 swirl만 노출)
export const FRAME_LAYER = '';

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
  ${FRAME_LAYER}
  ${content}
</svg>`;
}

/**
 * JLCF 골드 6각 스탬프 — 투명 배경 PNG를 hero 자리에 배치.
 * 원본 PNG 비율 437×407 ≈ 1.074 (가로:세로) 을 유지하며 height 기준으로 확대.
 */
export function jlcfStamp(cx = 640, cy = 110, height = 160): string {
  const aspectRatio = 437 / 407;
  const width = height * aspectRatio;
  return `
    <image href="${STAMP_IMAGE}" x="${cx - width / 2}" y="${cy - height / 2}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet"/>
  `;
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

  let photoEl = '';
  if (photoKey) {
    const clipId = `hxclip-t02-${++hexClipCounter}`;
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
    ${jlcfStamp(640, 110, 160)}
    <g transform="translate(640 212)">
      <text text-anchor="middle" font-family="'Cormorant Garamond', Georgia, 'Gulim', '굴림', serif" font-size="22" letter-spacing="5" fill="#D4AF37" font-style="italic" font-weight="500">{{festival_header}}</text>
      <text x="-228" y="-3" text-anchor="middle" font-family="'Cormorant Garamond', Georgia, 'Gulim', '굴림', serif" font-size="14" fill="#D4AF37">★</text>
      <text x="228" y="-3" text-anchor="middle" font-family="'Cormorant Garamond', Georgia, 'Gulim', '굴림', serif" font-size="14" fill="#D4AF37">★</text>
    </g>
    ${divider(232, 320)}
  `;
}
