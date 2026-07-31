// Template 06 — RESULT (예선/본선 통과자 명단).
// 도록의 출품자 명단 형식 — 좌(리더)/우(팔로워) 두 열, 행마다 [순번 · 초상 · 번호 · 이름].
// 인원이 12명을 넘으면 각 열을 2개의 하위 열로 나눠 행 높이(=가독성)를 유지한다.
import {
  shell, topBar, footBar, hairline, metaLabel, panel, portrait,
  DISPLAY, BODY, MONO, INK, INK_SOFT, ACCENT, TEAL, CX, MX, RX,
} from '../common';

const COL_W = 500;
const LEFT_X = MX;
const RIGHT_X = RX - COL_W;
const ROWS_TOP = 300;
const ROWS_BOTTOM = 574;

function roleColumn(
  x0: number,
  label: string,
  keyPrefix: 'result_leader' | 'result_follower',
  count: number,
  accent: string
): string {
  const subCols = count <= 12 ? 1 : 2;
  const perCol = Math.ceil(count / subCols);
  const subGap = 18;
  const subW = (COL_W - subGap * (subCols - 1)) / subCols;
  const avail = ROWS_BOTTOM - ROWS_TOP;
  const rowH = Math.min(40, avail / perCol);
  const fs = Math.max(11, Math.min(20, rowH * 0.54));
  const withPhoto = subCols === 1 && rowH >= 30;
  const pr = Math.min((rowH - 8) / 2, 14);

  let rows = '';
  for (let i = 1; i <= count; i++) {
    const sub = Math.floor((i - 1) / perCol);
    const idxInSub = (i - 1) % perCol;
    const sx = x0 + sub * (subW + subGap);
    const cy = ROWS_TOP + idxInSub * rowH + rowH / 2;
    const baseline = cy + fs * 0.35;
    const numX = sx + (withPhoto ? 34 + pr * 2 : 30);
    const nameX = numX + Math.max(46, fs * 3.2);
    rows += `
      <g opacity="0">
        <animate attributeName="opacity" values="0;1" dur="0.4s" begin="${(0.2 + i * 0.05).toFixed(2)}s" fill="freeze"/>
        <text x="${sx + 2}" y="${baseline.toFixed(1)}" font-family="${MONO}" font-size="${(fs * 0.66).toFixed(1)}"
          letter-spacing="1" fill="${INK_SOFT}" opacity="0.75">${String(i).padStart(2, '0')}</text>
        ${withPhoto ? portrait(sx + 32 + pr, cy, pr, `{{${keyPrefix}_photo_${i}}}`, accent) : ''}
        <text x="${numX.toFixed(1)}" y="${baseline.toFixed(1)}" font-family="${MONO}" font-size="${(fs * 0.84).toFixed(1)}"
          font-weight="700" letter-spacing="0.5" fill="${accent}">{{${keyPrefix}_num_${i}}}</text>
        <text x="${nameX.toFixed(1)}" y="${baseline.toFixed(1)}" font-family="${BODY}" font-size="${fs.toFixed(1)}"
          font-weight="500" letter-spacing="0.3" fill="${INK}">{{${keyPrefix}_${i}}}</text>
      </g>
    `;
  }

  const blockH = Math.min(perCol * rowH, avail);
  return `
    ${panel(x0 - 16, ROWS_TOP - 14, COL_W + 32, blockH + 28, 0.42)}
    <text x="${x0 + COL_W / 2}" y="${268}" text-anchor="middle" font-family="${MONO}" font-size="16"
      letter-spacing="8" fill="${accent}">${label}</text>
    ${hairline(280, x0, x0 + COL_W, 0.3, accent)}
    ${rows}
  `;
}

export function resultListSvg(count: number): string {
  const n = Math.max(1, Math.min(25, count));
  return shell(`
    ${topBar()}

    ${metaLabel(CX, 166, '{{result_subtitle}}', { size: 13, tracking: 8, fill: INK_SOFT })}
    <text x="${CX}" y="${214}" text-anchor="middle" font-family="${DISPLAY}" font-weight="700"
      font-size="48" letter-spacing="5" fill="${INK}">{{result_title}}</text>
    ${hairline(236, MX, RX, 0.18)}

    ${roleColumn(LEFT_X, '{{label_leader}}', 'result_leader', n, ACCENT)}
    ${roleColumn(RIGHT_X, '{{label_follower}}', 'result_follower', n, TEAL)}

    ${footBar()}
  `);
}
