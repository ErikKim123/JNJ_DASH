// Template 07 — PREP (예선/본선 공통, final=true 면 결승 변형).
// 상단: 대형 라운드 제목. 하단: 정보 카드 3장(STAGE · DIVISION · ENTRIES)이 화면 폭을 가득 채운다.
// 레퍼런스의 "제목 아래 카드 격자" 문법을 대기 화면에도 그대로 가져온다.
import {
  shell, topBar, footBar, glassCard, label, strong, goldRule, fadeUp, lightRays,
  DISPLAY, SOFT, GOLD, CX, MX, RX, f,
} from '../common';

const CARD_Y = 386;
const CARD_H = 236;

function infoCard(x: number, w: number, caption: string, value: string, note: string, delay: number, gold = false): string {
  const cx = x + w / 2;
  const valueEl = gold
    ? `<text class="num" x="${f(cx)}" y="${CARD_Y + 146}" text-anchor="middle" font-family="${DISPLAY}" font-weight="900"
        font-size="38" fill="url(#t07GoldNum)">${value}</text>`
    : strong(cx, CARD_Y + 142, value, 30, { weight: 900, tracking: 1 });
  return fadeUp(delay, `
    ${glassCard(x, CARD_Y, w, CARD_H, { gold })}
    ${label(cx, CARD_Y + 52, caption, { size: 13, tracking: 6 })}
    <line x1="${f(cx - 22)}" y1="${CARD_Y + 68}" x2="${f(cx + 22)}" y2="${CARD_Y + 68}" stroke="${GOLD}" stroke-width="2.5" stroke-linecap="round"/>
    ${valueEl}
    ${label(cx, CARD_Y + 194, note, { size: 11, tracking: 4, fill: SOFT, weight: 700 })}
  `);
}

export function prepSvg(final = false): string {
  const gap = 18;
  const side = 340;
  const mid = RX - MX - side * 2 - gap * 2;
  return shell(`
    ${final ? lightRays(CX, 286) : ''}
    ${topBar()}

    ${label(CX, 196, final ? 'THE GRAND FINAL' : 'WELCOME TO THE STAGE', { size: 15, tracking: 10 })}
    ${strong(CX, 306, '{{round_title}}', final ? 88 : 80, { cls: 'hero', weight: 900, tracking: 2 })}
    ${goldRule(346, 240)}

    ${infoCard(MX, side, 'STAGE', '{{stage_label}}', 'CURRENT ROUND', 0.2)}
    ${infoCard(MX + side + gap, mid, 'DIVISION', '{{round_subtitle}}', 'CATEGORY', 0.35)}
    ${infoCard(RX - side, side, 'ENTRIES', '{{participants}}', 'ON THE FLOOR', 0.5, true)}

    ${footBar()}
  `);
}
