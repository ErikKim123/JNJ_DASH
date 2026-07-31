// Template 05 — 결승 전용 화면 (Prep / Wrapup / Result / Pairing).
// 결승은 예선/본선보다 한 단계 큰 타이포 스케일을 쓰고, 우측 여백에 회전 엠블럼을 둬
// "같은 문법의 더 큰 화면"으로 읽히게 한다.
import {
  shell, topBar, footBar, accentBar, rule, metaLabel, plate, photoTile, numBadge,
  DISPLAY, BODY, MONO, PAPER, DIM, ACCENT, COOL, MX, RX,
} from '../common';

/** 회전 엠블럼 — 결승 화면의 우측 앵커. 얇은 선만 써서 텍스트와 경쟁하지 않는다. */
function emblem(cx: number, cy: number, scale = 1): string {
  const spokes = Array.from({ length: 24 })
    .map((_, i) => {
      const a = (i * 15 * Math.PI) / 180;
      const long = i % 3 === 0;
      const r1 = 96;
      const r2 = long ? 148 : 122;
      return `<line x1="${(Math.cos(a) * r1).toFixed(1)}" y1="${(Math.sin(a) * r1).toFixed(1)}" x2="${(Math.cos(a) * r2).toFixed(1)}" y2="${(Math.sin(a) * r2).toFixed(1)}" stroke-width="${long ? 1.4 : 0.7}" opacity="${long ? 0.9 : 0.45}"/>`;
    })
    .join('');
  return `
    <g transform="translate(${cx} ${cy}) scale(${scale})">
      <circle r="176" fill="url(#halo)"/>
      <g stroke="${ACCENT}">
        <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="120s" repeatCount="indefinite"/>
        ${spokes}
      </g>
      <circle r="84" fill="none" stroke="${PAPER}" stroke-width="0.7" stroke-opacity="0.2"/>
      <g fill="${ACCENT}">
        <animate attributeName="opacity" values="0.75;1;0.75" dur="3s" repeatCount="indefinite"/>
        <path d="M 0 -30 L 8 -8 L 30 0 L 8 8 L 0 30 L -8 8 L -30 0 L -8 -8 Z"/>
      </g>
    </g>
  `;
}

export function finalPrepSvg(): string {
  return shell(`
    ${topBar('')}
    ${emblem(958, 372)}

    ${accentBar(198, 214)}
    ${metaLabel(MX + 26, 228, '{{stage_label}}', { size: 15, tracking: 10 })}

    <text x="${MX + 22}" y="${344}" font-family="${DISPLAY}" font-weight="700" font-size="102"
      letter-spacing="1" fill="${PAPER}">{{round_title}}</text>

    ${rule(378, MX + 24, MX + 430, 0.5, ACCENT)}

    <text x="${MX + 26}" y="${424}" font-family="${BODY}" font-weight="300" font-size="26"
      letter-spacing="7" fill="${DIM}">{{round_subtitle}}</text>

    ${metaLabel(MX + 26, 478, '{{participants}}', { size: 14, tracking: 5 })}

    ${footBar()}
  `);
}

export function finalWrapupSvg(): string {
  return shell(`
    ${topBar()}
    ${emblem(962, 380, 0.86)}

    ${accentBar(206, 176)}
    ${metaLabel(MX + 26, 234, '{{stage_label}}', { size: 14, tracking: 9 })}

    <text x="${MX + 24}" y="${330}" font-family="${DISPLAY}" font-weight="700" font-size="90"
      letter-spacing="1.5" fill="${PAPER}">{{wrap_title}}</text>

    <text x="${MX + 26}" y="${378}" font-family="${BODY}" font-weight="300" font-size="25"
      letter-spacing="9" fill="${DIM}">{{wrap_subtitle}}</text>

    <g>
      <rect x="${MX}" y="446" width="${RX - MX}" height="3" fill="${PAPER}" opacity="0.12"/>
      <rect x="${MX}" y="446" width="260" height="3" fill="url(#accentH)">
        <animate attributeName="x" values="${MX};${RX - 260};${MX}" dur="4.6s" repeatCount="indefinite"/>
      </rect>
    </g>
    ${metaLabel(MX + 2, 492, '{{wrap_message}}', { size: 13, tracking: 4, fill: DIM })}

    ${footBar()}
  `);
}

// ── 결승 RESULT — 1·2·3위 발표(reveal) ──────────────────────────────────────
// TemplateRenderer 가 [data-reveal-id] 요소에 .revealed / .reveal-anim 을 붙인다.
// 규칙은 svg.t05 로 스코프해 같은 페이지의 다른 템플릿 미리보기에 새지 않게 한다.
const REVEAL_STYLE = `
  <style>
    svg.t05 .jnj-reveal { opacity: 0; transform-box: fill-box; transform-origin: center; }
    svg.t05 .jnj-reveal.revealed { opacity: 1; }
    svg.t05 .jnj-reveal.reveal-anim {
      will-change: transform, opacity, filter;
      animation: t05-pop 1100ms cubic-bezier(0.33, 1.5, 0.62, 1) forwards,
                 t05-glow 1500ms ease-out forwards;
    }
    @keyframes t05-pop {
      0%   { opacity: 0; transform: translateY(64px) scale(0.72); }
      55%  { opacity: 1; transform: translateY(-10px) scale(1.06); }
      100% { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes t05-glow {
      0%   { filter: brightness(2.6) drop-shadow(0 0 0 rgba(233,180,76,0)); }
      25%  { filter: brightness(1.9) drop-shadow(0 0 42px rgba(233,180,76,0.9)); }
      60%  { filter: brightness(1.3) drop-shadow(0 0 22px rgba(233,180,76,0.45)); }
      100% { filter: brightness(1) drop-shadow(0 0 0 rgba(233,180,76,0)); }
    }
  </style>
`;

function podium(cx: number, side: 'L' | 'F', label: string, accent: string): string {
  const prefix = side === 'L' ? 'champ_leader' : 'champ_follower';
  const first = 108;
  const runner = 74;

  const seat = (
    rank: 1 | 2 | 3,
    tx: number,
    ty: number,
    size: number,
    nameY: number,
    nameSize: number,
    rankY: number,
    rankText: string,
    rankColor: string
  ) => `
    <g class="jnj-reveal" data-reveal-id="${side}-${rank}">
      <text x="${tx}" y="${rankY}" text-anchor="middle" font-family="${MONO}" font-size="${rank === 1 ? 13 : 11}"
        letter-spacing="${rank === 1 ? 7 : 5}" fill="${rankColor}">${rankText}</text>
      ${photoTile(tx, ty, size, `{{${prefix}_photo_${rank}}}`, accent)}
      ${numBadge(tx, ty, size, `{{${prefix}_num_${rank}}}`, accent)}
      <text x="${tx}" y="${nameY}" text-anchor="middle" font-family="${BODY}" font-weight="600"
        font-size="${nameSize}" letter-spacing="0.5" fill="${PAPER}">{{${prefix}_${rank}}}</text>
    </g>
  `;

  return `
    <g>
      <text x="${cx}" y="264" text-anchor="middle" font-family="${MONO}" font-size="17" letter-spacing="8" fill="${accent}">${label}</text>
      ${rule(278, cx - 170, cx + 170, 0.3, accent)}
      ${seat(1, cx, 366, first, 452, 24, 296, '1ST', ACCENT)}
      ${seat(2, cx - 130, 550, runner, 610, 16, 498, '2ND', COOL)}
      ${seat(3, cx + 130, 550, runner, 610, 16, 498, '3RD', '#D08F63')}
    </g>
  `;
}

export function finalResultSvg(): string {
  return shell(`
    ${REVEAL_STYLE}
    ${topBar('')}

    ${accentBar(140, 78)}
    ${metaLabel(MX + 26, 164, '{{result_subtitle}}', { size: 13, tracking: 6, fill: DIM })}
    <text x="${MX + 24}" y="${210}" font-family="${DISPLAY}" font-weight="700" font-size="54"
      letter-spacing="2" fill="${PAPER}">{{result_title}}</text>
    ${rule(232, MX, RX, 0.16)}

    ${plate(MX, 244, 532, 376, { rx: 5, opacity: 0.38, strokeOpacity: 0.08 })}
    ${plate(RX - 532, 244, 532, 376, { rx: 5, opacity: 0.38, strokeOpacity: 0.08 })}

    ${podium(MX + 266, 'L', '{{label_leader}}', ACCENT)}
    ${podium(RX - 266, 'F', '{{label_follower}}', COOL)}

    ${footBar()}
  `);
}

// 결승 PAIRING — 심사위원과 결승 진출자가 함께 추는 인비테이셔널 무대.
function sparkles(cx: number, cy: number, count: number): string {
  let body = '';
  for (let i = 0; i < count; i++) {
    const a = ((i * (360 / count)) * Math.PI) / 180;
    const r = 210 + ((i * 43) % 90);
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r * 0.5;
    body += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(1.2 + ((i * 0.7) % 1.6)).toFixed(1)}" fill="${ACCENT}">
      <animate attributeName="opacity" values="0;1;0" dur="3.6s" begin="${((i * 0.29) % 3).toFixed(2)}s" repeatCount="indefinite"/>
    </circle>`;
  }
  return `<g opacity="0.75">${body}</g>`;
}

export function finalPairingSvg(): string {
  return shell(`
    ${topBar()}
    ${sparkles(640, 400, 20)}

    ${accentBar(250, 132)}
    ${metaLabel(MX + 26, 278, 'INVITATIONAL', { size: 14, tracking: 10 })}

    <text x="${MX + 22}" y="${378}" font-family="${DISPLAY}" font-weight="700" font-size="112"
      letter-spacing="4" fill="${PAPER}">{{round_title}}</text>

    ${rule(414, MX + 24, RX - 200, 0.3, ACCENT)}

    <text x="${MX + 26}" y="${460}" font-family="${BODY}" font-weight="300" font-size="21"
      letter-spacing="3" fill="${DIM}">Where the judges share the floor with the finalists</text>

    ${footBar()}
  `);
}
