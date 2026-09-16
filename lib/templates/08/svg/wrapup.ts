// Template 08 — WRAPUP (집계 중). final=true 면 결승 변형(무대 조명 + 강조 띠).
// 무대 띠 안에 슬롯머신처럼 굴러가는 강조 숫자 릴 7개 — "점수를 계산하는 중"을 글자 없이 보여준다.
// 릴마다 속도·시작 위치가 달라 기계적으로 똑같이 돌지 않는다.
import {
  shell, topBar, footBar, stageBand, neonCard, label, strong, clipBox, seeded,
  DISPLAY, SOFT, ACCENT, CX, MX, RX, f,
} from '../common';

const REEL_DEFS = `
  <defs>
    <linearGradient id="t08ReelFade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#081A4A" stop-opacity="1"/>
      <stop offset="0.14" stop-color="#081A4A" stop-opacity="0.85"/>
      <stop offset="0.38" stop-color="#081A4A" stop-opacity="0"/>
      <stop offset="0.62" stop-color="#081A4A" stop-opacity="0"/>
      <stop offset="0.86" stop-color="#081A4A" stop-opacity="0.85"/>
      <stop offset="1" stop-color="#081A4A" stop-opacity="1"/>
    </linearGradient>
  </defs>
`;

function reel(x: number, y: number, w: number, h: number, idx: number, gold: boolean): string {
  const cx = x + w / 2;
  const size = h * 0.6;
  const step = size * 1.25;
  const base = y + h / 2 + size * 0.35;
  let digits = '';
  for (let k = 0; k <= 10; k++) {
    digits += `<text x="${f(cx)}" y="${f(base + k * step)}" text-anchor="middle" font-family="${DISPLAY}" font-weight="900"
      font-size="${f(size)}" fill="url(#t08AccentNum)">${k % 10}</text>`;
  }
  const dur = (0.9 + seeded(idx + 3) * 0.9).toFixed(2);
  const start = (seeded(idx + 11) * 2).toFixed(2);
  const strip = `
    <g>
      <animateTransform attributeName="transform" type="translate" values="0 0;0 ${f(-10 * step)}"
        dur="${dur}s" begin="-${start}s" repeatCount="indefinite"/>
      ${digits}
    </g>`;
  return `
    ${neonCard(x, y, w, h, { rx: 16, hero: gold })}
    ${clipBox(x + 3, y + 3, w - 6, h - 6, strip)}
    <rect x="${f(x + 3)}" y="${f(y + 3)}" width="${f(w - 6)}" height="${f(h - 6)}" rx="13" fill="url(#t08ReelFade)"/>
    <line x1="${f(x + 12)}" y1="${f(y + h * 0.2)}" x2="${f(x + w - 12)}" y2="${f(y + h * 0.2)}" stroke="${ACCENT}" stroke-opacity="0.3"/>
    <line x1="${f(x + 12)}" y1="${f(y + h * 0.8)}" x2="${f(x + w - 12)}" y2="${f(y + h * 0.8)}" stroke="${ACCENT}" stroke-opacity="0.3"/>
  `;
}

function progress(y: number): string {
  const x1 = MX + 72;
  const x2 = RX - 72;
  const seg = 220;
  return `
    <rect x="${x1}" y="${y - 4}" width="${x2 - x1}" height="8" rx="4" fill="#FFFFFF" fill-opacity="0.12"/>
    <rect x="${x1}" y="${y - 4}" width="${seg}" height="8" rx="4" fill="${ACCENT}">
      <animate attributeName="x" values="${x1};${x2 - seg};${x1}" dur="4.4s" repeatCount="indefinite"
        calcMode="spline" keyTimes="0;0.5;1" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
    </rect>
  `;
}

export function wrapupSvg(final = false): string {
  const n = 7;
  const w = 132;
  const gap = 18;
  const h = 158;
  const y = 346;
  const x0 = CX - (n * w + (n - 1) * gap) / 2;
  let reels = '';
  for (let i = 0; i < n; i++) reels += reel(x0 + i * (w + gap), y, w, h, i, final);

  return shell(`
    ${REEL_DEFS}
    ${topBar()}

    ${label(CX + 4, 182, '{{stage_label}}', { size: 15, tracking: 8, fit: 1100 })}
    ${strong(CX, 262, '{{wrap_title}}', 72, { cls: 'hero', weight: 900, tracking: 2, fit: 1180 })}
    ${strong(CX + 3, 302, '{{wrap_subtitle}}', 20, { fill: SOFT, tracking: 7, fit: 1180 })}

    ${stageBand(328, 194, final)}
    ${reels}

    ${progress(558)}
    ${strong(CX, 606, '{{wrap_message}}', 15, { fill: SOFT, weight: 700, tracking: 4, fit: 1180 })}

    ${footBar()}
  `);
}
