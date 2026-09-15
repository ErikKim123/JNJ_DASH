// Template 09 — RESULT (예선/본선 통과자 명단).
// 화면을 가로로 두 띠로 나눈다 — 위 = 리더, 아래 = 팔로워. 각 띠 왼쪽에 세로 역할 탭.
// 인원에 따라 카드 구성을 바꿔 사진이 들어갈 수 있는 한 크게 보여준다:
//   ≤ 6명  : 1행 — 레퍼런스와 같은 세로 카드 [사진 · CONTESTANT · 강조 번호 · 이름]
//   ≤ 12명 : 2행 — 가로 카드 [사진 | CONTESTANT · 번호 · 이름]
//   ≤ 25명 : 3~4행 — 칩 [작은 사진 | 번호 · 이름]
import {
  shell, topBar, footBar, heading, panelCard, label, accentNumber, strong, photoFrame, fadeUp, clipBox,
  DISPLAY, NIGHT, MX, RX, f, fitAttr, ROLE_FILL, type Role,
} from '../common';

const TOP = 170;
const BOTTOM = 650;
const BAND_GAP = 14;
const TAB_W = 46;
const GRID_X = MX + TAB_W + 12;
const GRID_W = RX - GRID_X;
const GAP = 12;

type Key = 'result_leader' | 'result_follower';

function bandGrid(n: number): { cols: number; rows: number } {
  if (n <= 6) return { cols: Math.max(1, n), rows: 1 };
  if (n <= 12) return { cols: Math.ceil(n / 2), rows: 2 };
  if (n <= 18) return { cols: 6, rows: 3 };
  return { cols: Math.ceil(n / 4), rows: 4 };
}

function tallCard(key: Key, i: number, x: number, y: number, w: number, h: number): string {
  const cx = x + w / 2;
  const ph = h * 0.5;
  const pw = Math.min(w - 36, ph * 0.95);
  const photoY = y + 14;
  const labelY = photoY + ph + 22;
  return `
    ${panelCard(x, y, w, h)}
    ${photoFrame(cx - pw / 2, photoY, pw, ph, `{{${key}_photo_${i}}}`)}
    ${label(cx, labelY, 'CONTESTANT', { size: 10, tracking: 2 })}
    ${accentNumber(cx, labelY + 38, `{{${key}_num_${i}}}`, 36)}
    ${clipBox(x + 8, y + h - 38, w - 16, 30, strong(cx, y + h - 16, `{{${key}_${i}}}`, 16, { fit: w - 20, fitMin: 0.8, ellipsis: true }))}
  `;
}

function midCard(key: Key, i: number, x: number, y: number, w: number, h: number): string {
  const ph = h - 18;
  const pw = ph * 0.8;
  const tx = x + 9 + pw + 12;
  const tw = x + w - 10 - tx;
  return `
    ${panelCard(x, y, w, h, { rx: 14 })}
    ${photoFrame(x + 9, y + 9, pw, ph, `{{${key}_photo_${i}}}`, { rx: 8, ringW: 2 })}
    ${label(tx, y + h * 0.3, 'CONTESTANT', { size: Math.min(10, tw / 9), tracking: 1, anchor: 'start' })}
    ${accentNumber(tx, y + h * 0.63, `{{${key}_num_${i}}}`, Math.min(32, h * 0.3), 'start')}
    ${clipBox(tx, y + h * 0.68, tw, h * 0.26, strong(tx, y + h * 0.86, `{{${key}_${i}}}`, 13, { anchor: 'start', fit: tw, fitMin: 0.85, ellipsis: true }))}
  `;
}

function chipCard(key: Key, i: number, x: number, y: number, w: number, h: number): string {
  const ph = h - 12;
  const tx = x + 6 + ph + 10;
  const tw = x + w - 8 - tx;
  const numSize = Math.min(22, h * 0.36);
  const nameSize = Math.min(14, h * 0.24);
  return `
    ${panelCard(x, y, w, h, { rx: Math.min(14, h * 0.25) })}
    ${photoFrame(x + 6, y + 6, ph, ph, `{{${key}_photo_${i}}}`, { rx: 6, ringW: 1.6 })}
    ${accentNumber(tx, y + h * 0.47, `{{${key}_num_${i}}}`, numSize, 'start')}
    ${clipBox(tx, y + h * 0.55, tw, h * 0.4, strong(tx, y + h * 0.82, `{{${key}_${i}}}`, nameSize, { anchor: 'start', fit: tw, fitMin: 0.85, ellipsis: true }))}
  `;
}

function roleBand(role: Role, y: number, h: number, labelKey: string, key: Key, n: number, baseDelay: number): string {
  const { cols, rows } = bandGrid(n);
  const cellW = Math.min(rows === 1 ? 224 : 999, (GRID_W - GAP * (cols - 1)) / cols);
  const cellH = (h - GAP * (rows - 1)) / rows;
  const gridCx = GRID_X + GRID_W / 2;

  let cards = '';
  for (let i = 1; i <= n; i++) {
    const row = Math.floor((i - 1) / cols);
    const col = (i - 1) % cols;
    const inRow = row === rows - 1 ? n - row * cols : cols;
    const rowW = inRow * cellW + GAP * (inRow - 1);
    const x = gridCx - rowW / 2 + col * (cellW + GAP);
    const cy = y + row * (cellH + GAP);
    const card =
      rows === 1
        ? tallCard(key, i, x, cy, cellW, cellH)
        : rows === 2
          ? midCard(key, i, x, cy, cellW, cellH)
          : chipCard(key, i, x, cy, cellW, cellH);
    cards += fadeUp(baseDelay + i * 0.035, card, 12);
  }

  const tab = `
    <rect x="${MX}" y="${f(y)}" width="${TAB_W}" height="${f(h)}" rx="14" fill="${ROLE_FILL[role]}"/>
    <text class="flat"${fitAttr(h - 28, 0.6)} transform="translate(${f(MX + TAB_W / 2 + 5)} ${f(y + h / 2)}) rotate(-90)" text-anchor="middle"
      font-family="${DISPLAY}" font-weight="900" font-size="14" letter-spacing="5" fill="${NIGHT}">${labelKey}</text>
  `;

  return `${fadeUp(baseDelay, tab, 0)}${cards}`;
}

export function resultListSvg(count: number): string {
  const n = Math.max(1, Math.min(25, count));
  const bandH = (BOTTOM - TOP - BAND_GAP) / 2;
  return shell(`
    ${topBar()}
    ${heading('{{result_title}}', '{{result_subtitle}}')}
    ${roleBand('L', TOP, bandH, '{{label_leader}}', 'result_leader', n, 0.15)}
    ${roleBand('F', TOP + bandH + BAND_GAP, bandH, '{{label_follower}}', 'result_follower', n, 0.3)}
    ${footBar()}
  `);
}
