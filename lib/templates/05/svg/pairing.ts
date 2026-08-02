// Template 05 — PAIRING.
// 04 는 페어를 원(타원) 둘레에 배치해 위치마다 정렬 기준이 달라졌다(좌/우/중앙 앵커).
// 05 는 균일한 격자 + 칩(chip) 방식:
//   · 모든 칩이 같은 크기·같은 정렬 → 5명이든 25명이든 읽는 리듬이 같다.
//   · 칩은 반투명 판 위에 놓여 배경이 무엇이든 번호가 또렷하다.
//   · 리더=앰버, 팔로워=쿨 실버. 가운데 세로선이 한 쌍을 시각적으로 묶는다.
import {
  shell, topBar, footBar, accentBar, rule, metaLabel, plate,
  DISPLAY, MONO, PAPER, DIM, ACCENT, COOL, MX, RX,
} from '../common';
import { circlePairingLayout } from '../../shared/circlePairing';

const GRID_TOP = 262;
const GRID_BOTTOM = 606;

function gridSpec(count: number) {
  const cols = count <= 6 ? 2 : count <= 12 ? 3 : count <= 20 ? 4 : 5;
  const rows = Math.ceil(count / cols);
  const colGap = 24;
  const chipW = (RX - MX - colGap * (cols - 1)) / cols;
  const avail = GRID_BOTTOM - GRID_TOP;
  const rowH = Math.min(84, avail / rows);
  const top = GRID_TOP + (avail - rowH * rows) / 2;
  const chipH = Math.min(rowH - 12, 68);
  const numFont = cols <= 2 ? 34 : cols === 3 ? 28 : cols === 4 ? 24 : 20;
  // 칩이 좁아지면 순번 라벨이 번호와 겹치므로 넓은 격자에서만 표시.
  const showIdx = chipW >= 240;
  return { cols, rows, colGap, chipW, rowH, top, chipH, numFont, showIdx };
}

function chip(
  i: number,
  cx: number,
  cy: number,
  w: number,
  h: number,
  numFont: number,
  showIdx: boolean,
  delay: number
): string {
  const half = w / 2;
  const idx = showIdx
    ? `<text x="${-half + 16}" y="${numFont * 0.34}" font-family="${MONO}" font-size="${Math.max(10, numFont * 0.42).toFixed(1)}" letter-spacing="1.5" fill="${DIM}" opacity="0.8">${String(i).padStart(2, '0')}</text>`
    : '';
  return `
    <g opacity="0">
      <animate attributeName="opacity" values="0;1" dur="0.45s" begin="${delay.toFixed(2)}s" fill="freeze"/>
      <g transform="translate(${cx.toFixed(1)} ${cy.toFixed(1)})">
        ${plate(-half, -h / 2, w, h, { rx: 3, opacity: 0.5, strokeOpacity: 0.1 })}
        <line x1="0" y1="${(-h * 0.26).toFixed(1)}" x2="0" y2="${(h * 0.26).toFixed(1)}" stroke="${ACCENT}" stroke-width="1" opacity="0.4"/>
        ${idx}
        <text class="on-plate" x="-14" y="${(numFont * 0.35).toFixed(1)}" text-anchor="end" font-family="${MONO}"
          font-size="${numFont}" font-weight="700" letter-spacing="1" fill="${ACCENT}">L{{leader_num_${i}}}</text>
        <text class="on-plate" x="14" y="${(numFont * 0.35).toFixed(1)}" text-anchor="start" font-family="${MONO}"
          font-size="${numFont}" font-weight="700" letter-spacing="1" fill="${COOL}">F{{follower_num_${i}}}</text>
      </g>
    </g>
  `;
}

function renderPairing(pairCount: number): string {
  const count = Math.max(1, Math.min(25, pairCount));
  const s = gridSpec(count);

  let body = '';
  for (let i = 1; i <= count; i++) {
    const row = Math.floor((i - 1) / s.cols);
    const col = (i - 1) % s.cols;
    // 마지막 행에 빈 칸이 생기면 그 행만 가운데 정렬 — 좌측으로 몰리지 않게.
    const itemsInRow = row === s.rows - 1 ? count - row * s.cols : s.cols;
    const rowW = itemsInRow * s.chipW + (itemsInRow - 1) * s.colGap;
    const startX = MX + (RX - MX - rowW) / 2;
    const cx = startX + col * (s.chipW + s.colGap) + s.chipW / 2;
    const cy = s.top + row * s.rowH + s.rowH / 2;
    body += chip(i, cx, cy, s.chipW, s.chipH, s.numFont, s.showIdx, 0.25 + i * 0.035);
  }

  return shell(`
    ${topBar('')}

    ${accentBar(146, 84)}
    ${metaLabel(MX + 26, 170, '{{stage_label}}', { size: 13, tracking: 8 })}
    <text x="${MX + 24}" y="${216}" font-family="${DISPLAY}" font-weight="600" font-size="46"
      letter-spacing="2" fill="${PAPER}">{{round_title}}</text>
    ${metaLabel(RX, 216, `${count} COUPLES`, { size: 14, tracking: 5, anchor: 'end', fill: DIM })}
    ${rule(238, MX, RX, 0.16)}

    ${body}

    ${footBar()}
  `);
}

/**
 * 원형(타원) 배치 — 격자 대신 커플을 원 둘레에 놓는다.
 * 05 는 번호만 쓰는 템플릿이라 원형에서도 L###/F### 코드만 표기한다.
 */
function renderCircle(pairCount: number): string {
  const count = Math.max(1, Math.min(30, pairCount));
  const L = circlePairingLayout(count, { band: [252, 614], withNames: false, ryScale: 1.3 });
  const fs = L.fontSize;

  const body = L.slots
    .map(
      (s) => `
      <g opacity="0">
        <animate attributeName="opacity" values="0;1" dur="0.45s" begin="${s.delay}s" fill="freeze"/>
        <g transform="translate(${s.x} ${s.y})">
          <text class="on-plate" text-anchor="${s.anchor}" y="0" font-family="${MONO}"
            font-size="${fs}" font-weight="700" letter-spacing="1" fill="${ACCENT}">L{{leader_num_${s.i}}}</text>
          <text class="on-plate" text-anchor="${s.anchor}" y="${L.lineH}" font-family="${MONO}"
            font-size="${fs}" font-weight="700" letter-spacing="1" fill="${COOL}">F{{follower_num_${s.i}}}</text>
          <line x1="${s.flourishX1}" y1="${s.flourishY}" x2="${s.flourishX2}" y2="${s.flourishY}"
            stroke="${ACCENT}" stroke-width="1" opacity="0.45"/>
        </g>
      </g>
    `
    )
    .join('');

  const centerMark = `
    <g transform="translate(${L.cx} ${L.cy})" opacity="0">
      <animate attributeName="opacity" values="0;1" dur="0.9s" begin="0s" fill="freeze"/>
      <line x1="-30" y1="0" x2="30" y2="0" stroke="${ACCENT}" stroke-width="1" opacity="0.45"/>
      ${metaLabel(0, 24, 'STAGE', { size: 12, tracking: 8, anchor: 'middle', fill: DIM })}
    </g>
  `;

  return shell(`
    ${topBar('')}

    ${accentBar(146, 84)}
    ${metaLabel(MX + 26, 170, '{{stage_label}}', { size: 13, tracking: 8 })}
    <text x="${MX + 24}" y="${216}" font-family="${DISPLAY}" font-weight="600" font-size="46"
      letter-spacing="2" fill="${PAPER}">{{round_title}}</text>
    ${metaLabel(RX, 216, `${count} COUPLES`, { size: 14, tracking: 5, anchor: 'end', fill: DIM })}
    ${rule(238, MX, RX, 0.16)}

    ${centerMark}
    ${body}

    ${footBar()}
  `);
}

export function pickPairingSvg(pairCount: number, pairCircle = false): string {
  return pairCircle ? renderCircle(pairCount) : renderPairing(pairCount);
}
