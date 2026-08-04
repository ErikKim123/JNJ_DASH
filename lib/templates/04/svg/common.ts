import { svgId } from '@/lib/templates/shared/svgId';
// Design Ref: Template 04 — Template 03 사본. 배경/레이아웃은 동일하고
// 고정 그래픽(JLCF 골드 스탬프 로고, 돌하르방 3인)만 제거한 변형.
// 배경 원본: DashDesignTemplates/02/2026배경2.pdf → public/templates/02/background.jpg (03과 공유)
//
// ── Template 04 텍스트 색 팔레트 ────────────────────────────────────────────
// 04는 대회별 커스텀 배경(다크 사진 / 화이트 배경 / 밝은 이미지)을 전제로 하므로
// "어떤 배경에서도 읽히는" 것이 목표다. 단색 하나로는 순백/순흑 양쪽을 만족할 수 없어서
// (밝은 색은 화이트에서, 어두운 색은 다크에서 사라짐) 두 축으로 해결한다.
//   1) 색: 03의 밝은 파스텔 골드/화이트를 한 단계 진하고 채도 높은 톤으로 내려 밝은 배경에서 덜 날아가게 한다.
//   2) halo: 모든 <text>에 글자 크기에 비례하는 어두운 외곽선 + 부드러운 그림자 (TEXT_LEGIBILITY_STYLE).
//      다크 배경에서는 halo가 보이지 않고, 밝은 배경에서는 halo가 글자 윤곽을 만들어 준다.
//   03 → 04 매핑: #D4AF37→#DDAE42, #FFD56B→#F5C64E, #FFEBA0→#FFDF94,
//                 #E8E6DA→#F7F4EA, #9A98A8→#D6D1C4, #C0C0C8→#DCDCE4, #B07050→#D08F63,
//                 url(#goldg)→url(#goldgt) (텍스트 전용, 아래쪽 stop을 어둡게)
// ───────────────────────────────────────────────────────────────────────────

export const BG_IMAGE = '/templates/02/background.jpg';

export const COMMON_DEFS = `
  <linearGradient id="goldg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#FFEBA0"/>
    <stop offset="0.5" stop-color="#FFD56B"/>
    <stop offset="1" stop-color="#C68F3C"/>
  </linearGradient>
  <!-- 텍스트 전용 골드: goldg 보다 아래쪽 stop 을 어둡게 잡아 화이트 배경에서도 글자 형태가 남는다. -->
  <linearGradient id="goldgt" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#FFE9AE"/>
    <stop offset="0.45" stop-color="#EFC257"/>
    <stop offset="1" stop-color="#A2731C"/>
  </linearGradient>
  <linearGradient id="silvergt" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#F2F2F5"/>
    <stop offset="0.45" stop-color="#C4C4CE"/>
    <stop offset="1" stop-color="#6B6B75"/>
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
    </g>
  `;
}

export function topHeader(): string {
  return `
    <text x="640" y="78" text-anchor="middle" font-family="'Cormorant Garamond', Georgia, 'Gulim', '굴림', serif" font-size="22" letter-spacing="5" fill="#DDAE42" font-style="italic" font-weight="500">{{festival_header}}</text>
    ${divider(96, 320)}
  `;
}

export function bottomSeal(y = 660): string {
  return `
    <g transform="translate(640 ${y})">
      <line x1="-180" y1="0" x2="-30" y2="0" stroke="url(#goldgh)" stroke-width="0.8"/>
      <line x1="30" y1="0" x2="180" y2="0" stroke="url(#goldgh)" stroke-width="0.8"/>
      <text text-anchor="middle" y="4" font-family="'Cormorant Garamond', Georgia, 'Gulim', '굴림', serif" font-style="italic" font-size="13" fill="#DDAE42" letter-spacing="2">{{tagline}}</text>
    </g>
  `;
}

/**
 * 모든 <text> 에 적용되는 가독성 halo — Template 04 의 핵심 차이점.
 *  - paint-order: stroke fill → 어두운 외곽선을 글자 "뒤"에 깔아 글자색을 그대로 유지한다.
 *  - stroke-width 를 em 으로 → 118px 타이틀부터 10px 라벨까지 두께가 글자 크기에 비례.
 *  - drop-shadow 2겹 → 외곽선만으로 부족한 작은 글자에 부드러운 어두운 아우라를 더한다.
 * 인라인 SVG 안의 <style> 은 문서 전역 CSS 이므로 `svg.t04` 로 스코프를 묶어
 * 같은 페이지의 다른 SVG(아이콘, 다른 템플릿 미리보기)에 규칙이 새지 않게 한다.
 */
export const TEXT_LEGIBILITY_STYLE = `
  <style>
    svg.t04 text {
      paint-order: stroke fill;
      stroke: #0E0A04;
      stroke-opacity: 0.75;
      /* em 비례 + 최소 2px — 14px 번호/라벨도 눈에 보이는 외곽선을 갖게 한다.
         (paint-order 로 안쪽 절반은 글자색에 덮이므로 실제 보이는 두께는 절반) */
      stroke-width: max(2px, 0.09em);
      stroke-linejoin: round;
      stroke-linecap: round;
      filter: drop-shadow(0 0 1.5px rgba(0,0,0,0.95)) drop-shadow(0 0 4px rgba(0,0,0,0.65)) drop-shadow(0 1px 6px rgba(0,0,0,0.45));
    }
  </style>
`;

// BG_OVERRIDE_SLOT 마커: 사용자가 대회별 커스텀 배경을 업로드한 경우
// template 의 render() 에서 이 마커를 <image> 로 치환하여 기본 배경 위에 덮어 그림.
export function shell(content: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" class="t04" viewBox="0 0 1280 720" preserveAspectRatio="xMidYMid meet">
  <defs>${COMMON_DEFS}</defs>
  ${TEXT_LEGIBILITY_STYLE}
  ${BG_LAYER}
  <!--BG_OVERRIDE_SLOT-->
  ${FRAME_LAYER}
  ${content}
  <!--ICON_SLOT-->
</svg>`;
}

// Template 03의 jlcfStamp(골드 6각 로고)는 Template 04에서 제거 — heroHeader에서도 호출하지 않는다.

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
    ? `<text x="${cx}" y="${numY.toFixed(1)}" text-anchor="middle" font-family="ui-monospace, monospace" font-size="${numFontSize.toFixed(1)}" letter-spacing="2" fill="#F7F4EA" font-weight="600">${numKey}</text>`
    : '';

  let photoEl = '';
  if (photoKey) {
    const clipId = svgId('hxclip-t04', cx, cy, size);
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
      <text x="${cx}" y="${nameY.toFixed(1)}" text-anchor="middle" font-family="'Gulim', '굴림', sans-serif" font-size="${nameFontSize}" letter-spacing="2" fill="#FFDF94" font-weight="700">${nameKey}</text>
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
      <text text-anchor="middle" y="4" font-family="'Cormorant Garamond', Georgia, 'Gulim', '굴림', serif" font-style="italic" font-size="13" fill="#DDAE42" letter-spacing="2">{{tagline}}</text>
    </g>
  `;
}

export function heroHeader(): string {
  // Template 04: 상단 로고 스탬프 제거. 아래 텍스트/구분선 위치는 03과 동일하게 유지해
  // 각 화면(prep/final/judgesIntro …)의 고정 y 좌표와 어긋나지 않게 한다.
  return `
    <g transform="translate(640 212)">
      <text text-anchor="middle" font-family="'Cormorant Garamond', Georgia, 'Gulim', '굴림', serif" font-size="22" letter-spacing="5" fill="#DDAE42" font-style="italic" font-weight="500">{{festival_header}}</text>
    </g>
    ${divider(232, 320)}
  `;
}

/**
 * PREP 화면 하단 광고/스폰서 로고 6개 가로 배치.
 * `applyPlaceholders` 가 sponsor_logo_1 ~ sponsor_logo_6 placeholder 를 채워줌.
 * URL 이 비어 있는 슬롯은 <image href=""/> 로 렌더 → 브라우저가 표시하지 않음.
 * 박스: 130×50, gap 12 → 총 가로 6*130 + 5*12 = 840 → 좌측 시작 x = (1280-840)/2 = 220.
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
