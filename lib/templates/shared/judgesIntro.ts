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

export interface JudgesIntroLayoutOpts {
  /** 표출할 심사위원 수 (1~20). 1 미만이면 빈 상태 카드 표출. */
  count: number;
  /** 화면 중앙 콘텐츠 영역 상단 y. 기본 260. */
  contentTop?: number;
  /** 화면 중앙 콘텐츠 영역 하단 y. 기본 640. */
  contentBottom?: number;
  /** 화면 가로 패딩. 기본 60 (즉 콘텐츠 영역 폭 = 1160). */
  paddingX?: number;
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
): string {
  // 카드 1장을 (cx, cy) 기준 위→아래로 쌓는다.
  //   photo (원형) → name → alias
  // cy 는 카드 전체의 수직 중앙. photo 는 cy 보다 살짝 위로 올려 텍스트 공간 확보.
  // 사진/이름 간격은 photoR 의 45% (최소 22) — 답답해 보이지 않게 시각적 호흡 확보.
  // 이름/별칭 간격은 metaFont 의 90% (최소 10) — 두 텍스트가 분리되어 읽히도록.
  const photoCY = cy - photoR * 0.35;
  const photoToName = Math.max(22, photoR * 0.45);
  const nameToMeta = Math.max(10, metaFont * 0.9);
  const nameY = photoCY + photoR + nameFont + photoToName;
  const metaY = nameY + metaFont + nameToMeta;

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
      <circle cx="${cx}" cy="${photoCY}" r="${photoR + 4}" fill="none" stroke="url(#goldg)" stroke-width="0.7" opacity="0.45"/>
      <!-- card backdrop circle (dark hex bg gradient) -->
      <circle cx="${cx}" cy="${photoCY}" r="${photoR}" fill="url(#hxg)"/>
      <!-- photo (only renders if URL set; empty href silently skips in browsers) -->
      <image href="${photoKey}" x="${cx - photoR}" y="${photoCY - photoR}"
             width="${photoR * 2}" height="${photoR * 2}"
             preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})"/>
      <!-- ring on top so the circle stays crisp over the photo -->
      <circle cx="${cx}" cy="${photoCY}" r="${photoR}" fill="none" stroke="url(#goldg)" stroke-width="2"/>
      <!-- inner soft ring (decorative) -->
      <circle cx="${cx}" cy="${photoCY}" r="${photoR - 5}" fill="none" stroke="#D4AF37" stroke-width="0.5" opacity="0.55"/>
      <!-- name -->
      <text x="${cx}" y="${nameY.toFixed(1)}" text-anchor="middle"
            font-family="'Gulim', '굴림', 'Cormorant Garamond', Georgia, sans-serif"
            font-size="${nameSize}" letter-spacing="1.5" fill="#FFEBA0" font-weight="700">${nameKey}</text>
      <!-- specialty / alias -->
      <text x="${cx}" y="${metaY.toFixed(1)}" text-anchor="middle"
            font-family="'Cormorant Garamond', Georgia, 'Gulim', '굴림', serif"
            font-style="italic" font-size="${metaSize}" letter-spacing="1.2"
            fill="#D4AF37" opacity="0.85">${metaKey}</text>
    </g>
  `;
}

// uid 카운터 — 같은 SVG 안에서 clipPath id 충돌 방지 (예선·본선·결승 동시 렌더 가능성 대비).
let cardUidCounter = 0;

/**
 * 1명 단독 — hero 카드. 사진을 크게, 이름·전문도 큼직하게.
 */
function singleHeroCard(): string {
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
      <circle cx="${cx}" cy="${photoCY}" r="${photoR + 12}" fill="none" stroke="url(#goldg)" stroke-width="0.6" opacity="0.45"/>
      <circle cx="${cx}" cy="${photoCY}" r="${photoR + 6}" fill="none" stroke="url(#goldg)" stroke-width="0.8" opacity="0.7"/>
      <circle cx="${cx}" cy="${photoCY}" r="${photoR}" fill="url(#hxg)"/>
      <image href="{{judge_photo_1}}" x="${cx - photoR}" y="${photoCY - photoR}"
             width="${photoR * 2}" height="${photoR * 2}"
             preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})"/>
      <circle cx="${cx}" cy="${photoCY}" r="${photoR}" fill="none" stroke="url(#goldg)" stroke-width="2.5"/>
      <circle cx="${cx}" cy="${photoCY}" r="${photoR - 6}" fill="none" stroke="#D4AF37" stroke-width="0.6" opacity="0.55"/>
      <text x="${cx}" y="${(photoCY + photoR + 78).toFixed(1)}" text-anchor="middle"
            font-family="'Cinzel', 'Cormorant Garamond', Georgia, 'Gulim', '굴림', serif"
            font-size="34" letter-spacing="6" fill="url(#goldg)" font-weight="700">{{judge_name_1}}</text>
      <text x="${cx}" y="${(photoCY + photoR + 118).toFixed(1)}" text-anchor="middle"
            font-family="'Cormorant Garamond', Georgia, 'Gulim', '굴림', serif"
            font-style="italic" font-size="18" letter-spacing="3" fill="#D4AF37" opacity="0.9">{{judge_alias_1}}</text>
    </g>
  `;
}

/**
 * 빈 상태 — 등록된 심사위원이 없을 때 안내.
 */
function emptyState(cy: number): string {
  return `
    <text x="640" y="${cy}" text-anchor="middle"
          font-family="'Cormorant Garamond', Georgia, 'Gulim', '굴림', serif"
          font-style="italic" font-size="20" fill="#D4AF37" opacity="0.65" letter-spacing="3">
      Judges to be announced
    </text>
  `;
}

/**
 * 타이틀 블록 — "OUR JUDGES" + 부제.
 */
function titleBlock(): string {
  // 타이틀 블록 전체를 32px 위로 — heroHeader(y≈212) 와의 간격을 좁히고
  // 1행 카드(cy≈437)와의 공백을 정리해 시각 무게 중심을 위로 이동.
  return `
    <text x="640" y="256" text-anchor="middle"
          font-family="'Cormorant Garamond', Georgia, 'Gulim', '굴림', serif"
          font-size="20" letter-spacing="10" fill="#FFD56B" font-style="italic">{{stage_label}}</text>
    <text x="640" y="306" text-anchor="middle"
          font-family="'Cinzel', 'Cormorant Garamond', Georgia, 'Gulim', '굴림', serif"
          font-weight="bold" font-size="48" letter-spacing="8" fill="url(#goldg)">{{intro_title}}</text>
    <text x="640" y="336" text-anchor="middle"
          font-family="'Cormorant Garamond', Georgia, 'Gulim', '굴림', serif"
          font-size="15" letter-spacing="6" fill="#E8E6DA" opacity="0.75" font-style="italic">{{intro_subtitle}}</text>
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
  const contentTop = opts.contentTop ?? 355;
  const contentBottom = opts.contentBottom ?? 685;
  const paddingX = opts.paddingX ?? 60;

  // 타이틀은 항상 표출. 카드는 count 에 따라 분기.
  if (count === 0) {
    return `${titleBlock()}${emptyState((contentTop + contentBottom) / 2)}`;
  }
  if (count === 1) {
    // 1명일 때는 hero 카드. 타이틀 위치를 조금 위로 올려 균형 잡기.
    return `${titleBlock()}${singleHeroCard()}`;
  }

  const { cols, rows } = chooseGrid(count);
  const usableW = 1280 - paddingX * 2;
  const usableH = contentBottom - contentTop;
  const cellW = usableW / cols;
  const cellH = usableH / rows;

  // 카드 photo 반경 — 사진/이름 간격을 넉넉히 두고 행 사이도 시원하게 띄우기 위해 cellH 비중 축소.
  // cellW * 0.30 = 가로 여유, cellH * 0.23 = 텍스트 2줄 + 상하 마진 + 행간 확보용.
  const photoR = Math.min(cellW * 0.30, cellH * 0.23);
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
    cards.push(judgeCard(i + 1, cx, cy, photoR, baseNameFont, baseMetaFont, uid));
  }

  return `${titleBlock()}<g>${cards.join('')}</g>`;
}
