// Template 05 — CLOSE (라운드 종료).
// 완료 상태 = 체크 마크 하나. 04 의 다중 링 대신 선 하나로 그리는 미니멀 체크를
// 우측 여백에 크게 배치하고, 좌측에는 종료 문구를 계층대로 쌓는다.
import { shell, topBar, footBar, accentBar, rule, metaLabel, DISPLAY, BODY, PAPER, DIM, ACCENT, MX } from '../common';

function checkMark(cx: number, cy: number, scale = 1): string {
  return `
    <g transform="translate(${cx} ${cy}) scale(${scale})">
      <circle r="150" fill="url(#halo)"/>
      <circle r="118" fill="none" stroke="${ACCENT}" stroke-width="1.2" stroke-opacity="0.45"/>
      <circle r="104" fill="#0B0B10" fill-opacity="0.4"/>
      <path d="M -46 4 L -14 40 L 50 -38" fill="none" stroke="${ACCENT}" stroke-width="9"
        stroke-linecap="round" stroke-linejoin="round" pathLength="100"
        stroke-dasharray="100" stroke-dashoffset="100">
        <animate attributeName="stroke-dashoffset" from="100" to="0" dur="0.9s" begin="0.2s" fill="freeze"/>
      </path>
    </g>
  `;
}

export function closeSvg(): string {
  return shell(`
    ${topBar()}

    ${checkMark(958, 372)}

    ${accentBar(214, 172)}

    ${metaLabel(MX + 26, 240, '{{stage_label}}', { size: 14, tracking: 9 })}

    <text x="${MX + 24}" y="${330}" font-family="${DISPLAY}" font-weight="600" font-size="84"
      letter-spacing="2" fill="${PAPER}">{{close_title}}</text>

    ${rule(362, MX + 24, MX + 380, 0.4, ACCENT)}

    <text x="${MX + 26}" y="${408}" font-family="${BODY}" font-weight="300" font-size="24"
      letter-spacing="7" fill="${DIM}">{{close_subtitle}}</text>

    <text x="${MX + 26}" y="${452}" font-family="${BODY}" font-weight="300" font-size="18"
      letter-spacing="3" fill="${ACCENT}" opacity="0.9">{{close_message}}</text>

    ${footBar()}
  `);
}
