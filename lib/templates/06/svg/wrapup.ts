// Template 06 — WRAPUP (집계 중).
// 대기 화면 — 중앙 축에 제목/부제를 두고, 그 아래 얇은 인디케이터 선과 순차 도트로
// "멈춘 게 아니라 진행 중"임을 알린다.
import { shell, topBar, footBar, ornament, metaLabel, DISPLAY, BODY, INK, INK_SOFT, ACCENT, CX, MX, RX } from '../common';

function indicator(y: number): string {
  return `
    <g>
      <line x1="${MX + 120}" y1="${y}" x2="${RX - 120}" y2="${y}" stroke="${INK}" stroke-opacity="0.12" stroke-width="2"/>
      <line x1="${MX + 120}" y1="${y}" x2="${MX + 320}" y2="${y}" stroke="${ACCENT}" stroke-width="2" stroke-linecap="round">
        <animate attributeName="x1" values="${MX + 120};${RX - 320};${MX + 120}" dur="4.4s" repeatCount="indefinite"/>
        <animate attributeName="x2" values="${MX + 320};${RX - 120};${MX + 320}" dur="4.4s" repeatCount="indefinite"/>
      </line>
    </g>
  `;
}

function dots(y: number): string {
  return [-1, 0, 1]
    .map(
      (i, n) => `<circle cx="${CX + i * 24}" cy="${y}" r="4.5" fill="${ACCENT}">
        <animate attributeName="opacity" values="0.2;1;0.2" dur="1.5s" begin="${(n * 0.22).toFixed(2)}s" repeatCount="indefinite"/>
      </circle>`
    )
    .join('');
}

export function wrapupSvg(): string {
  return shell(`
    ${topBar()}

    ${metaLabel(CX, 212, '{{stage_label}}', { size: 14, tracking: 12 })}

    <text x="${CX}" y="${320}" text-anchor="middle" font-family="${DISPLAY}" font-weight="700"
      font-size="70" letter-spacing="4" fill="${INK}">{{wrap_title}}</text>

    <text x="${CX}" y="${366}" text-anchor="middle" font-family="${BODY}" font-weight="300"
      font-size="23" letter-spacing="10" fill="${INK_SOFT}">{{wrap_subtitle}}</text>

    ${ornament(410, 200)}
    ${indicator(462)}
    ${dots(506)}

    ${metaLabel(CX, 548, '{{wrap_message}}', { size: 13, tracking: 5, fill: INK_SOFT })}

    ${footBar()}
  `);
}
