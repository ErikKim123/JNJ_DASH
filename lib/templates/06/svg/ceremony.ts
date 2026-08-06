// Template 06 — CEREMONY (결승 시상식).
// 도록의 수상자 페이지: 1위 한 쌍을 크게 중앙에, 2·3위 두 쌍을 아래 좌우에 배치.
// 각 구획은 [로마 숫자 + 순위 라벨] 헤더로 구분돼 순위가 글자 크기뿐 아니라 구조로도 읽힌다.
//
// 벚꽃(sakura) 토글: TemplateRenderer 가 .jnj-sakura 에 .active 를 붙인다.
import {
  shell, topBar, hairline, sponsorRow, metaLabel, panel, portrait, numBadge, ROMAN,
  DISPLAY, BODY, MONO, INK, INK_SOFT, ACCENT, TEAL, ROSE, LINE, CX, MX, RX,
} from '../common';

// 결정적 의사난수 — 빌드마다 같은 결과.
function seeded(i: number): number {
  const x = Math.sin(i * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

const PETAL_COLORS = ['#F3B6C4', '#EFC9D4', '#F7D9E1', '#E9A8BA', '#FBE7EC', '#E4C58F'];

function petalPath(s: number): string {
  return `M 0 ${-s} C ${s * 0.5} ${-s * 0.8}, ${s * 0.6} ${-s * 0.3}, ${s * 0.5} ${s * 0.2}
          C ${s * 0.3} ${s * 0.7}, 0 ${s}, 0 ${s}
          C 0 ${s}, ${-s * 0.3} ${s * 0.7}, ${-s * 0.5} ${s * 0.2}
          C ${-s * 0.6} ${-s * 0.3}, ${-s * 0.5} ${-s * 0.8}, 0 ${-s} Z`;
}

/** 벚꽃 낙하 — 밝은 지면 위에서도 보이도록 채도를 조금 높이고 얇은 외곽선을 준다. */
function sakuraFall(): string {
  const count = 84;
  const DUR = 8;
  let html = '';
  for (let i = 0; i < count; i++) {
    const x = seeded(i + 1) * 1280;
    const delay = ((i / count) * DUR).toFixed(2);
    const size = 6 + seeded(i + 300) * 2.4;
    const rot = Math.floor(seeded(i + 500) * 360);
    const dir = i % 2 === 0 ? 1 : -1;
    const color = PETAL_COLORS[i % PETAL_COLORS.length];
    const sway = 55 + Math.floor(seeded(i + 700) * 25);
    html += `
      <g transform="translate(${x.toFixed(1)} -20)">
        <animateTransform attributeName="transform" type="translate"
          values="${x.toFixed(1)} -20; ${(x + sway).toFixed(1)} 185; ${(x - sway).toFixed(1)} 405; ${(x + sway * 0.5).toFixed(1)} 600; ${x.toFixed(1)} 760"
          dur="${DUR}s" begin="${delay}s" repeatCount="indefinite"/>
        <path d="${petalPath(size)}" fill="${color}" stroke="#C9788F" stroke-width="0.35" opacity="0">
          <animateTransform attributeName="transform" type="rotate"
            from="${rot}" to="${rot + 360 * dir}" dur="4s" begin="${delay}s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0;0.95;0.95;0" keyTimes="0;0.06;0.92;1" dur="${DUR}s" begin="${delay}s" repeatCount="indefinite"/>
        </path>
      </g>`;
  }
  return html;
}

/**
 * 구획 헤더 — 구분선(위) + [로마 숫자 · 라벨](아래).
 * 선을 텍스트 양옆에 두면 라벨 길이에 따라 선을 파고들므로, 선은 위에 한 줄로 긋고
 * 텍스트는 하나의 <text> 로 묶어 중앙 정렬한다 (길이가 변해도 항상 축에 맞는다).
 */
function rankHeader(cx: number, y: number, rank: 1 | 2 | 3, label: string, color: string, half = 150): string {
  return `
    <g transform="translate(${cx} ${y})">
      <line x1="${-half}" y1="-20" x2="${half}" y2="-20" stroke="${LINE}" stroke-opacity="0.18" stroke-width="1"/>
      <text x="0" y="4" text-anchor="middle">
        <tspan font-family="${DISPLAY}" font-weight="700" font-size="${rank === 1 ? 22 : 18}"
          letter-spacing="2" fill="${color}">${ROMAN[rank]}</tspan>
        <tspan dx="12" font-family="${MONO}" font-size="${rank === 1 ? 12 : 11}"
          letter-spacing="4" fill="${color}" opacity="0.85">${label}</tspan>
      </text>
    </g>
  `;
}

function pair(
  rank: 1 | 2 | 3,
  lx: number,
  fx: number,
  cy: number,
  r: number,
  nameY: number,
  nameSize: number,
  delay: number
): string {
  const person = (px: number, prefix: 'champ_leader' | 'champ_follower', ring: string) => `
    ${portrait(px, cy, r, `{{${prefix}_photo_${rank}}}`, ring)}
    ${numBadge(px, cy, r, `{{${prefix}_num_${rank}}}`, ring)}
    <text x="${px}" y="${nameY}" text-anchor="middle" font-family="${BODY}" font-weight="600"
      font-size="${nameSize}" letter-spacing="0.4" fill="${INK}">{{${prefix}_${rank}}}</text>
  `;
  return `
    <g opacity="0">
      <animate attributeName="opacity" values="0;1" dur="0.6s" begin="${delay.toFixed(2)}s" fill="freeze"/>
      ${person(lx, 'champ_leader', ACCENT)}
      ${person(fx, 'champ_follower', TEAL)}
    </g>
  `;
}

export function ceremonySvg(): string {
  return shell(`
    <style>
      /* display 토글 — OFF 일 때 SMIL 자체가 멈춘다. */
      svg.t06 .jnj-sakura { display: none; }
      svg.t06 .jnj-sakura.active { display: inline; }
    </style>

    ${topBar()}

    ${metaLabel(CX, 164, '{{ceremony_subtitle}}', { size: 13, tracking: 8, fill: INK_SOFT })}
    <text x="${CX}" y="${212}" text-anchor="middle" font-family="${DISPLAY}" font-weight="900"
      font-size="46" letter-spacing="6" fill="${INK}">{{ceremony_title}}</text>
    ${hairline(234, MX, RX, 0.18)}

    ${panel(MX - 16, 254, RX - MX + 32, 350, 0.4)}

    ${rankHeader(CX, 288, 1, 'FIRST', ACCENT, 230)}
    ${pair(1, 556, 724, 366, 56, 452, 19, 0.25)}

    ${rankHeader(320, 486, 2, 'SECOND', TEAL, 130)}
    ${pair(2, 264, 376, 536, 32, 590, 14, 0.5)}

    ${rankHeader(960, 486, 3, 'THIRD', ROSE, 130)}
    ${pair(3, 904, 1016, 536, 32, 590, 14, 0.7)}

    <g class="jnj-sakura" pointer-events="none">${sakuraFall()}</g>

    ${hairline(618, MX, RX, 0.14)}
    ${sponsorRow(660, 130, 40, 26)}
  `);
}
