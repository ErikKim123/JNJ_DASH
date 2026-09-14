// Template 07 — 텍스트 자동 맞춤.
//
// SVG 는 글자 폭을 스스로 맞추지 못하고, 운영 데이터(대회명·라운드명·안내 문구·참가자 이름)는
// 길이를 예측할 수 없다. 템플릿이 미리 정한 글자 크기로는 "PRELIMINARY ROUND" 같은 실제 값이
// 카드 밖으로 넘친다.
//
// 그래서 빌더는 넘치면 안 되는 <text> 에 data-fit="최대폭,최소비율[,t]" 를 달아 두고(common.ts fitAttr),
// placeholder 치환이 끝난 SVG 문자열에서 여기서 실제 글자 폭을 추정해 맞춘다.
//   1) 추정 폭 ≤ 최대폭           → 그대로
//   2) 넘치면                      → font-size·letter-spacing 을 같은 비율로 줄인다 (자간 리듬 유지)
//   3) 최소비율까지 줄여도 넘치면  → 기본: 최소 크기에서 textLength 로 최대폭에 맞춰 가로 압축
//                                     t  : 최소 크기에서 말줄임(…) — 좁은 칸의 이름처럼, 아주 작게 눌린
//                                          전체 글자보다 "읽히는 앞부분"이 더 중요한 자리
// 문자열 단계에서 끝나므로 JS 가 없는 템플릿 미리보기 iframe(sandbox) 에서도 똑같이 적용된다.
//
// 글자 폭 표는 Chromium 에서 Montserrat 800/900 을 1000px 로 실측한 advance (1/1000 em, U+0020–U+007E).
// 합산은 커닝을 무시하므로 실제보다 조금 넓게 잡힌다 — 맞춘 결과는 항상 안전한 쪽으로 작다.
import { xmlEscape } from '../placeholder';

const ADV_800 = [
  291, 301, 462, 730, 647, 897, 752, 242, 369, 369, 453, 609, 283, 388, 283, 415, 685, 405, 599, 603, 700, 607, 649, 632,
  669, 649, 283, 283, 609, 609, 609, 597, 1036, 786, 769, 730, 826, 672, 642, 770, 806, 339, 557, 752, 610, 954, 806, 846,
  737, 846, 740, 647, 635, 786, 766, 1184, 737, 693, 679, 389, 415, 389, 610, 500, 600, 628, 695, 603, 698, 642, 406, 705,
  696, 313, 320, 677, 313, 1045, 696, 666, 695, 695, 443, 547, 447, 692, 620, 956, 619, 620, 556, 414, 314, 414, 609,
];
const ADV_900 = [
  300, 314, 489, 740, 657, 917, 777, 254, 381, 381, 473, 620, 304, 390, 304, 440, 692, 418, 608, 614, 712, 619, 661, 645,
  678, 661, 304, 304, 620, 620, 620, 606, 1037, 806, 773, 737, 826, 673, 644, 769, 804, 350, 574, 765, 617, 954, 804, 848,
  743, 848, 745, 657, 654, 784, 786, 1206, 762, 710, 687, 410, 440, 410, 620, 500, 600, 639, 700, 615, 705, 653, 426, 711,
  702, 326, 334, 701, 326, 1040, 702, 678, 700, 700, 456, 565, 460, 698, 644, 977, 645, 644, 570, 438, 320, 438, 620,
];

const ELLIPSIS = '…';

/** 한 글자의 advance (1/1000 em). 표에 없는 글자는 보수적으로 넓게 잡는다. */
function advance(ch: string, table: readonly number[]): number {
  const code = ch.codePointAt(0) ?? 0;
  if (code >= 32 && code <= 126) return table[code - 32];
  if (code === 0xb7) return 344; // ·
  if (code >= 0x0300 && code <= 0x036f) return 0; // 결합 악센트 (NFD 분해 후)
  if (code === 0x201c || code === 0x201d || code === 0x2018 || code === 0x2019) return 594; // “ ” ‘ ’
  if (code === 0x2026) return 800; // …
  // 한글·CJK·전각 기호·대시·화살표 — Malgun Gothic 폴백은 전각(1em)
  if (code >= 0x1100 || code === 0x2014 || code === 0x2192) return 1000;
  return 760;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

/** font-size·letter-spacing·font-weight 기준 추정 폭(px). Chrome 은 마지막 글자 뒤에도 자간을 더한다. */
export function estimateTextWidth(text: string, fontSize: number, letterSpacing: number, weight: number): number {
  const table = weight >= 850 ? ADV_900 : ADV_800;
  let em = 0;
  for (const ch of Array.from(text)) {
    const code = ch.codePointAt(0) ?? 0;
    // 한글 음절은 그대로 1em — 문자열 전체를 NFD 로 풀면 음절이 자모 2~3개로 쪼개져 폭이 2~3배로 잡힌다.
    // 그 밖의 글자만 NFD 첫 글자(é → e)로 표를 찾는다.
    em += code >= 0xac00 && code <= 0xd7a3 ? 1000 : advance(ch.normalize('NFD').charAt(0) || ch, table);
  }
  return (em / 1000) * fontSize + letterSpacing * Array.from(text).length;
}

function numAttr(attrs: string, name: string): number | null {
  const m = new RegExp(`\\s${name}="(-?[\\d.]+)"`).exec(attrs);
  return m ? Number(m[1]) : null;
}

function setAttr(attrs: string, name: string, value: number): string {
  const v = String(Math.round(value * 100) / 100);
  const re = new RegExp(`(\\s${name}=")(-?[\\d.]+)(")`);
  return re.test(attrs) ? attrs.replace(re, `$1${v}$3`) : `${attrs} ${name}="${v}"`;
}

/** 말줄임 — 뒤에서부터 글자를 떼어 "앞부분…" 이 최대폭 안에 들어오게 한다. */
function truncate(text: string, maxW: number, fontSize: number, letterSpacing: number, weight: number): string {
  const chars = Array.from(text);
  while (chars.length > 1 && estimateTextWidth(`${chars.join('').trimEnd()}${ELLIPSIS}`, fontSize, letterSpacing, weight) > maxW) {
    chars.pop();
  }
  return `${chars.join('').trimEnd()}${ELLIPSIS}`;
}

// <text …data-fit="W,R[,t]"…>내용</text> — 내용은 평문 또는 <tspan>(font-size 없는) 조합.
const FIT_TEXT = /<text\b([^>]*?)\sdata-fit="([\d.]+),([\d.]+)(,t)?"([^>]*)>((?:[^<]|<tspan\b[^>]*>[^<]*<\/tspan>)*)<\/text>/g;

export function applyTextFit(svg: string): string {
  return svg.replace(
    FIT_TEXT,
    (_m, before: string, maxWRaw: string, minRaw: string, ellipsis: string | undefined, after: string, content: string) => {
      let attrs = `${before}${after}`;
      let body = content;
      const text = decodeEntities(content.replace(/<[^>]+>/g, '')).trim();
      const fontSize = numAttr(attrs, 'font-size');
      if (!text || fontSize == null) return `<text${attrs}>${body}</text>`;

      const maxW = Number(maxWRaw);
      const minRatio = Number(minRaw);
      const letterSpacing = numAttr(attrs, 'letter-spacing') ?? 0;
      const weight = numAttr(attrs, 'font-weight') ?? 400;
      const width = estimateTextWidth(text, fontSize, letterSpacing, weight);
      if (width <= maxW) return `<text${attrs}>${body}</text>`;

      const ratio = Math.max(minRatio, maxW / width);
      const fs = fontSize * ratio;
      const ls = letterSpacing * ratio;
      attrs = setAttr(attrs, 'font-size', fs);
      if (letterSpacing) attrs = setAttr(attrs, 'letter-spacing', ls);
      if (width * ratio > maxW) {
        if (ellipsis && !content.includes('<')) {
          body = xmlEscape(truncate(text, maxW, fs, ls, weight));
        } else {
          attrs += ` textLength="${Math.round(maxW)}" lengthAdjust="spacingAndGlyphs"`;
        }
      }
      return `<text${attrs}>${body}</text>`;
    }
  );
}
