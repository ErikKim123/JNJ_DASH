// 심사위원 소개 (예선 PREP 다음 스텝) 의 공용 콘텐츠 SVG.
// 3개 디자인 템플릿(01/02/03) 모두 공유하는 골드 계열 카드 그리드.
// 1~20명 적응형 레이아웃:
//   N=1     → 단독 hero 카드 (특별 처리)
//   N=2~5   → 1행 가로 정렬
//   N=6~10  → 2행 그리드
//   N=11~15 → 3행 그리드
//   N=16~20 → 4행 그리드
//
// placeholder 키 — placeholder.ts 의 fillJudges() 와 일치:
//   judge_name_{i}, judge_alias_{i}, judge_specialty_{i}, judge_photo_{i}  (i = 1..20)

/**
 * 색/폰트 테마 — 템플릿 01~04 는 골드-온-다크가 기본이라 값을 넘기지 않아도 되고,
 * 05(다크 에디토리얼)·06(아이보리 갤러리)처럼 팔레트가 다른 템플릿만 필요한 키를 덮어쓴다.
 */
export interface JudgesIntroTheme {
  /** 타이틀 위 stage_label */
  eyebrow: string;
  /** intro_title fill (그라디언트 url 가능) */
  title: string;
  /** intro_subtitle fill */
  subtitle: string;
  /** 심사위원 이름 fill */
  name: string;
  /** 심사위원 별칭 fill */
  alias: string;
  /** 사진 원형 테두리 (그라디언트 url 가능) */
  ring: string;
  /** 사진 안쪽 얇은 보조 링 */
  ringSoft: string;
  /** 사진이 없을 때 보이는 카드 배경 */
  cardBg: string;
  /** 타이틀용 디스플레이 폰트 스택 */
  displayFont: string;
  /** 부제/별칭용 본문 폰트 스택 */
  bodyFont: string;
  /** 이름용 폰트 스택 (한글 포함) */
  nameFont: string;
  /** 이름/부제에 이탤릭을 쓸지 — 산세리프 템플릿(05/06)은 false */
  italicMeta: boolean;
}

export const DEFAULT_JUDGES_THEME: JudgesIntroTheme = {
  eyebrow: '#FFD56B',
  title: 'url(#goldg)',
  subtitle: '#E8E6DA',
  name: '#FFEBA0',
  alias: '#D4AF37',
  ring: 'url(#goldg)',
  ringSoft: '#D4AF37',
  cardBg: 'url(#hxg)',
  displayFont: "'Cinzel', 'Cormorant Garamond', Georgia, 'Gulim', '굴림', serif",
  bodyFont: "'Cormorant Garamond', Georgia, 'Gulim', '굴림', serif",
  nameFont: "'Gulim', '굴림', 'Cormorant Garamond', Georgia, sans-serif",
  italicMeta: true,
};

export interface JudgesIntroLayoutOpts {
  /** 표출할 심사위원 수 (1~20). 1 미만이면 빈 상태 카드 표출. */
  count: number;
  /** 화면 중앙 콘텐츠 영역 상단 y. 기본 260. */
  contentTop?: number;
  /** 화면 중앙 콘텐츠 영역 하단 y. 기본 640. */
  contentBottom?: number;
  /** 화면 가로 패딩. 기본 60 (즉 콘텐츠 영역 폭 = 1160). */
  paddingX?: number;
  /** 팔레트/폰트 덮어쓰기 — 지정한 키만 DEFAULT_JUDGES_THEME 를 대체. */
  theme?: Partial<JudgesIntroTheme>;
  /** 타이틀 블록(stage_label / intro_title / intro_subtitle) 생략 — 템플릿이 직접 그릴 때. */
  hideTitle?: boolean;
}

interface GridSpec {
  cols: number;
  rows: number;
}

function chooseGrid(n: number): GridSpec {
  // 한 행 최대 5명. 더 보기 좋은 비율을 고르도록 분기.
  if (n <= 1) return { cols: 1, rows: 1 };
  if (n === 2) return { cols: 2, rows: 1 };
  if (n === 3) return { cols: 3, rows: 1 };
  if (n === 4) return { cols: 4, rows: 1 };
  if (n === 5) return { cols: 5, rows: 1 };
  if (n === 6) return { cols: 3, rows: 2 };
  if (n === 7) return { cols: 4, rows: 2 };
  if (n === 8) return { cols: 4, rows: 2 };
  if (n === 9) return { cols: 5, rows: 2 };
  if (n === 10) return { cols: 5, rows: 2 };
  if (n <= 12) return { cols: 4, rows: 3 };
  if (n <= 15) return { cols: 5, rows: 3 };
  return { cols: 5, rows: 4 };
}

/** 텍스트 길이에 따라 글자 크기를 적당히 축소 (긴 이름이 카드 밖으로 새지 않도록). */
function fitTextLength(maxFont: number, approxCharWidth: number, boxWidth: number): number {
  // approxCharWidth: font-size 단위당 글자 평균 폭 비율 (한글 기준 0.55 정도)
  const approxChars = boxWidth / (maxFont * approxCharWidth);
  if (approxChars >= 6) return maxFont;
  return Math.max(10, Math.floor(maxFont * (approxChars / 6)));
}

/**
 * 단일 심사위원 카드 — 원형 photo + name + specialty.
 * photo 가 비어있으면 골드 ring 안에 이니셜 같은 fallback 도형(작은 별/점) 노출.
 */
function judgeCard(
  idx: number,
  cx: number,
  cy: number,
  photoR: number,
  nameFont: number,
  metaFont: number,
  uid: number,
  th: JudgesIntroTheme,
): string {
  // 카드 = [photo(원형)] + gap1 + [name] + gap2 + [alias] 를 하나의 세로 스택으로 보고
  // cy 를 스택 '전체'의 수직 중앙에 정렬한다.
  //   (이전엔 photo 를 cy 위로 올리고 사진↔이름 간격을 고정 22px 로 줘서
  //    3행(11~12명)·4행(16~20명)처럼 행이 많아지면 카드 높이가 행 높이에 육박해
  //    아래 행 사진과 윗 행 글씨가 맞붙는 문제가 있었다.)
  // 간격을 고정값 대신 photoR/metaFont 비례로 잡아 행이 많을수록 자동으로 좁아지고,
  // 메인 빌더가 photoR 를 cellH 예산 안에 맞추므로 항상 행간 여백이 남는다.
  const gap1 = Math.max(9, photoR * 0.4); // 사진 ↔ 이름
  const gap2 = Math.max(6, metaFont * 0.6); // 이름 ↔ 별칭
  const stackH = photoR * 2 + gap1 + nameFont + gap2 + metaFont;
  const top = cy - stackH / 2;
  const photoCY = top + photoR;
  const nameY = photoCY + photoR + gap1 + nameFont;
  const metaY = nameY + gap2 + metaFont;

  const photoKey = `{{judge_photo_${idx}}}`;
  const nameKey = `{{judge_name_${idx}}}`;
  // 이전엔 specialty 를 노출했으나, 더 짧고 캐주얼한 'alias' 가 카드에 적합.
  const metaKey = `{{judge_alias_${idx}}}`;
  const clipId = `judgeClip-${uid}-${idx}`;

  // 가용 텍스트 폭은 카드 폭 ≈ photoR * 2.4 — 글자수에 맞춰 축소.
  const textBoxW = photoR * 2.4;
  const nameSize = fitTextLength(nameFont, 0.55, textBoxW);
  const metaSize = fitTextLength(metaFont, 0.5, textBoxW);

  return `
    <g>
      <defs>
        <clipPath id="${clipId}"><circle cx="${cx}" cy="${photoCY}" r="${photoR - 2}"/></clipPath>
      </defs>
      <!-- outer gold ring (subtle glow) -->
      <circle cx="${cx}" cy="${photoCY}" r="${photoR + 4}" fill="none" stroke="${th.ring}" stroke-width="0.7" opacity="0.45"/>
      <!-- card backdrop circle (dark hex bg gradient) -->
      <circle cx="${cx}" cy="${photoCY}" r="${photoR}" fill="${th.cardBg}"/>
      <!-- photo (only renders if URL set; empty href silently skips in browsers) -->
      <image href="${photoKey}" x="${cx - photoR}" y="${photoCY - photoR}"
             width="${photoR * 2}" height="${photoR * 2}"
             preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})"/>
      <!-- ring on top so the circle stays crisp over the photo -->
      <circle cx="${cx}" cy="${photoCY}" r="${photoR}" fill="none" stroke="${th.ring}" stroke-width="2"/>
      <!-- inner soft ring (decorative) -->
      <circle cx="${cx}" cy="${photoCY}" r="${photoR - 5}" fill="none" stroke="${th.ringSoft}" stroke-width="0.5" opacity="0.55"/>
      <!-- name -->
      <text x="${cx}" y="${nameY.toFixed(1)}" text-anchor="middle"
            font-family="${th.nameFont}"
            font-size="${nameSize}" letter-spacing="1.5" fill="${th.name}" font-weight="700">${nameKey}</text>
      <!-- specialty / alias -->
      <text x="${cx}" y="${metaY.toFixed(1)}" text-anchor="middle"
            font-family="${th.bodyFont}"
            ${th.italicMeta ? 'font-style="italic"' : ''} font-size="${metaSize}" letter-spacing="1.2"
            fill="${th.alias}" opacity="0.85">${metaKey}</text>
    </g>
  `;
}

// uid 카운터 — 같은 SVG 안에서 clipPath id 충돌 방지 (예선·본선·결승 동시 렌더 가능성 대비).
let cardUidCounter = 0;

/**
 * 1명 단독 — hero 카드. 사진을 크게, 이름·전문도 큼직하게.
 */
function singleHeroCard(th: JudgesIntroTheme): string {
  const cx = 640;
  const cy = 460;
  const photoR = 130;
  const photoCY = cy - 60;
  const clipId = `judgeClip-hero-${++cardUidCounter}`;
  return `
    <g>
      <defs>
        <clipPath id="${clipId}"><circle cx="${cx}" cy="${photoCY}" r="${photoR - 3}"/></clipPath>
      </defs>
      <circle cx="${cx}" cy="${photoCY}" r="${photoR + 12}" fill="none" stroke="${th.ring}" stroke-width="0.6" opacity="0.45"/>
      <circle cx="${cx}" cy="${photoCY}" r="${photoR + 6}" fill="none" stroke="${th.ring}" stroke-width="0.8" opacity="0.7"/>
      <circle cx="${cx}" cy="${photoCY}" r="${photoR}" fill="${th.cardBg}"/>
      <image href="{{judge_photo_1}}" x="${cx - photoR}" y="${photoCY - photoR}"
             width="${photoR * 2}" height="${photoR * 2}"
             preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})"/>
      <circle cx="${cx}" cy="${photoCY}" r="${photoR}" fill="none" stroke="${th.ring}" stroke-width="2.5"/>
      <circle cx="${cx}" cy="${photoCY}" r="${photoR - 6}" fill="none" stroke="${th.ringSoft}" stroke-width="0.6" opacity="0.55"/>
      <text x="${cx}" y="${(photoCY + photoR + 78).toFixed(1)}" text-anchor="middle"
            font-family="${th.displayFont}"
            font-size="34" letter-spacing="6" fill="${th.title}" font-weight="700">{{judge_name_1}}</text>
      <text x="${cx}" y="${(photoCY + photoR + 118).toFixed(1)}" text-anchor="middle"
            font-family="${th.bodyFont}"
            ${th.italicMeta ? 'font-style="italic"' : ''} font-size="18" letter-spacing="3" fill="${th.alias}" opacity="0.9">{{judge_alias_1}}</text>
    </g>
  `;
}

/**
 * 빈 상태 — 등록된 심사위원이 없을 때 안내.
 */
function emptyState(cy: number, th: JudgesIntroTheme): string {
  return `
    <text x="640" y="${cy}" text-anchor="middle"
          font-family="${th.bodyFont}"
          ${th.italicMeta ? 'font-style="italic"' : ''} font-size="20" fill="${th.alias}" opacity="0.65" letter-spacing="3">
      Judges to be announced
    </text>
  `;
}

/**
 * 타이틀 블록 — "OUR JUDGES" + 부제.
 */
function titleBlock(th: JudgesIntroTheme): string {
  // 타이틀 블록 전체를 32px 위로 — heroHeader(y≈212) 와의 간격을 좁히고
  // 1행 카드(cy≈437)와의 공백을 정리해 시각 무게 중심을 위로 이동.
  return `
    <text x="640" y="256" text-anchor="middle"
          font-family="${th.bodyFont}"
          font-size="20" letter-spacing="10" fill="${th.eyebrow}" ${th.italicMeta ? 'font-style="italic"' : 'font-weight="600"'}>{{stage_label}}</text>
    <text x="640" y="306" text-anchor="middle"
          font-family="${th.displayFont}"
          font-weight="bold" font-size="48" letter-spacing="8" fill="${th.title}">{{intro_title}}</text>
    <text x="640" y="336" text-anchor="middle"
          font-family="${th.bodyFont}"
          font-size="15" letter-spacing="6" fill="${th.subtitle}" opacity="0.75" ${th.italicMeta ? 'font-style="italic"' : ''}>{{intro_subtitle}}</text>
  `;
}

/**
 * 메인 빌더 — count 에 따라 그리드/단독 카드를 결정해 SVG 문자열 반환.
 * 반환값은 shell() 내부에 그대로 삽입하는 콘텐츠 그룹.
 */
export function judgesIntroContent(opts: JudgesIntroLayoutOpts): string {
  const count = Math.max(0, Math.min(20, Math.floor(opts.count)));
  // 1행은 타이틀 가까이 끌어올리고 2행은 citiesFooter(y=700) 직전까지 내려서 행간을 시원하게.
  // usableH 가 커진 만큼 cellH 도 늘어남 → row1(cy≈438)과 row2(cy≈603)이 약 165 떨어짐.
  // contentTop/Bottom 을 자막(y=336)·푸터(y=700) 한계까지 넓혀 다행 그리드의 행간 여백을 확보.
  const contentTop = opts.contentTop ?? 348;
  const contentBottom = opts.contentBottom ?? 690;
  const paddingX = opts.paddingX ?? 60;
  const th: JudgesIntroTheme = { ...DEFAULT_JUDGES_THEME, ...(opts.theme ?? {}) };
  const title = opts.hideTitle ? '' : titleBlock(th);

  // 타이틀은 항상 표출. 카드는 count 에 따라 분기.
  if (count === 0) {
    return `${title}${emptyState((contentTop + contentBottom) / 2, th)}`;
  }
  if (count === 1) {
    // 1명일 때는 hero 카드. 타이틀 위치를 조금 위로 올려 균형 잡기.
    return `${title}${singleHeroCard(th)}`;
  }

  const { cols, rows } = chooseGrid(count);
  const usableW = 1280 - paddingX * 2;
  const usableH = contentBottom - contentTop;
  const cellW = usableW / cols;
  const cellH = usableH / rows;

  // 카드 photo 반경 — 가로(cellW)·세로(cellH) 양쪽 한계 안에서 결정.
  // 세로는 한 행에 [사진 2R + 간격 + 이름 + 별칭] 스택이 들어가고도 행간 여백이 남도록 cellH 비율로 제한.
  // 4행(16~20명)은 행 높이가 작아 캡을 0.20 으로 더 죄어 사진을 약간 줄이고 행간 간격을 넉넉히 확보.
  const vCap = rows >= 4 ? 0.20 : 0.25;
  const photoR = Math.min(cellW * 0.30, cellH * vCap);
  // 행 수가 많을수록 글자 크기 축소
  const baseNameFont = rows >= 4 ? 12 : rows === 3 ? 14 : rows === 2 ? 16 : 18;
  const baseMetaFont = rows >= 4 ? 9 : rows === 3 ? 10 : rows === 2 ? 12 : 14;

  const uid = ++cardUidCounter;
  const cards: string[] = [];

  // 마지막 행이 빈 슬롯이 있으면 가운데 정렬 (예: 7명 = 4+3, 11명 = 4+4+3, 등)
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / cols);
    const isLastRow = row === rows - 1;
    const itemsInRow = isLastRow ? count - row * cols : cols;
    const col = i - row * cols;
    // 마지막 행만 itemsInRow 개를 가로 중앙으로 재배치 (남는 빈 슬롯의 절반만큼 우측으로 시프트)
    const xOffset = isLastRow ? ((cols - itemsInRow) * cellW) / 2 : 0;
    const cx = paddingX + xOffset + cellW * (col + 0.5);
    const cy = contentTop + cellH * (row + 0.5);
    cards.push(judgeCard(i + 1, cx, cy, photoR, baseNameFont, baseMetaFont, uid, th));
  }

  return `${title}<g>${cards.join('')}</g>`;
}
