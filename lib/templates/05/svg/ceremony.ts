// Template 05 — CEREMONY (결승 시상식).
// 04 는 1위를 위, 2·3위를 아래에 흩어 놓아 시선 경로가 지그재그였다.
// 05 는 순위를 위→아래 3개의 밴드로 쌓는다. 각 밴드는 [순위 | 리더 | 팔로워] 한 줄이라
// 어느 줄을 봐도 같은 위치에서 같은 정보를 읽는다. 1위 밴드만 타일·글자를 키워 위계를 준다.
//
// 벚꽃(sakura) 토글: TemplateRenderer 가 .jnj-sakura 에 .active 를 붙인다.
import {
  shell, topBar, footBar, accentBar, rule, metaLabel, plate, photoTile, numBadge,
  DISPLAY, BODY, MONO, PAPER, DIM, ACCENT, COOL, MX, RX,
} from '../common';

// 결정적 의사난수 — 빌드마다 같은 결과.
function seeded(i: number): number {
  const x = Math.sin(i * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

const CONFETTI_COLORS = ['#E9B44C', '#FFD98A', '#F7F5F0', '#D7DEE6', '#C08457', '#FFF3D0'];

/** 골드 컨페티 — 05 의 다크 톤에 맞춘 얇은 조각(벚꽃잎 대신 리본 스트립). */
function confettiFall(): string {
  const count = 80;
  const DUR = 8;
  let html = '';
  for (let i = 0; i < count; i++) {
    const x = seeded(i + 1) * 1280;
    const delay = ((i / count) * DUR).toFixed(2);
    const w = 3 + seeded(i + 300) * 3;
    const h = w * (2.4 + seeded(i + 900) * 1.6);
    const rot = Math.floor(seeded(i + 500) * 360);
    const dir = i % 2 === 0 ? 1 : -1;
    const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    const sway = 50 + Math.floor(seeded(i + 700) * 30);
    html += `
      <g transform="translate(${x.toFixed(1)} -20)">
        <animateTransform attributeName="transform" type="translate"
          values="${x.toFixed(1)} -20; ${(x + sway).toFixed(1)} 190; ${(x - sway).toFixed(1)} 410; ${(x + sway * 0.5).toFixed(1)} 600; ${x.toFixed(1)} 760"
          dur="${DUR}s" begin="${delay}s" repeatCount="indefinite"/>
        <rect x="${(-w / 2).toFixed(1)}" y="${(-h / 2).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="1" fill="${color}" opacity="0">
          <animateTransform attributeName="transform" type="rotate"
            from="${rot}" to="${rot + 360 * dir}" dur="3.6s" begin="${delay}s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0;0.95;0.95;0" keyTimes="0;0.06;0.92;1" dur="${DUR}s" begin="${delay}s" repeatCount="indefinite"/>
        </rect>
      </g>`;
  }
  return html;
}

interface BandSpec {
  rank: 1 | 2 | 3;
  top: number;
  height: number;
  tile: number;
  nameSize: number;
  label: string;
  labelColor: string;
}

const BANDS: readonly BandSpec[] = [
  { rank: 1, top: 262, height: 130, tile: 100, nameSize: 24, label: '1ST', labelColor: ACCENT },
  { rank: 2, top: 392, height: 100, tile: 76, nameSize: 19, label: '2ND', labelColor: COOL },
  { rank: 3, top: 492, height: 100, tile: 76, nameSize: 19, label: '3RD', labelColor: '#D08F63' },
];

const LEADER_X = 470;
const FOLLOWER_X = 800;

function band(b: BandSpec, delay: number): string {
  const cy = b.top + b.height / 2;
  const baseline = cy + b.nameSize * 0.35;
  const person = (cx: number, prefix: 'champ_leader' | 'champ_follower', accent: string) => `
    ${photoTile(cx, cy, b.tile, `{{${prefix}_photo_${b.rank}}}`, accent)}
    ${numBadge(cx, cy, b.tile, `{{${prefix}_num_${b.rank}}}`, accent)}
    <text x="${(cx + b.tile / 2 + 18).toFixed(1)}" y="${baseline.toFixed(1)}" font-family="${BODY}"
      font-weight="600" font-size="${b.nameSize}" letter-spacing="0.4" fill="${PAPER}">{{${prefix}_${b.rank}}}</text>
  `;
  return `
    <g opacity="0">
      <animate attributeName="opacity" values="0;1" dur="0.6s" begin="${delay.toFixed(2)}s" fill="freeze"/>
      <rect x="${MX}" y="${b.top + 6}" width="4" height="${b.height - 12}" fill="${b.labelColor}" opacity="0.9"/>
      <text x="${MX + 18}" y="${(cy + 5).toFixed(1)}" font-family="${MONO}" font-size="${b.rank === 1 ? 20 : 16}"
        font-weight="700" letter-spacing="${b.rank === 1 ? 7 : 5}" fill="${b.labelColor}">${b.label}</text>
      ${person(LEADER_X, 'champ_leader', ACCENT)}
      ${person(FOLLOWER_X, 'champ_follower', COOL)}
    </g>
  `;
}

export function ceremonySvg(): string {
  return shell(`
    <style>
      /* 벚꽃/컨페티 토글 — display 로 SMIL 자체를 멈춘다 (OFF 시 CPU 소모 없음). */
      svg.t05 .jnj-sakura { display: none; }
      svg.t05 .jnj-sakura.active { display: inline; }
    </style>

    ${topBar('')}

    ${accentBar(130, 78)}
    ${metaLabel(MX + 26, 156, '{{ceremony_subtitle}}', { size: 13, tracking: 6, fill: DIM })}
    <text x="${MX + 24}" y="${202}" font-family="${DISPLAY}" font-weight="700" font-size="50"
      letter-spacing="2" fill="${PAPER}">{{ceremony_title}}</text>
    ${metaLabel(RX, 202, '{{label_leader}} · {{label_follower}}', { size: 13, tracking: 4, anchor: 'end', fill: DIM })}
    ${rule(226, MX, RX, 0.16)}

    ${plate(MX - 8, 254, RX - MX + 16, 346, { rx: 5, opacity: 0.4, strokeOpacity: 0.08 })}
    ${BANDS.map((b, i) => band(b, 0.25 + i * 0.22)).join('')}

    <g class="jnj-sakura" pointer-events="none">${confettiFall()}</g>

    ${footBar()}
  `);
}
