// Template 05 — RESULT (예선/본선 통과자 명단).
// 04 는 육각형 + 이름 텍스트라 인원이 늘수록 도형이 작아지고 이름이 읽기 어려웠다.
// 05 는 "명단은 표로 읽는다"는 원칙 — 좌(리더)/우(팔로워) 두 열의 행 리스트.
//   · 번호(모노)와 이름(산세리프)을 폰트로 구분해 스캔이 빠르다.
//   · 인원이 12명을 넘으면 각 역할 열을 2개의 하위 열로 쪼개 행 높이를 유지한다.
//   · 행 높이가 넉넉할 때(12명 이하)만 인물 사진 타일을 함께 노출.
import {
  shell, topBar, footBar, accentBar, rule, metaLabel, plate, photoTile,
  DISPLAY, BODY, MONO, PAPER, DIM, ACCENT, COOL, MX, RX,
} from '../common';

const COL_W = 524;           // 역할별 열 폭
const LEFT_X = MX;           // 리더 열 시작 x
const RIGHT_X = RX - COL_W;  // 팔로워 열 시작 x
const ROWS_TOP = 302;
const ROWS_BOTTOM = 606;

function roleColumn(
  x0: number,
  label: string,
  keyPrefix: 'result_leader' | 'result_follower',
  count: number,
  accent: string
): string {
  const subCols = count <= 12 ? 1 : 2;
  const perCol = Math.ceil(count / subCols);
  const subGap = 20;
  const subW = (COL_W - subGap * (subCols - 1)) / subCols;
  const avail = ROWS_BOTTOM - ROWS_TOP;
  const rowH = Math.min(42, avail / perCol);
  const fs = Math.max(11, Math.min(21, rowH * 0.56));
  const withPhoto = subCols === 1 && rowH >= 30;
  const tile = Math.min(rowH - 8, 30);

  let rows = '';
  for (let i = 1; i <= count; i++) {
    const sub = Math.floor((i - 1) / perCol);
    const idxInSub = (i - 1) % perCol;
    const sx = x0 + sub * (subW + subGap);
    const cy = ROWS_TOP + idxInSub * rowH + rowH / 2;
    const baseline = cy + fs * 0.35;
    const numX = sx + (withPhoto ? 30 + tile : 30);
    const nameX = numX + Math.max(50, fs * 3.4);
    const delay = 0.2 + i * 0.05;
    rows += `
      <g opacity="0">
        <animate attributeName="opacity" values="0;1" dur="0.4s" begin="${delay.toFixed(2)}s" fill="freeze"/>
        <text x="${sx + 2}" y="${baseline.toFixed(1)}" font-family="${MONO}" font-size="${(fs * 0.68).toFixed(1)}"
          letter-spacing="1" fill="${DIM}" opacity="0.75">${String(i).padStart(2, '0')}</text>
        ${withPhoto ? photoTile(sx + 28 + tile / 2, cy, tile, `{{${keyPrefix}_photo_${i}}}`, accent) : ''}
        <text x="${numX.toFixed(1)}" y="${baseline.toFixed(1)}" font-family="${MONO}" font-size="${(fs * 0.86).toFixed(1)}"
          font-weight="700" letter-spacing="0.5" fill="${accent}">{{${keyPrefix}_num_${i}}}</text>
        <text x="${nameX.toFixed(1)}" y="${baseline.toFixed(1)}" font-family="${BODY}" font-size="${fs.toFixed(1)}"
          font-weight="500" letter-spacing="0.4" fill="${PAPER}">{{${keyPrefix}_${i}}}</text>
      </g>
    `;
  }

  const plateH = Math.min(perCol * rowH, avail) + 28;
  return `
    ${plate(x0 - 16, ROWS_TOP - 14, COL_W + 32, plateH, { rx: 4, opacity: 0.44, strokeOpacity: 0.1 })}
    <text x="${x0}" y="${266}" font-family="${MONO}" font-size="17" letter-spacing="8" fill="${accent}">${label}</text>
    ${rule(280, x0, x0 + COL_W, 0.28, accent)}
    ${rows}
  `;
}

export function resultListSvg(count: number): string {
  const n = Math.max(1, Math.min(25, count));
  return shell(`
    ${topBar('')}

    ${accentBar(140, 84)}
    ${metaLabel(MX + 26, 164, '{{result_subtitle}}', { size: 13, tracking: 6, fill: DIM })}
    <text x="${MX + 24}" y="${212}" font-family="${DISPLAY}" font-weight="600" font-size="52"
      letter-spacing="2" fill="${PAPER}">{{result_title}}</text>
    ${metaLabel(RX, 212, `${n} EACH`, { size: 14, tracking: 5, anchor: 'end', fill: DIM })}
    ${rule(234, MX, RX, 0.16)}

    ${roleColumn(LEFT_X, '{{label_leader}}', 'result_leader', n, ACCENT)}
    ${roleColumn(RIGHT_X, '{{label_follower}}', 'result_follower', n, COOL)}

    ${footBar()}
  `);
}
