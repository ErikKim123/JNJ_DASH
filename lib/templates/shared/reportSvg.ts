// 결승 보고서 SVG — 시상식(Ceremony)과 동일한 shell/골드 그라디언트/세리프로 1~5등 스코어 표.
// 각 디자인 템플릿(01/02/03)이 자기 shell·topHeader 를 넘겨 배경/톤을 그대로 상속한다.
import type { ReportData, ReportEntry } from '@/lib/sheets/types';
import { xmlEscape } from '../placeholder';

type ShellFn = (content: string) => string;
type HeaderFn = () => string;

/** 색/폰트 테마 — 골드-온-다크(01~04) 가 기본, 05/06 은 필요한 키만 덮어쓴다. */
export interface ReportTheme {
  /** 강조색 — 랭크 라벨/번호/구분선 */
  accent: string;
  /** 본문 텍스트 */
  text: string;
  /** 2위 메달 */
  silver: string;
  /** 3위 메달 */
  bronze: string;
  /** 1위 메달 fill (그라디언트 url 가능) */
  goldFill: string;
  /** 1위 메달 안쪽 숫자색 */
  medalText: string;
  /** 2위 메달 안쪽 숫자색 — silver 가 어두운 템플릿(06)은 밝게 덮어쓴다 */
  silverText: string;
  /** 3위 메달 안쪽 숫자색 — bronze 가 어두운 템플릿(06)은 밝게 덮어쓴다 */
  bronzeText: string;
  /** 행 배경 */
  rowBg: string;
  /** 행 배경 불투명도 */
  rowBgOpacity: number;
  /** 1위 행 강조 배경 불투명도 */
  topRowBgOpacity: number;
  display: string;
  body: string;
  mono: string;
  /** 부제에 이탤릭 적용 여부 — 산세리프 템플릿(05/06)은 false */
  italic: boolean;
  /**
   * 레이아웃 좌표 — 기본값은 01~05 가 쓰던 값 그대로.
   * 06 처럼 "지면(card)" 안쪽에 표를 가둬야 하는 템플릿만 덮어쓴다.
   */
  layout: ReportLayout;
}

/** 보고서 표 좌표. row 내부 오프셋은 rowH 에 비례해 자동 스케일된다. */
export interface ReportLayout {
  /** 좌측 컬럼 x */
  leftX: number;
  /** 우측 컬럼 x */
  rightX: number;
  /** 컬럼 폭 */
  colW: number;
  /** 행 높이 (기준 82 — 이 값에 비례해 행 내부 폰트/오프셋이 축소·확대) */
  rowH: number;
  /** 행 간격 */
  rowGap: number;
  /** 첫 행 y */
  startY: number;
  /** LEADER / FOLLOWER 머리글 y */
  headerY: number;
  /** 제목 baseline y */
  titleY: number;
  /** 제목 font-size */
  titleSize: number;
  /** 제목 letter-spacing */
  titleTracking: number;
  /** 부제 baseline y */
  subtitleY: number;
}

export const DEFAULT_REPORT_LAYOUT: ReportLayout = {
  leftX: 60,
  rightX: 660,
  colW: 560,
  rowH: 82,
  rowGap: 8,
  startY: 250,
  headerY: 222,
  titleY: 150,
  titleSize: 46,
  titleTracking: 12,
  subtitleY: 182,
};

/** 행 내부 오프셋/폰트 기준 행 높이 — 이 값 대비 rowH 비율로 스케일한다. */
const BASE_ROW_H = 82;

export const DEFAULT_REPORT_THEME: ReportTheme = {
  accent: '#D4AF37',
  text: '#E8E6DA',
  silver: '#C7C9D1',
  bronze: '#C08457',
  goldFill: 'url(#goldg)',
  medalText: '#2A1E00',
  silverText: '#20232B',
  bronzeText: '#241206',
  rowBg: '#000000',
  rowBgOpacity: 0.34,
  topRowBgOpacity: 0.12,
  display: "'Cinzel', 'Cormorant Garamond', Georgia, 'Gulim', '굴림', serif",
  body: "'Cormorant Garamond', Georgia, 'Gulim', '굴림', serif",
  mono: 'ui-monospace, monospace',
  italic: true,
  layout: DEFAULT_REPORT_LAYOUT,
};

function trunc(s: string, n = 18): string {
  const t = (s ?? '').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

function medal(rank: number, th: ReportTheme): { fill: string; stroke: string; text: string } {
  if (rank === 1) return { fill: th.goldFill, stroke: '#F3D477', text: th.medalText };
  if (rank === 2) return { fill: th.silver, stroke: '#E4E6EE', text: th.silverText };
  if (rank === 3) return { fill: th.bronze, stroke: '#D9A57A', text: th.bronzeText };
  return { fill: 'none', stroke: `${th.accent}66`, text: th.text };
}

function row(x0: number, y0: number, e: ReportEntry, th: ReportTheme): string {
  const top = e.rank === 1;
  const m = medal(e.rank, th);
  const GOLD = th.accent;
  const CREAM = th.text;
  const SERIF = th.display;
  const SERIF_BODY = th.body;
  const MONO = th.mono;
  const L = th.layout;
  // 행이 낮아지면 내부 좌표·글자도 같은 비율로 줄여야 아래 행/지면 밖으로 넘치지 않는다.
  const k = L.rowH / BASE_ROW_H;
  const s = (v: number) => Number((v * k).toFixed(1));
  const cx = x0 + s(46);
  const cy = y0 + L.rowH / 2;
  const rightX = x0 + L.colW - s(26);
  const textX = x0 + s(86);
  const total = xmlEscape(e.total || '—');
  const avg = xmlEscape(e.avg || '—');
  const name = xmlEscape(trunc(e.name));
  const num = xmlEscape(`#${e.num}`);
  return `
    <g>
      <rect x="${x0}" y="${y0}" width="${L.colW}" height="${L.rowH}" rx="${s(16)}"
        fill="${top ? GOLD : th.rowBg}" fill-opacity="${top ? th.topRowBgOpacity : th.rowBgOpacity}"
        stroke="${top ? th.goldFill : GOLD}" stroke-opacity="${top ? 1 : 0.22}" stroke-width="${top ? 2 : 1}"/>
      <circle cx="${cx}" cy="${cy}" r="${s(25)}" fill="${m.fill}" stroke="${m.stroke}" stroke-width="1.5"/>
      <text x="${cx}" y="${cy + s(top ? 8 : 7)}" text-anchor="middle" font-family="${SERIF}" font-weight="700"
        font-size="${s(top ? 24 : 20)}" fill="${m.text}">${e.rank}</text>
      <text x="${textX}" y="${y0 + s(32)}" font-family="${MONO}" font-size="${s(14)}" letter-spacing="1.5" fill="${GOLD}">${num}</text>
      <text x="${textX}" y="${y0 + s(62)}" font-family="${SERIF_BODY}" font-weight="600" font-size="${s(30)}" fill="${CREAM}">${name}</text>
      <text x="${rightX}" y="${y0 + s(38)}" text-anchor="end" font-family="${SERIF}" font-weight="700" font-size="${s(34)}"
        fill="${top ? GOLD : CREAM}">${total}</text>
      <text x="${rightX}" y="${y0 + s(54)}" text-anchor="end" font-family="${SERIF_BODY}" font-size="${s(11)}" letter-spacing="2" fill="${CREAM}" opacity="0.55">TOTAL</text>
      <text x="${rightX}" y="${y0 + s(74)}" text-anchor="end" font-family="${MONO}" font-size="${s(15)}" fill="${CREAM}" opacity="0.85">${avg} <tspan font-family="${SERIF_BODY}" font-size="${s(10)}" opacity="0.6">AVG</tspan></text>
    </g>`;
}

function column(x0: number, label: string, rows: ReportEntry[], th: ReportTheme): string {
  const L = th.layout;
  const cx = x0 + L.colW / 2;
  const half = Math.min(120, L.colW / 2 - 8);
  const header = `
    <g transform="translate(${cx} ${L.headerY})">
      <line x1="${-half}" y1="0" x2="-52" y2="0" stroke="url(#goldgh)" stroke-width="1"/>
      <line x1="52" y1="0" x2="${half}" y2="0" stroke="url(#goldgh)" stroke-width="1"/>
      <text text-anchor="middle" y="5" font-family="${th.display}" font-weight="600" font-size="22" letter-spacing="8" fill="${th.accent}">${xmlEscape(label)}</text>
    </g>`;
  const body = rows.length === 0
    ? `<text x="${cx}" y="${L.startY + 60}" text-anchor="middle" font-family="${th.body}" font-size="20" fill="${th.text}" opacity="0.55">결과 준비 중</text>`
    : rows.slice(0, 5).map((e, i) => row(x0, L.startY + i * (L.rowH + L.rowGap), e, th)).join('');
  return header + body;
}

export function renderReportSvg(
  data: ReportData,
  shell: ShellFn,
  topHeader: HeaderFn,
  theme?: Partial<Omit<ReportTheme, 'layout'>> & { layout?: Partial<ReportLayout> }
): string {
  const th: ReportTheme = {
    ...DEFAULT_REPORT_THEME,
    ...(theme ?? {}),
    layout: { ...DEFAULT_REPORT_LAYOUT, ...(theme?.layout ?? {}) },
  };
  const L = th.layout;
  const title = xmlEscape(data.report_title);
  const subtitle = xmlEscape(data.report_subtitle);
  return shell(`
    ${topHeader()}
    <text x="640" y="${L.titleY}" text-anchor="middle" font-family="${th.display}" font-weight="bold" font-size="${L.titleSize}" letter-spacing="${L.titleTracking}" fill="${th.goldFill}">${title}</text>
    <text x="640" y="${L.subtitleY}" text-anchor="middle" font-family="${th.body}" ${th.italic ? 'font-style="italic"' : ''} font-size="17" letter-spacing="6" fill="${th.text}" opacity="0.9">${subtitle}</text>
    ${column(L.leftX, data.label_leader, data.leaders, th)}
    ${column(L.rightX, data.label_follower, data.followers, th)}
  `);
}
