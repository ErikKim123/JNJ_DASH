// Template 10 — 결승 전용 화면 (Prep / Wrapup / Result / Pairing).
import { prepSvg } from './prep';
import { wrapupSvg } from './wrapup';
import {
  shell, topBar, footBar, heading, waveCard, label, accentNumber, strong, rolePill, rankMark, photoFrame,
  clipBox, sparkle, accentRule, fadeUp,
  SOFT, ACCENT, FRAME, CX, MX, RX, f, type Role,
} from '../common';

export const finalPrepSvg = (withEntries = true): string => prepSvg(true, withEntries);
export const finalWrapupSvg = (): string => wrapupSvg(true);

// ── 결승 RESULT — 1·2·3위 발표(reveal) ──────────────────────────────────────
// 발표 전에는 각 자리에 "?" 가 맥박처럼 뛰는 빈 카드가 서 있고, 발표되면 실제 카드가
// 튀어 오르며(pop) 강조색 섬광과 함께 덮는다. TemplateRenderer 가 [data-reveal-id] 에
// .revealed / .reveal-anim 을 붙인다 (id 순서는 lib/display/reveal.ts).
const REVEAL_STYLE = `
  <style>
    svg.t07 .jnj-reveal { opacity: 0; transform-box: fill-box; transform-origin: center; }
    svg.t07 .jnj-reveal.revealed { opacity: 1; }
    svg.t07 .jnj-reveal.reveal-anim {
      will-change: transform, opacity, filter;
      animation: t07-pop 900ms cubic-bezier(0.2, 0.9, 0.25, 1.1) forwards,
                 t07-flash 1500ms ease-out forwards;
    }
    svg.t07 .t07-mystery { transition: opacity 0.3s ease; }
    svg.t07 .t07-seat:has(.jnj-reveal.revealed) .t07-mystery { opacity: 0; }
    @keyframes t07-pop {
      0%   { opacity: 0; transform: translateY(46px) scale(0.8); }
      55%  { opacity: 1; transform: translateY(-10px) scale(1.05); }
      100% { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes t07-flash {
      0%   { filter: brightness(2) drop-shadow(0 0 0 rgba(255, 201, 60, 0)); }
      30%  { filter: brightness(1.3) drop-shadow(0 0 26px rgba(255, 201, 60, 0.8)); }
      100% { filter: brightness(1) drop-shadow(0 0 0 rgba(255, 201, 60, 0)); }
    }
  </style>
`;

interface Seat {
  rank: 1 | 2 | 3;
  dx: number;
  y: number;
  w: number;
  h: number;
}

// 한 역할 패널(폭 600) 안의 시상대 — 2위(좌) · 1위(중앙, 더 크고 높음) · 3위(우).
const SEATS: readonly Seat[] = [
  { rank: 2, dx: 6, y: 244, w: 176, h: 396 },
  { rank: 1, dx: 194, y: 204, w: 212, h: 436 },
  { rank: 3, dx: 418, y: 244, w: 176, h: 396 },
];

const PLACE: Record<1 | 2 | 3, string> = { 1: 'CHAMPION', 2: '2ND PLACE', 3: '3RD PLACE' };

function seat(side: Role, x0: number, s: Seat): string {
  const prefix = side === 'L' ? 'champ_leader' : 'champ_follower';
  const { rank, w, h, y } = s;
  const x = x0 + s.dx;
  const cx = x + w / 2;
  const big = rank === 1;
  const rankSize = big ? 54 : 42;
  const rankY = y + (big ? 62 : 52);
  const photoY = y + (big ? 78 : 66);
  const pw = w - 28;
  const ph = big ? 206 : 176;
  const labelY = photoY + ph + 24;
  const numSize = big ? 38 : 32;
  const numY = labelY + numSize + 4;
  const nameSize = big ? 20 : 17;
  const n1Y = numY + nameSize + 12;
  const n2Y = n1Y + nameSize + 4;

  const mystery = `
    <g class="t07-mystery">
      ${waveCard(x, y, w, h)}
      <rect x="${f(x + 14)}" y="${f(photoY)}" width="${f(pw)}" height="${f(ph)}" rx="10" fill="none"
        stroke="${ACCENT}" stroke-opacity="0.3" stroke-width="1.5" stroke-dasharray="7 7"/>
      <text class="num" x="${f(cx)}" y="${f(photoY + ph / 2 + (big ? 38 : 31))}" text-anchor="middle"
        font-family="'Montserrat', 'Arial Black', sans-serif" font-weight="900" font-size="${big ? 108 : 88}" fill="url(#t10AccentNum)" opacity="0.45">?<animate
          attributeName="opacity" values="0.22;0.62;0.22" dur="2.4s" begin="${(rank * 0.4).toFixed(1)}s" repeatCount="indefinite"/></text>
      ${label(cx, rankY - 8, PLACE[rank], { size: big ? 12 : 11, tracking: 3, fill: SOFT })}
    </g>`;

  const card = `
    <g class="jnj-reveal" data-reveal-id="${side}-${rank}">
      ${waveCard(x, y, w, h, { hero: big })}
      ${rankMark(cx, rankY, rank, rankSize)}
      ${photoFrame(x + 14, photoY, pw, ph, `{{${prefix}_photo_${rank}}}`, { ring: big ? ACCENT : FRAME, ringW: big ? 3 : 2.4 })}
      ${label(cx, labelY, PLACE[rank], { size: big ? 12 : 11, tracking: 3, fill: big ? ACCENT : SOFT })}
      ${accentNumber(cx, numY, `{{${prefix}_num_${rank}}}`, numSize)}
      ${clipBox(x + 10, n1Y - nameSize - 4, w - 20, n2Y - n1Y + nameSize + 12, `
        ${strong(cx, n1Y, `{{${prefix}_${rank}_l1}}`, nameSize, { fit: w - 22, fitMin: 0.7 })}
        ${strong(cx, n2Y, `{{${prefix}_${rank}_l2}}`, nameSize, { fit: w - 22, fitMin: 0.7 })}
      `)}
    </g>`;

  return `<g class="t07-seat">${mystery}${card}</g>`;
}

function podiumPanel(side: Role, x0: number, labelKey: string): string {
  return `
    ${rolePill(x0 + 300, 178, labelKey, side, { w: 212, h: 30, size: 14, tracking: 5 })}
    ${SEATS.map((s) => seat(side, x0, s)).join('')}
  `;
}

export function finalResultSvg(): string {
  return shell(`
    ${REVEAL_STYLE}
    ${topBar()}
    ${heading('{{result_title}}', '{{result_subtitle}}', { titleY: 116, subY: 146, size: 38 })}
    ${podiumPanel('L', MX, '{{label_leader}}')}
    ${podiumPanel('F', RX - 600, '{{label_follower}}')}
    <rect x="${CX - 0.75}" y="220" width="1.5" height="410" fill="url(#t10RuleV)"/>
    ${footBar()}
  `);
}

// ── 결승 PAIRING — 심사위원 + 결승 진출자 인비테이셔널 무대 ────────────────────
// 대형 제목 뒤로 무대 조명이 돌고, 아래에는 아직 이름이 붙지 않은 실루엣 카드가 줄지어
// 레퍼런스의 "참가자 카드 격자"를 예고한다.
const TWINKLES: ReadonlyArray<readonly [number, number, number]> = [
  [236, 250, 11], [1046, 236, 13], [168, 402, 8], [1112, 410, 9], [402, 206, 7], [884, 446, 8],
];

export function finalPairingSvg(): string {
  const n = 8;
  const w = 132;
  const gap = 14;
  const h = 150;
  const y = 486;
  const x0 = CX - (n * w + (n - 1) * gap) / 2;

  let cards = '';
  for (let i = 0; i < n; i++) {
    const x = x0 + i * (w + gap);
    cards += fadeUp(0.5 + i * 0.08, `
      ${waveCard(x, y, w, h, { rx: 16 })}
      ${photoFrame(x + 14, y + 14, w - 28, h - 56, '', { rx: 8, ringW: 1.8 })}
      ${sparkle(x + w / 2, y + h - 21, 9)}
    `);
  }

  const twinkles = TWINKLES.map(
    ([tx, ty, r], i) => `
      <g opacity="0">
        <animate attributeName="opacity" values="0;1;0" dur="2.8s" begin="${(i * 0.45).toFixed(2)}s" repeatCount="indefinite"/>
        ${sparkle(tx, ty, r)}
      </g>`
  ).join('');

  return shell(`
    ${topBar()}
    ${twinkles}
    ${label(CX + 7, 196, 'INVITATIONAL', { size: 16, tracking: 14 })}
    ${strong(CX, 330, '{{round_title}}', 88, { cls: 'hero', weight: 900, tracking: 3, fit: 1180 })}
    ${accentRule(372, 260)}
    ${strong(CX, 424, 'Where the judges share the floor with the finalists', 19, { fill: SOFT, weight: 600, tracking: 1 })}
    ${cards}
    ${footBar()}
  `);
}
