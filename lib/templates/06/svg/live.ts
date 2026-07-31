// Template 06 — LIVE.
// 밝은 지면 위에서 "지금 진행 중"을 알리는 유일한 채도 높은 색 = 테라코타.
// 점멸 도트 + 좌우로 퍼지는 얇은 파문만으로 상태를 표현하고, 나머지는 전부 정적이라
// 화면이 시끄러워지지 않는다.
import { shell, topBar, footBar, ornament, metaLabel, DISPLAY, BODY, MONO, INK, INK_SOFT, ACCENT, ROSE, CX } from '../common';

function liveMark(cx: number, cy: number): string {
  return `
    <g transform="translate(${cx} ${cy})">
      <rect x="-58" y="-17" width="116" height="34" rx="17" fill="${ROSE}"/>
      <circle cx="-36" cy="0" r="5.5" fill="#FFF">
        <animate attributeName="opacity" values="1;0.25;1" dur="1.2s" repeatCount="indefinite"/>
      </circle>
      <text x="-22" y="6" font-family="${MONO}" font-size="14" font-weight="700" letter-spacing="4" fill="#FFF">LIVE</text>
    </g>
  `;
}

function ripples(cy: number): string {
  // 중심에서 좌우로 벌어지는 얇은 선 — 무대 위 소리가 퍼지는 은유.
  return [0, 1, 2]
    .map(
      (i) => `
      <g opacity="0.55">
        <line x1="${CX}" y1="${cy}" x2="${CX}" y2="${cy}" stroke="${ACCENT}" stroke-width="1">
          <animate attributeName="x1" values="${CX};${CX - 300}" dur="3s" begin="${i * 1}s" repeatCount="indefinite"/>
          <animate attributeName="x2" values="${CX};${CX + 300}" dur="3s" begin="${i * 1}s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.8;0" dur="3s" begin="${i * 1}s" repeatCount="indefinite"/>
        </line>
      </g>`
    )
    .join('');
}

export function liveSvg(): string {
  return shell(`
    ${topBar()}

    ${liveMark(CX, 196)}
    ${metaLabel(CX, 244, '{{stage_label}} · {{round_title}}', { size: 12, tracking: 6, fill: INK_SOFT })}

    <text x="${CX}" y="${378}" text-anchor="middle" font-family="${DISPLAY}" font-weight="700"
      font-size="86" letter-spacing="8" fill="${INK}">ON STAGE</text>

    ${ripples(414)}
    ${ornament(452, 210)}

    <text x="${CX}" y="${512}" text-anchor="middle" font-family="${BODY}" font-weight="300"
      font-size="24" letter-spacing="4" fill="${ROSE}">{{live_message}}</text>

    ${footBar()}
  `);
}
