// Template 07 — PAIRING.
// 레퍼런스 화면을 가장 직접적으로 옮긴 스텝 — 커플 한 쌍 = 유리 카드 한 장, 5열 격자가 화면을 채운다.
//   · 카드 크기에 따라 두 가지 구성:
//       tall    (행 ≤ 2) : COUPLE 라벨 → 큰 황금 순번 → 구분선 → L/F 번호 + 이름
//       compact (행 ≥ 3) : 좌측 [라벨 + 순번] | 우측 [L 번호 / F 번호] (행 높이가 넉넉하면 이름까지)
//   · 마지막 행이 덜 차면 가운데로 모은다.
import {
  shell, topBar, footBar, heading, glassCard, label, goldNumber, strong, roleChip, fadeUp, clipBox,
  DISPLAY, WHITE, SOFT, GOLD, LEAD, FOLLOW, CX, MX, RX, f, pad2, type Role,
} from '../common';
import { circlePairingLayout } from '../../shared/circlePairing';

const TOP = 172;
const BOTTOM = 648;
const GAP = 14;

function gridFor(n: number): { cols: number; rows: number } {
  if (n <= 5) return { cols: n, rows: 1 };
  if (n <= 10) return { cols: 5, rows: 2 };
  if (n <= 15) return { cols: 5, rows: 3 };
  if (n <= 20) return { cols: 5, rows: 4 };
  if (n <= 24) return { cols: 6, rows: 4 };
  return { cols: 6, rows: 5 };
}

/** L/F 한 줄 — [칩] 번호 (이름). */
function roleLine(
  x: number,
  baseline: number,
  role: Role,
  i: number,
  size: number,
  nameBox: { x: number; w: number; y: number } | null
): string {
  const numKey = role === 'L' ? `{{leader_num_${i}}}` : `{{follower_num_${i}}}`;
  const nameKey = role === 'L' ? `{{leader_${i}}}` : `{{follower_${i}}}`;
  const chip = size * 0.86;
  const name = nameBox
    ? clipBox(nameBox.x, nameBox.y - 15, nameBox.w, 21,
        strong(nameBox.x, nameBox.y, nameKey, 13, { anchor: 'start', fill: SOFT, weight: 700 }))
    : '';
  return `
    ${roleChip(x, baseline, role, size)}
    ${strong(x + chip + 8, baseline, numKey, size, { anchor: 'start', weight: 900, tracking: 0.5 })}
    ${name}
  `;
}

function tallCard(i: number, x: number, y: number, w: number, h: number): string {
  const cx = x + w / 2;
  const numSize = Math.min(96, h * 0.27, w * 0.3);
  const labelY = y + h * 0.15;
  const numY = labelY + 8 + numSize * 0.9;
  const sepY = y + h * 0.55;
  const size = Math.min(30, h * 0.11);
  const rx0 = x + 16;
  // 번호(3자리 기준) 오른쪽에 이름 — 카드 폭이 넉넉할 때만.
  const nameX = rx0 + size * 0.86 + 8 + size * 2.1 + 10;
  const nameW = x + w - 12 - nameX;
  const withName = nameW >= 70;
  const lY = y + h * 0.72;
  const fY = y + h * 0.9;
  return `
    ${glassCard(x, y, w, h)}
    ${label(cx, labelY, 'COUPLE', { size: 11, tracking: 3 })}
    ${goldNumber(cx, numY, pad2(i), numSize)}
    <line x1="${f(x + 16)}" y1="${f(sepY)}" x2="${f(x + w - 16)}" y2="${f(sepY)}" stroke="${WHITE}" stroke-opacity="0.16"/>
    ${roleLine(rx0, lY, 'L', i, size, withName ? { x: nameX, w: nameW, y: lY - 2 } : null)}
    ${roleLine(rx0, fY, 'F', i, size, withName ? { x: nameX, w: nameW, y: fY - 2 } : null)}
  `;
}

function compactCard(i: number, x: number, y: number, w: number, h: number): string {
  const lw = Math.min(88, w * 0.36);
  const lcx = x + 6 + lw / 2;
  const numSize = Math.min(44, h * 0.4, lw * 0.5);
  const labelY = y + (h - numSize * 0.95 - 14) / 2 + 10;
  const divX = x + lw + 12;
  const rx0 = divX + 14;
  const rightW = x + w - 12 - rx0;
  const stack = h >= 130;
  const size = Math.min(26, stack ? h * 0.19 : h * 0.24);
  const lY = y + h * (stack ? 0.33 : 0.45);
  const fY = y + h * (stack ? 0.73 : 0.8);
  const nameLine = (role: Role, baseline: number) =>
    stack
      ? clipBox(rx0, baseline + 4, rightW, 20,
          strong(rx0, baseline + 18, role === 'L' ? `{{leader_${i}}}` : `{{follower_${i}}}`, 12.5, {
            anchor: 'start', fill: SOFT, weight: 700,
          }))
      : '';
  return `
    ${glassCard(x, y, w, h, { rx: 16 })}
    ${label(lcx, labelY, 'COUPLE', { size: Math.min(10, lw / 8.2), tracking: 1.5 })}
    ${goldNumber(lcx, labelY + 6 + numSize * 0.9, pad2(i), numSize)}
    <line x1="${f(divX)}" y1="${f(y + 14)}" x2="${f(divX)}" y2="${f(y + h - 14)}" stroke="${WHITE}" stroke-opacity="0.16"/>
    ${roleLine(rx0, lY, 'L', i, size, null)}
    ${nameLine('L', lY)}
    ${roleLine(rx0, fY, 'F', i, size, null)}
    ${nameLine('F', fY)}
  `;
}

function renderList(pairCount: number): string {
  const count = Math.max(1, Math.min(30, pairCount));
  const { cols, rows } = gridFor(count);
  const availW = RX - MX;
  const availH = BOTTOM - TOP;
  // 커플이 적을 때(1행)도 카드가 화면 높이를 대부분 채우도록 크게 — 대신 너무 길쭉해지지 않게 상한을 둔다.
  const cellW = Math.min(340, (availW - GAP * (cols - 1)) / cols);
  const cellH = Math.min(rows === 1 ? 400 : 999, (availH - GAP * (rows - 1)) / rows);
  const gridH = rows * cellH + GAP * (rows - 1);
  const y0 = TOP + (availH - gridH) / 2;

  let cards = '';
  for (let i = 1; i <= count; i++) {
    const row = Math.floor((i - 1) / cols);
    const col = (i - 1) % cols;
    const inRow = row === rows - 1 ? count - row * cols : cols;
    const rowW = inRow * cellW + GAP * (inRow - 1);
    const x = CX - rowW / 2 + col * (cellW + GAP);
    const y = y0 + row * (cellH + GAP);
    const card = cellH >= 200 ? tallCard(i, x, y, cellW, cellH) : compactCard(i, x, y, cellW, cellH);
    cards += fadeUp(0.15 + i * 0.035, card, 14);
  }

  return shell(`
    ${topBar()}
    ${heading('{{round_title}}', `{{stage_label}}<tspan fill="${GOLD}">  ·  ${count} COUPLES</tspan>`)}
    ${cards}
    ${footBar()}
  `);
}

/** 원형(타원) 배치 — 중앙에 유리 원판 + 커플 수, 둘레에 L/F 번호. */
function renderCircle(pairCount: number): string {
  const count = Math.max(1, Math.min(30, pairCount));
  const L = circlePairingLayout(count, { band: [180, 640], withNames: false, ryScale: 1.3 });
  const fs = L.fontSize;

  const body = L.slots
    .map(
      (s) => `
      <g opacity="0">
        <animate attributeName="opacity" values="0;1" dur="0.4s" begin="${s.delay}s" fill="freeze"/>
        <g transform="translate(${s.x} ${s.y})">
          <text text-anchor="${s.anchor}" y="0" font-family="${DISPLAY}" font-size="${fs}" font-weight="900"
            letter-spacing="0.5" fill="${LEAD}">L{{leader_num_${s.i}}}</text>
          <text text-anchor="${s.anchor}" y="${L.lineH}" font-family="${DISPLAY}" font-size="${fs}" font-weight="900"
            letter-spacing="0.5" fill="${FOLLOW}">F{{follower_num_${s.i}}}</text>
          <line x1="${s.flourishX1}" y1="${s.flourishY}" x2="${s.flourishX2}" y2="${s.flourishY}"
            stroke="${GOLD}" stroke-opacity="0.45" stroke-width="1.2"/>
        </g>
      </g>`
    )
    .join('');

  const r = 86;
  const center = `
    <g opacity="0">
      <animate attributeName="opacity" values="0;1" dur="0.8s" begin="0s" fill="freeze"/>
      <circle cx="${f(L.cx)}" cy="${f(L.cy)}" r="${r + 14}" fill="none" stroke="${GOLD}" stroke-opacity="0.25" stroke-width="1.2">
        <animate attributeName="r" values="${r + 8};${r + 26};${r + 8}" dur="3.2s" repeatCount="indefinite"/>
        <animate attributeName="stroke-opacity" values="0.35;0;0.35" dur="3.2s" repeatCount="indefinite"/>
      </circle>
      <circle cx="${f(L.cx)}" cy="${f(L.cy)}" r="${r}" fill="url(#t07CardFill)" stroke="url(#t07GoldStroke)" stroke-width="2.4"/>
      ${label(L.cx, L.cy - 30, 'COUPLES', { size: 11, tracking: 4 })}
      ${goldNumber(L.cx, L.cy + 30, String(count), 58)}
    </g>`;

  return shell(`
    ${topBar()}
    ${heading('{{round_title}}', '{{stage_label}}')}
    ${center}
    ${body}
    ${footBar()}
  `);
}

export function pickPairingSvg(pairCount: number, pairCircle = false): string {
  return pairCircle ? renderCircle(pairCount) : renderList(pairCount);
}
