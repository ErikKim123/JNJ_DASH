// Template 10 — CEREMONY (결승 시상식).
// 순위별 유리 카드 3장이 화면 폭을 채운다 — 1위(중앙, 강조 테두리·가장 높음) · 2위(좌) · 3위(우).
// 각 카드 안에 리더·팔로워 사진을 나란히 두고, 사진 하단 경계에 역할 알약을 걸쳐
// 방송 그래픽처럼 사진과 정보가 한 덩어리로 읽히게 한다.
// 등장 순서는 3위 → 2위 → 1위 (긴장감을 쌓는다).
//
// 축하 효과 토글: TemplateRenderer 가 .jnj-sakura 에 .active 를 붙인다 — 07 은 벚꽃 대신 금·핑크·스카이 색종이.
import {
  shell, topBar, footBar, heading, waveCard, label, accentNumber, strong, rolePill, rankMark, photoFrame,
  clipBox, sparkle, fadeUp, seeded,
  WHITE, ACCENT, ACCENT_PALE, LEAD, FOLLOW, FRAME, f, type Role,
} from '../common';

interface Group {
  rank: 1 | 2 | 3;
  x: number;
  y: number;
  w: number;
  h: number;
  delay: number;
}

const GROUPS: readonly Group[] = [
  { rank: 3, x: 888, y: 232, w: 360, h: 412, delay: 0.3 },
  { rank: 2, x: 32, y: 232, w: 360, h: 412, delay: 0.55 },
  { rank: 1, x: 404, y: 170, w: 472, h: 474, delay: 0.85 },
];

const PLACE: Record<1 | 2 | 3, string> = { 1: 'CHAMPIONS', 2: 'SECOND PLACE', 3: 'THIRD PLACE' };

function group(g: Group): string {
  const { rank, x, y, w, h } = g;
  const big = rank === 1;
  const cx = x + w / 2;
  const rankSize = big ? 58 : 44;
  const rankY = y + (big ? 70 : 58);
  const placeY = rankY + 24;
  const pad = 20;
  const gapP = 16;
  const pw = (w - pad * 2 - gapP) / 2;
  const photoY = y + (big ? 116 : 100);
  const ph = big ? 226 : 190;
  const pillY = photoY + ph;
  const numSize = big ? 34 : 28;
  const numY = pillY + (big ? 50 : 44);
  const nameSize = big ? 19 : 16;
  const n1Y = numY + (big ? 32 : 28);
  const n2Y = n1Y + nameSize + 5;

  const person = (px: number, role: Role, labelKey: string): string => {
    const prefix = role === 'L' ? 'champ_leader' : 'champ_follower';
    const pcx = px + pw / 2;
    return `
      ${photoFrame(px, photoY, pw, ph, `{{${prefix}_photo_${rank}}}`, { ring: big ? ACCENT : FRAME, ringW: big ? 3 : 2.4 })}
      ${rolePill(pcx, pillY, labelKey, role, { w: Math.min(pw - 24, 118), h: 22, size: 10, tracking: 2 })}
      ${accentNumber(pcx, numY, `{{${prefix}_num_${rank}}}`, numSize)}
      ${clipBox(px - 4, n1Y - nameSize - 4, pw + 8, n2Y - n1Y + nameSize + 12, `
        ${strong(pcx, n1Y, `{{${prefix}_${rank}_l1}}`, nameSize, { fit: pw + 4, fitMin: 0.7 })}
        ${strong(pcx, n2Y, `{{${prefix}_${rank}_l2}}`, nameSize, { fit: pw + 4, fitMin: 0.7 })}
      `)}`;
  };

  return fadeUp(
    g.delay,
    `
    ${waveCard(x, y, w, h, { rx: 22, hero: big })}
    ${big ? `${sparkle(cx - 78, rankY - 22, 10)}${sparkle(cx + 78, rankY - 22, 10)}` : ''}
    ${rankMark(cx, rankY, rank, rankSize)}
    ${label(cx, placeY, PLACE[rank], { size: big ? 13 : 11, tracking: big ? 6 : 4, fill: big ? ACCENT : WHITE })}
    ${person(x + pad, 'L', '{{label_leader}}')}
    ${person(x + pad + pw + gapP, 'F', '{{label_follower}}')}
  `,
    24
  );
}

const CONFETTI_COLORS = [ACCENT, ACCENT_PALE, LEAD, FOLLOW, '#FFFFFF', '#B99CFF'];

/** 색종이 낙하 — 흔들리며 떨어지고, 세로 스케일을 흔들어 뒤집히는 느낌을 준다. */
function confetti(): string {
  const count = 90;
  const DUR = 7;
  let html = '';
  for (let i = 0; i < count; i++) {
    const x = seeded(i + 1) * 1280;
    const delay = ((i / count) * DUR).toFixed(2);
    const w = 7 + seeded(i + 200) * 6;
    const h = w * 0.46;
    const drift = (seeded(i + 400) - 0.5) * 160;
    const rot = Math.floor(seeded(i + 500) * 360);
    const dir = i % 2 === 0 ? 1 : -1;
    const spin = (1.4 + seeded(i + 600) * 1.4).toFixed(2);
    const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    const shape =
      i % 5 === 0
        ? `<circle r="${f(w * 0.32)}" fill="${color}" opacity="0">`
        : `<rect x="${f(-w / 2)}" y="${f(-h / 2)}" width="${f(w)}" height="${f(h)}" rx="1" fill="${color}" opacity="0">`;
    const close = i % 5 === 0 ? '</circle>' : '</rect>';
    html += `
      <g transform="translate(${f(x)} -20)">
        <animateTransform attributeName="transform" type="translate"
          values="${f(x)} -20; ${f(x + drift * 0.5)} 240; ${f(x - drift * 0.3)} 480; ${f(x + drift)} 760"
          dur="${DUR}s" begin="${delay}s" repeatCount="indefinite"/>
        ${shape}
          <animateTransform attributeName="transform" type="rotate" from="${rot}" to="${rot + 360 * dir}"
            dur="${spin}s" begin="${delay}s" repeatCount="indefinite"/>
          <animateTransform attributeName="transform" type="scale" additive="sum" values="1 1;1 0.2;1 1"
            dur="${(Number(spin) * 0.6).toFixed(2)}s" begin="${delay}s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.05;0.9;1" dur="${DUR}s" begin="${delay}s" repeatCount="indefinite"/>
        ${close}
      </g>`;
  }
  return html;
}

export function ceremonySvg(): string {
  return shell(`
    <style>
      /* display 토글 — OFF 일 때 SMIL 자체가 멈춘다. */
      svg.t07 .jnj-sakura { display: none; }
      svg.t07 .jnj-sakura.active { display: inline; }
    </style>

    ${topBar()}
    ${heading('{{ceremony_title}}', '{{ceremony_subtitle}}', { titleY: 118, subY: 148 })}
    ${GROUPS.map(group).join('')}

    <g class="jnj-sakura" pointer-events="none">${confetti()}</g>

    ${footBar()}
  `);
}
