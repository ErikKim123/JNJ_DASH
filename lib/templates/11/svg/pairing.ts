// Template 11 — PAIRING.
// 레퍼런스 화면을 가장 직접적으로 옮긴 스텝 — 커플 한 쌍 = 유리 카드 한 장, 5열 격자가 화면을 채운다.
//   · 카드 크기에 따라 두 가지 구성:
//       tall    (행 ≤ 2) : COUPLE 라벨 → 큰 강조 순번 → 구분선 → [L 번호 / 이름] [F 번호 / 이름]
//       compact (행 ≥ 3) : 좌측 [라벨 + 순번] | 우측 [L 번호 / F 번호] (행 높이가 넉넉하면 이름까지)
//   · 이름은 번호 "아래" 줄에 카드 폭 전체를 쓰게 둔다 — 번호 옆에 두면 폭이 절반으로 줄어 긴 이름이
//     읽을 수 없을 만큼 작아진다. 그래도 넘치면 읽히는 크기에서 말줄임(fit.ts).
//   · 마지막 행이 덜 차면 가운데로 모은다.
import {
  shell, topBar, footBar, heading, panelCard, label, accentNumber, strong, roleChip, fadeUp, clipBox,
  DISPLAY, WHITE, SOFT, ACCENT, LEAD, FOLLOW, CX, MX, RX, f, pad2, type Role,
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

const numKey = (role: Role, i: number) => (role === 'L' ? `{{leader_num_${i}}}` : `{{follower_num_${i}}}`);
const nameKey = (role: Role, i: number) => (role === 'L' ? `{{leader_${i}}}` : `{{follower_${i}}}`);

/** [칩] 번호 — 한 줄. */
function numberLine(x: number, baseline: number, role: Role, i: number, size: number): string {
  return `
    ${roleChip(x, baseline, role, size)}
    ${strong(x + size * 0.86 + 8, baseline, numKey(role, i), size, { anchor: 'start', weight: 900, tracking: 0.5 })}
  `;
}

/** 번호 아래 이름 줄 — 넘치면 줄이고, 그래도 넘치면 말줄임. */
function nameLine(x: number, baseline: number, w: number, role: Role, i: number, size: number): string {
  return clipBox(x, baseline - size - 3, w, size + 9,
    strong(x, baseline, nameKey(role, i), size, {
      anchor: 'start', fill: SOFT, weight: 700, fit: w, fitMin: 0.82, ellipsis: true,
    }));
}

function tallCard(i: number, x: number, y: number, w: number, h: number): string {
  const cx = x + w / 2;
  const numSize = Math.min(96, h * 0.25, w * 0.3);
  const labelY = y + h * 0.13;
  const numY = labelY + 6 + numSize * 0.9;
  const sepY = y + h * 0.475;
  const size = Math.min(30, h * 0.1);
  const nameSize = Math.min(15, Math.max(12, h * 0.055));
  const rx0 = x + 16;
  const innerW = w - 32;
  const lY = y + h * 0.61;
  const fY = y + h * 0.84;
  const nameGap = nameSize + 9;
  return `
    ${panelCard(x, y, w, h)}
    ${label(cx, labelY, 'COUPLE', { size: 11, tracking: 3 })}
    ${accentNumber(cx, numY, pad2(i), numSize)}
    <line x1="${f(x + 16)}" y1="${f(sepY)}" x2="${f(x + w - 16)}" y2="${f(sepY)}" stroke="${WHITE}" stroke-opacity="0.16"/>
    ${numberLine(rx0, lY, 'L', i, size)}
    ${nameLine(rx0, lY + nameGap, innerW, 'L', i, nameSize)}
    ${numberLine(rx0, fY, 'F', i, size)}
    ${nameLine(rx0, fY + nameGap, innerW, 'F', i, nameSize)}
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
  return `
    ${panelCard(x, y, w, h, { rx: 16 })}
    ${label(lcx, labelY, 'COUPLE', { size: Math.min(10, lw / 8.2), tracking: 1.5 })}
    ${accentNumber(lcx, labelY + 6 + numSize * 0.9, pad2(i), numSize)}
    <line x1="${f(divX)}" y1="${f(y + 14)}" x2="${f(divX)}" y2="${f(y + h - 14)}" stroke="${WHITE}" stroke-opacity="0.16"/>
    ${numberLine(rx0, lY, 'L', i, size)}
    ${stack ? nameLine(rx0, lY + 18, rightW, 'L', i, 12.5) : ''}
    ${numberLine(rx0, fY, 'F', i, size)}
    ${stack ? nameLine(rx0, fY + 18, rightW, 'F', i, 12.5) : ''}
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
    ${heading('{{round_title}}', `{{stage_label}}<tspan fill="${ACCENT}">  ·  ${count} COUPLES</tspan>`)}
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
            stroke="${ACCENT}" stroke-opacity="0.45" stroke-width="1.2"/>
        </g>
      </g>`
    )
    .join('');

  const r = 86;
  const center = `
    <g opacity="0">
      <animate attributeName="opacity" values="0;1" dur="0.8s" begin="0s" fill="freeze"/>
      <circle cx="${f(L.cx)}" cy="${f(L.cy)}" r="${r + 14}" fill="none" stroke="${ACCENT}" stroke-opacity="0.25" stroke-width="1.2">
        <animate attributeName="r" values="${r + 8};${r + 26};${r + 8}" dur="3.2s" repeatCount="indefinite"/>
        <animate attributeName="stroke-opacity" values="0.35;0;0.35" dur="3.2s" repeatCount="indefinite"/>
      </circle>
      <circle cx="${f(L.cx)}" cy="${f(L.cy)}" r="${r}" fill="url(#t11CardFill)" stroke="url(#t11AccentStroke)" stroke-width="2.4"/>
      ${label(L.cx, L.cy - 30, 'COUPLES', { size: 11, tracking: 4 })}
      ${accentNumber(L.cx, L.cy + 30, String(count), 58)}
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
