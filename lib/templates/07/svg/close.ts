// Template 07 — CLOSE (라운드 종료).
// 금테 유리 원판 안에 체크가 그려지고, 원판 바깥으로 금빛 링이 퍼져 나간다.
// 아래 무대 띠에 종료 제목·부제·메시지.
import { shell, topBar, footBar, stageBand, label, strong, SOFT, GOLD, WHITE, CX, f } from '../common';

function seal(cx: number, cy: number): string {
  const r = 82;
  const rings = [0, 1.2]
    .map(
      (b) => `
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${GOLD}" stroke-width="2">
        <animate attributeName="r" values="${r};${r + 44}" dur="2.4s" begin="${b}s" repeatCount="indefinite"/>
        <animate attributeName="stroke-opacity" values="0.6;0" dur="2.4s" begin="${b}s" repeatCount="indefinite"/>
      </circle>`
    )
    .join('');
  return `
    <g>
      ${rings}
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#t07CardFill)" stroke="url(#t07GoldStroke)" stroke-width="3"/>
      <circle cx="${cx}" cy="${cy}" r="${r - 10}" fill="none" stroke="${WHITE}" stroke-opacity="0.16"/>
      <path d="M ${f(cx - 34)} ${f(cy + 2)} L ${f(cx - 10)} ${f(cy + 27)} L ${f(cx + 38)} ${f(cy - 26)}" fill="none"
        stroke="url(#t07GoldNum)" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"
        pathLength="100" stroke-dasharray="100" stroke-dashoffset="100">
        <animate attributeName="stroke-dashoffset" from="100" to="0" dur="0.8s" begin="0.3s" fill="freeze"/>
      </path>
    </g>`;
}

export function closeSvg(): string {
  return shell(`
    ${topBar()}

    ${label(CX + 5, 172, '{{stage_label}}', { size: 15, tracking: 10 })}
    ${seal(CX, 286)}

    ${stageBand(392, 212)}
    ${strong(CX, 470, '{{close_title}}', 62, { cls: 'hero', weight: 900, tracking: 2 })}
    ${strong(CX + 4, 514, '{{close_subtitle}}', 20, { fill: SOFT, tracking: 8 })}
    ${label(CX, 566, '{{close_message}}', { size: 16, tracking: 3 })}

    ${footBar()}
  `);
}
