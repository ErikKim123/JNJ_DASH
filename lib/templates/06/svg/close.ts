// Template 06 — CLOSE (라운드 종료).
// 얇은 원 안에 그려지는 체크 — 선이 그려지는 애니메이션 자체가 "완료"의 신호.
import { shell, topBar, footBar, ornament, metaLabel, DISPLAY, BODY, INK, INK_SOFT, ACCENT, PLATE, CX } from '../common';

function sealCheck(cx: number, cy: number): string {
  return `
    <g transform="translate(${cx} ${cy})">
      <circle r="86" fill="url(#glow)"/>
      <circle r="62" fill="${PLATE}" fill-opacity="0.72" stroke="${ACCENT}" stroke-width="1.2"/>
      <circle r="54" fill="none" stroke="${ACCENT}" stroke-width="0.6" opacity="0.45"/>
      <path d="M -25 2 L -8 21 L 27 -20" fill="none" stroke="${ACCENT}" stroke-width="5"
        stroke-linecap="round" stroke-linejoin="round" pathLength="100"
        stroke-dasharray="100" stroke-dashoffset="100">
        <animate attributeName="stroke-dashoffset" from="100" to="0" dur="0.9s" begin="0.25s" fill="freeze"/>
      </path>
    </g>
  `;
}

export function closeSvg(): string {
  return shell(`
    ${topBar()}

    ${metaLabel(CX, 194, '{{stage_label}}', { size: 14, tracking: 12 })}

    ${sealCheck(CX, 292)}

    <text x="${CX}" y="${434}" text-anchor="middle" font-family="${DISPLAY}" font-weight="700"
      font-size="62" letter-spacing="5" fill="${INK}">{{close_title}}</text>

    ${ornament(470, 200)}

    <text x="${CX}" y="${514}" text-anchor="middle" font-family="${BODY}" font-weight="300"
      font-size="22" letter-spacing="8" fill="${INK_SOFT}">{{close_subtitle}}</text>

    ${metaLabel(CX, 550, '{{close_message}}', { size: 13, tracking: 4, fill: ACCENT })}

    ${footBar()}
  `);
}
