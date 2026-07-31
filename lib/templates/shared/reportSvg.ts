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
  /** 메달 안쪽 숫자색 (밝은 메달 위) */
  medalText: string;
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
}

export const DEFAULT_REPORT_THEME: ReportTheme = {
  accent: '#D4AF37',
  text: '#E8E6DA',
  silver: '#C7C9D1',
  bronze: '#C08457',
  goldFill: 'url(#goldg)',
  medalText: '#2A1E00',
  rowBg: '#000000',
  rowBgOpacity: 0.34,
  topRowBgOpacity: 0.12,
  display: "'Cinzel', 'Cormorant Garamond', Georgia, 'Gulim', '굴림', serif",
  body: "'Cormorant Garamond', Georgia, 'Gulim', '굴림', serif",
  mono: 'ui-monospace, monospace',
  italic: true,
};

const COL_W = 560;
const ROW_H = 82;
const ROW_GAP = 8;
const START_Y = 250;

function trunc(s: string, n = 18): string {
  const t = (s ?? '').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

function medal(rank: number, th: ReportTheme): { fill: string; stroke: string; text: string } {
  if (rank === 1) return { fill: th.goldFill, stroke: '#F3D477', text: th.medalText };
  if (rank === 2) return { fill: th.silver, stroke: '#E4E6EE', text: '#20232B' };
  if (rank === 3) return { fill: th.bronze, stroke: '#D9A57A', text: '#241206' };
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
  const cx = x0 + 46;
  const cy = y0 + ROW_H / 2;
  const rightX = x0 + COL_W - 26;
  const total = xmlEscape(e.total || '—');
  const avg = xmlEscape(e.avg || '—');
  const name = xmlEscape(trunc(e.name));
  const num = xmlEscape(`#${e.num}`);
  return `
    <g>
      <rect x="${x0}" y="${y0}" width="${COL_W}" height="${ROW_H}" rx="16"
        fill="${top ? GOLD : th.rowBg}" fill-opacity="${top ? th.topRowBgOpacity : th.rowBgOpacity}"
        stroke="${top ? th.goldFill : GOLD}" stroke-opacity="${top ? 1 : 0.22}" stroke-width="${top ? 2 : 1}"/>
      <circle cx="${cx}" cy="${cy}" r="25" fill="${m.fill}" stroke="${m.stroke}" stroke-width="1.5"/>
      <text x="${cx}" y="${cy + (top ? 8 : 7)}" text-anchor="middle" font-family="${SERIF}" font-weight="700"
        font-size="${top ? 24 : 20}" fill="${m.text}">${e.rank}</text>
      <text x="${x0 + 86}" y="${y0 + 32}" font-family="${MONO}" font-size="14" letter-spacing="1.5" fill="${GOLD}">${num}</text>
      <text x="${x0 + 86}" y="${y0 + 62}" font-family="${SERIF_BODY}" font-weight="600" font-size="30" fill="${CREAM}">${name}</text>
      <text x="${rightX}" y="${y0 + 38}" text-anchor="end" font-family="${SERIF}" font-weight="700" font-size="34"
        fill="${top ? GOLD : CREAM}">${total}</text>
      <text x="${rightX}" y="${y0 + 54}" text-anchor="end" font-family="${SERIF_BODY}" font-size="11" letter-spacing="2" fill="${CREAM}" opacity="0.55">TOTAL</text>
      <text x="${rightX}" y="${y0 + 74}" text-anchor="end" font-family="${MONO}" font-size="15" fill="${CREAM}" opacity="0.85">${avg} <tspan font-family="${SERIF_BODY}" font-size="10" opacity="0.6">AVG</tspan></text>
    </g>`;
}

function column(x0: number, label: string, rows: ReportEntry[], th: ReportTheme): string {
  const cx = x0 + COL_W / 2;
  const header = `
    <g transform="translate(${cx} 222)">
      <line x1="-120" y1="0" x2="-52" y2="0" stroke="url(#goldgh)" stroke-width="1"/>
      <line x1="52" y1="0" x2="120" y2="0" stroke="url(#goldgh)" stroke-width="1"/>
      <text text-anchor="middle" y="5" font-family="${th.display}" font-weight="600" font-size="22" letter-spacing="8" fill="${th.accent}">${xmlEscape(label)}</text>
    </g>`;
  const body = rows.length === 0
    ? `<text x="${cx}" y="${START_Y + 60}" text-anchor="middle" font-family="${th.body}" font-size="20" fill="${th.text}" opacity="0.55">결과 준비 중</text>`
    : rows.slice(0, 5).map((e, i) => row(x0, START_Y + i * (ROW_H + ROW_GAP), e, th)).join('');
  return header + body;
}

export function renderReportSvg(
  data: ReportData,
  shell: ShellFn,
  topHeader: HeaderFn,
  theme?: Partial<ReportTheme>
): string {
  const th: ReportTheme = { ...DEFAULT_REPORT_THEME, ...(theme ?? {}) };
  const title = xmlEscape(data.report_title);
  const subtitle = xmlEscape(data.report_subtitle);
  return shell(`
    ${topHeader()}
    <text x="640" y="150" text-anchor="middle" font-family="${th.display}" font-weight="bold" font-size="46" letter-spacing="12" fill="${th.goldFill}">${title}</text>
    <text x="640" y="182" text-anchor="middle" font-family="${th.body}" ${th.italic ? 'font-style="italic"' : ''} font-size="17" letter-spacing="6" fill="${th.text}" opacity="0.9">${subtitle}</text>
    ${column(60, data.label_leader, data.leaders, th)}
    ${column(660, data.label_follower, data.followers, th)}
  `);
}
