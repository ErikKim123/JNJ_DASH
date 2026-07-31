// Template 06 — 결승 전용 화면 (Prep / Wrapup / Result / Pairing).
// 예선/본선과 같은 중앙 대칭 문법을 쓰되 타이포 스케일을 한 단계 올리고,
// 제목 위아래에 이중 헤어라인을 둬 "특별한 지면"임을 표시한다.
import {
  shell, topBar, footBar, hairline, ornament, metaLabel, panel, portrait, numBadge, ROMAN,
  DISPLAY, BODY, MONO, INK, INK_SOFT, ACCENT, TEAL, ROSE, CX, MX, RX,
} from '../common';

export function finalPrepSvg(): string {
  return shell(`
    ${topBar()}

    ${metaLabel(CX, 210, '{{stage_label}}', { size: 15, tracking: 14 })}

    ${hairline(244, CX - 300, CX + 300, 0.2)}
    <text x="${CX}" y="${346}" text-anchor="middle" font-family="${DISPLAY}" font-weight="900"
      font-size="88" letter-spacing="6" fill="${INK}">{{round_title}}</text>
    ${hairline(376, CX - 300, CX + 300, 0.2)}

    <text x="${CX}" y="${430}" text-anchor="middle" font-family="${BODY}" font-weight="300"
      font-size="25" letter-spacing="9" fill="${INK_SOFT}">{{round_subtitle}}</text>

    ${ornament(474, 190)}
    ${metaLabel(CX, 524, '{{participants}}', { size: 14, tracking: 6 })}

    ${footBar()}
  `);
}

export function finalWrapupSvg(): string {
  return shell(`
    ${topBar()}

    ${metaLabel(CX, 208, '{{stage_label}}', { size: 14, tracking: 12 })}

    <text x="${CX}" y="${322}" text-anchor="middle" font-family="${DISPLAY}" font-weight="900"
      font-size="78" letter-spacing="5" fill="${INK}">{{wrap_title}}</text>
    <text x="${CX}" y="${370}" text-anchor="middle" font-family="${BODY}" font-weight="300"
      font-size="24" letter-spacing="11" fill="${INK_SOFT}">{{wrap_subtitle}}</text>

    ${ornament(414, 200)}

    <g>
      <line x1="${MX + 120}" y1="466" x2="${RX - 120}" y2="466" stroke="${INK}" stroke-opacity="0.12" stroke-width="2"/>
      <line x1="${MX + 120}" y1="466" x2="${MX + 320}" y2="466" stroke="${ACCENT}" stroke-width="2" stroke-linecap="round">
        <animate attributeName="x1" values="${MX + 120};${RX - 320};${MX + 120}" dur="4.4s" repeatCount="indefinite"/>
        <animate attributeName="x2" values="${MX + 320};${RX - 120};${MX + 320}" dur="4.4s" repeatCount="indefinite"/>
      </line>
    </g>

    ${metaLabel(CX, 516, '{{wrap_message}}', { size: 13, tracking: 5, fill: INK_SOFT })}

    ${footBar()}
  `);
}

// ── 결승 RESULT — 1·2·3위 발표(reveal) ──────────────────────────────────────
// 밝은 지면이므로 05 의 "빛나는" 글로우 대신, 살짝 떠올랐다 내려앉으며 잉크가 번지듯
// 선명해지는 연출을 쓴다 (brightness 대신 contrast/blur 로 밝은 배경에서도 변화가 보인다).
const REVEAL_STYLE = `
  <style>
    svg.t06 .jnj-reveal { opacity: 0; transform-box: fill-box; transform-origin: center; }
    svg.t06 .jnj-reveal.revealed { opacity: 1; }
    svg.t06 .jnj-reveal.reveal-anim {
      will-change: transform, opacity, filter;
      animation: t06-rise 1000ms cubic-bezier(0.22, 1, 0.36, 1) forwards,
                 t06-ink 1200ms ease-out forwards;
    }
    @keyframes t06-rise {
      0%   { opacity: 0; transform: translateY(42px) scale(0.9); }
      60%  { opacity: 1; transform: translateY(-6px) scale(1.03); }
      100% { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes t06-ink {
      0%   { filter: blur(6px) contrast(0.6) drop-shadow(0 0 0 rgba(168,121,43,0)); }
      35%  { filter: blur(0) contrast(1.15) drop-shadow(0 6px 22px rgba(168,121,43,0.45)); }
      100% { filter: blur(0) contrast(1) drop-shadow(0 0 0 rgba(168,121,43,0)); }
    }
  </style>
`;

function podium(cx: number, side: 'L' | 'F', label: string, accent: string): string {
  const prefix = side === 'L' ? 'champ_leader' : 'champ_follower';

  const seat = (
    rank: 1 | 2 | 3,
    px: number,
    py: number,
    r: number,
    rankY: number,
    nameSize: number,
    rankColor: string
  ) => `
    <g class="jnj-reveal" data-reveal-id="${side}-${rank}">
      <text x="${px}" y="${rankY}" text-anchor="middle" font-family="${DISPLAY}" font-weight="700"
        font-size="${rank === 1 ? 22 : 17}" letter-spacing="4" fill="${rankColor}">${ROMAN[rank]}</text>
      ${portrait(px, py, r, `{{${prefix}_photo_${rank}}}`, accent)}
      ${numBadge(px, py, r, `{{${prefix}_num_${rank}}}`, accent)}
      <text x="${px}" y="506" text-anchor="middle" font-family="${BODY}" font-weight="600"
        font-size="${nameSize}" letter-spacing="0.4" fill="${INK}">{{${prefix}_${rank}}}</text>
    </g>
  `;

  return `
    <g>
      <text x="${cx}" y="282" text-anchor="middle" font-family="${MONO}" font-size="16" letter-spacing="8" fill="${accent}">${label}</text>
      ${hairline(296, cx - 170, cx + 170, 0.3, accent)}
      ${seat(1, cx, 414, 58, 336, 22, ACCENT)}
      ${seat(2, cx - 152, 430, 40, 372, 16, TEAL)}
      ${seat(3, cx + 152, 430, 40, 372, 16, ROSE)}
    </g>
  `;
}

export function finalResultSvg(): string {
  return shell(`
    ${REVEAL_STYLE}
    ${topBar()}

    ${metaLabel(CX, 168, '{{result_subtitle}}', { size: 13, tracking: 8, fill: INK_SOFT })}
    <text x="${CX}" y="${216}" text-anchor="middle" font-family="${DISPLAY}" font-weight="900"
      font-size="50" letter-spacing="6" fill="${INK}">{{result_title}}</text>
    ${hairline(238, MX, RX, 0.18)}

    ${panel(MX, 258, 500, 300, 0.42)}
    ${panel(RX - 500, 258, 500, 300, 0.42)}

    ${podium(MX + 250, 'L', '{{label_leader}}', ACCENT)}
    ${podium(RX - 250, 'F', '{{label_follower}}', TEAL)}

    ${footBar()}
  `);
}

// 결승 PAIRING — 심사위원 + 결승 진출자 인비테이셔널 무대.
function driftSparkles(cx: number, cy: number, count: number): string {
  let body = '';
  for (let i = 0; i < count; i++) {
    const a = ((i * (360 / count)) * Math.PI) / 180;
    const r = 190 + ((i * 41) % 80);
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r * 0.46;
    body += `<path d="M ${x.toFixed(1)} ${(y - 4).toFixed(1)} L ${(x + 3).toFixed(1)} ${y.toFixed(1)} L ${x.toFixed(1)} ${(y + 4).toFixed(1)} L ${(x - 3).toFixed(1)} ${y.toFixed(1)} Z" fill="${ACCENT}">
      <animate attributeName="opacity" values="0;0.85;0" dur="3.8s" begin="${((i * 0.27) % 3.4).toFixed(2)}s" repeatCount="indefinite"/>
    </path>`;
  }
  return `<g>${body}</g>`;
}

export function finalPairingSvg(): string {
  return shell(`
    ${topBar()}

    ${metaLabel(CX, 208, 'INVITATIONAL', { size: 14, tracking: 14 })}

    ${driftSparkles(CX, 380, 18)}

    <text x="${CX}" y="${400}" text-anchor="middle" font-family="${DISPLAY}" font-weight="900"
      font-size="92" letter-spacing="8" fill="${INK}">{{round_title}}</text>

    ${ornament(446, 240)}

    <text x="${CX}" y="${508}" text-anchor="middle" font-family="${BODY}" font-weight="300"
      font-size="20" letter-spacing="3" fill="${INK_SOFT}">Where the judges share the floor with the finalists</text>

    ${footBar()}
  `);
}
