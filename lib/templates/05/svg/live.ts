// Template 05 — LIVE.
// 방송 그래픽 문법: 좌상단 LIVE 배지 + 대형 "ON STAGE" + 우측 맥동 링.
// 심사 중이라는 상태가 화면 어디를 봐도 즉시 읽히도록 색(레드)·모션·크기를 한 방향으로 모았다.
import { shell, topBar, footBar, accentBar, rule, metaLabel, DISPLAY, BODY, MONO, PAPER, DIM, ACCENT, LIVE, MX } from '../common';

function liveBadge(x: number, y: number): string {
  return `
    <g transform="translate(${x} ${y})">
      <rect x="0" y="0" width="104" height="34" rx="3" fill="url(#liveG)"/>
      <circle cx="18" cy="17" r="5.5" fill="#fff">
        <animate attributeName="opacity" values="1;0.25;1" dur="1.2s" repeatCount="indefinite"/>
      </circle>
      <text x="34" y="23" font-family="${MONO}" font-size="14" font-weight="bold" letter-spacing="3.5" fill="#fff">LIVE</text>
    </g>
  `;
}

function pulseRings(cx: number, cy: number): string {
  return `
    <g transform="translate(${cx} ${cy})">
      <circle r="150" fill="none" stroke="${LIVE}" stroke-width="2" opacity="0.45">
        <animate attributeName="r" values="120;190;120" dur="2.6s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.45;0;0.45" dur="2.6s" repeatCount="indefinite"/>
      </circle>
      <circle r="150" fill="none" stroke="${LIVE}" stroke-width="1.4" opacity="0.3">
        <animate attributeName="r" values="120;190;120" dur="2.6s" begin="0.9s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.3;0;0.3" dur="2.6s" begin="0.9s" repeatCount="indefinite"/>
      </circle>
      <circle r="108" fill="#0B0B10" fill-opacity="0.55" stroke="${LIVE}" stroke-width="1.6" stroke-opacity="0.8"/>
      <circle r="12" fill="${LIVE}">
        <animate attributeName="opacity" values="1;0.35;1" dur="1.2s" repeatCount="indefinite"/>
      </circle>
    </g>
  `;
}

export function liveSvg(): string {
  return shell(`
    ${topBar('{{round_title}}')}

    ${liveBadge(MX, 148)}
    ${metaLabel(MX + 118, 171, '{{stage_label}}', { size: 13, tracking: 6, fill: DIM })}

    ${pulseRings(972, 384)}

    ${accentBar(268, 150)}

    <text x="${MX + 24}" y="${360}" font-family="${DISPLAY}" font-weight="600" font-size="94"
      letter-spacing="3" fill="${PAPER}">ON STAGE</text>

    ${rule(392, MX + 24, MX + 460, 0.45, ACCENT)}

    <text x="${MX + 26}" y="${446}" font-family="${BODY}" font-weight="300" font-size="26"
      letter-spacing="4" fill="${ACCENT}">{{live_message}}</text>

    ${footBar()}
  `);
}
