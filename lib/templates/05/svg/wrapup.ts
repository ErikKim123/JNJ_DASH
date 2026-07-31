// Template 05 — WRAPUP (집계 중).
// "기다리는 화면"이므로 진행 중임을 나타내는 장치가 핵심 — 좌우로 흐르는 인디케이터 바 +
// 순차 점멸 도트. 장식 도형 대신 선 하나로 상태를 표현해 다른 화면과 톤을 맞춘다.
import { shell, topBar, footBar, accentBar, rule, metaLabel, DISPLAY, BODY, PAPER, DIM, ACCENT, MX, RX } from '../common';

function progressBar(y: number): string {
  const w = RX - MX;
  return `
    <g>
      <rect x="${MX}" y="${y}" width="${w}" height="3" fill="${PAPER}" opacity="0.12"/>
      <rect x="${MX}" y="${y}" width="240" height="3" fill="url(#accentH)">
        <animate attributeName="x" values="${MX};${RX - 240};${MX}" dur="4.2s" repeatCount="indefinite"/>
      </rect>
    </g>
  `;
}

function dots(x: number, y: number): string {
  return [0, 1, 2]
    .map(
      (i) => `<circle cx="${x + i * 22}" cy="${y}" r="4.5" fill="${ACCENT}">
        <animate attributeName="opacity" values="0.25;1;0.25" dur="1.5s" begin="${(i * 0.22).toFixed(2)}s" repeatCount="indefinite"/>
      </circle>`
    )
    .join('');
}

export function wrapupSvg(): string {
  return shell(`
    ${topBar()}

    ${accentBar(206, 168)}

    ${metaLabel(MX + 26, 232, '{{stage_label}}', { size: 14, tracking: 9 })}

    <text x="${MX + 24}" y="${322}" font-family="${DISPLAY}" font-weight="600" font-size="82"
      letter-spacing="2" fill="${PAPER}">{{wrap_title}}</text>

    <text x="${MX + 26}" y="${368}" font-family="${BODY}" font-weight="300" font-size="24"
      letter-spacing="8" fill="${DIM}">{{wrap_subtitle}}</text>

    ${progressBar(444)}
    ${dots(MX + 2, 486)}
    ${metaLabel(MX + 84, 491, '{{wrap_message}}', { size: 13, tracking: 4, fill: DIM })}

    ${rule(540, MX, RX, 0.08)}

    ${footBar()}
  `);
}
