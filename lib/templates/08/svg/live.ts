// Template 08 — LIVE.
// 빨간 LIVE 뱃지(퍼지는 링) → 초대형 "ON STAGE" → 무대 띠 안에서 음악에 맞춰 튀는 이퀄라이저.
// 막대는 가운데가 높은 종 모양 envelope 를 따라 움직여 화면이 소란스럽지 않고 리듬감만 남는다.
import { shell, topBar, footBar, stageBand, strong, seeded, SOFT, ACCENT, WHITE, CX, f, DISPLAY } from '../common';

function liveBadge(cx: number, cy: number): string {
  const w = 176;
  const h = 50;
  const x = cx - w / 2;
  const y = cy - h / 2;
  return `
    <g>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="none" stroke="#FF4F7E" stroke-width="2">
        <animate attributeName="x" values="${x};${x - 16}" dur="1.6s" repeatCount="indefinite"/>
        <animate attributeName="y" values="${y};${y - 12}" dur="1.6s" repeatCount="indefinite"/>
        <animate attributeName="width" values="${w};${w + 32}" dur="1.6s" repeatCount="indefinite"/>
        <animate attributeName="height" values="${h};${h + 24}" dur="1.6s" repeatCount="indefinite"/>
        <animate attributeName="rx" values="${h / 2};${h / 2 + 12}" dur="1.6s" repeatCount="indefinite"/>
        <animate attributeName="stroke-opacity" values="0.85;0" dur="1.6s" repeatCount="indefinite"/>
      </rect>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="url(#t08LiveRed)"/>
      <circle cx="${cx - 50}" cy="${cy}" r="7" fill="${WHITE}">
        <animate attributeName="opacity" values="1;0.25;1" dur="1.2s" repeatCount="indefinite"/>
      </circle>
      <text x="${cx + 16}" y="${cy + 8}" text-anchor="middle" font-family="${DISPLAY}" font-weight="900" font-size="22"
        letter-spacing="5" fill="${WHITE}">LIVE</text>
    </g>`;
}

function equalizer(cx: number, base: number, maxH: number): string {
  const N = 56;
  const bw = 12;
  const gap = 8;
  const x0 = cx - (N * (bw + gap) - gap) / 2;
  let bars = '';
  for (let i = 0; i < N; i++) {
    const env = 0.35 + 0.65 * Math.sin((Math.PI * (i + 0.5)) / N);
    const hs = [seeded(i + 1), seeded(i + 101), seeded(i + 201)].map((r) => 8 + r * (maxH - 8) * env);
    const vals = [hs[0], hs[1], hs[2], hs[0]];
    const dur = (0.9 + seeded(i + 301) * 0.8).toFixed(2);
    const x = x0 + i * (bw + gap);
    bars += `
      <rect x="${f(x)}" y="${f(base - vals[0])}" width="${bw}" height="${f(vals[0])}" rx="3" fill="url(#t08Eq)">
        <animate attributeName="height" values="${vals.map(f).join(';')}" dur="${dur}s" repeatCount="indefinite"/>
        <animate attributeName="y" values="${vals.map((v) => f(base - v)).join(';')}" dur="${dur}s" repeatCount="indefinite"/>
      </rect>`;
  }
  return `
    <g>${bars}</g>
    <line x1="${f(x0 - 12)}" y1="${base + 6}" x2="${f(cx + (cx - x0) + 12)}" y2="${base + 6}" stroke="${WHITE}" stroke-opacity="0.18" stroke-width="1.5"/>
  `;
}

export function liveSvg(): string {
  return shell(`
    ${topBar()}

    ${liveBadge(CX, 176)}
    ${strong(CX + 2, 238, '{{stage_label}}', 18, { fill: SOFT, tracking: 5, fit: 1100 })}
    ${strong(CX + 3, 370, 'ON STAGE', 118, { cls: 'hero', weight: 900, tracking: 6 })}

    ${stageBand(406, 166)}
    ${equalizer(CX, 544, 104)}

    ${strong(CX, 618, '{{live_message}}', 22, { fill: ACCENT, tracking: 3, fit: 1180 })}

    ${footBar()}
  `);
}
