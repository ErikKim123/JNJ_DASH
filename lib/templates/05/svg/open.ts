// Template 05 — OPEN.
// 좌: "NOW / OPEN" 대형 워드마크. 우: 천천히 도는 링 + 맥동하는 점 (진행 중이라는 신호).
// 04 의 원형 배지 대신, 글자 자체를 그래픽으로 쓰는 포스터형 구성.
import { shell, topBar, footBar, accentBar, rule, metaLabel, DISPLAY, BODY, PAPER, DIM, ACCENT, MX } from '../common';

function ring(cx: number, cy: number): string {
  // 점선 링 2겹이 서로 반대 방향으로 아주 느리게 회전 — 시선을 뺏지 않는 배경 모션.
  return `
    <g transform="translate(${cx} ${cy})">
      <circle r="196" fill="url(#halo)"/>
      <g fill="none" stroke="${ACCENT}" stroke-opacity="0.55">
        <circle r="158" stroke-width="1" stroke-dasharray="2 12">
          <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="70s" repeatCount="indefinite"/>
        </circle>
        <circle r="132" stroke-width="1.6" stroke-dasharray="46 26" stroke-opacity="0.35">
          <animateTransform attributeName="transform" type="rotate" from="360" to="0" dur="48s" repeatCount="indefinite"/>
        </circle>
      </g>
      <circle r="7" fill="${ACCENT}">
        <animate attributeName="r" values="6;10;6" dur="2.4s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="1;0.45;1" dur="2.4s" repeatCount="indefinite"/>
      </circle>
      <circle r="112" fill="none" stroke="${PAPER}" stroke-width="0.6" stroke-opacity="0.16"/>
    </g>
  `;
}

export function openSvg(): string {
  return shell(`
    ${topBar()}

    ${ring(946, 372)}

    ${accentBar(196, 218)}

    ${metaLabel(MX + 26, 224, 'NOW', { size: 15, tracking: 12 })}

    <text x="${MX + 22}" y="${338}" font-family="${DISPLAY}" font-weight="700" font-size="132"
      letter-spacing="6" fill="${ACCENT}">OPEN</text>

    <text x="${MX + 26}" y="${390}" font-family="${DISPLAY}" font-weight="500" font-size="34"
      letter-spacing="7" fill="${PAPER}">{{round_title}}</text>

    ${rule(432, MX + 24, MX + 360, 0.35, ACCENT)}

    <text x="${MX + 26}" y="${482}" font-family="${BODY}" font-weight="300" font-size="23"
      letter-spacing="2.5" fill="${PAPER}">{{open_quote}}</text>

    ${metaLabel(MX + 26, 520, '{{open_subline}}', { size: 13, tracking: 5, fill: DIM })}

    ${footBar()}
  `);
}
