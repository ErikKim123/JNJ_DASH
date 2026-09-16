// Template 09 — PREP (예선/본선 공통, final=true 면 결승 변형).
// 상단: 대형 상태 제목(PREPARING 등). 하단: 정보 카드가 화면 폭을 가득 채운다.
//   · STAGE        — 라운드 이름 (stage_label, 예: PRELIMINARY ROUND)
//   · ANNOUNCEMENT — 안내 문구 (round_subtitle, 예: Get ready · take your places)
//   · ENTRIES      — 참가 규모 (participants) — 값이 있을 때만.
//     값이 없으면 카드 2장이 폭을 나눠 갖고 STAGE 가 강조 주인공 카드가 된다
//     (빈 강조 카드가 서 있으면 "뭔가 빠진 화면"으로 읽힌다).
// 카드 값은 모두 카드 안쪽 폭(좌우 30px 여백)에 맞춰 자동으로 줄어든다 — fit.ts.
import {
  shell, topBar, footBar, panelCard, label, strong, accentNumber, accentRule, fadeUp,
  SOFT, ACCENT, CX, MX, RX, f,
} from '../common';

const CARD_Y = 386;
const CARD_H = 236;
const PAD = 30;
const GAP = 18;

interface Card {
  w: number;
  caption: string;
  value: string;
  note?: string;
  size: number;
  gold?: boolean;
  weight?: number;
}

function infoCard(x: number, c: Card, delay: number): string {
  const cx = x + c.w / 2;
  const maxW = c.w - PAD * 2;
  const valueEl = c.gold
    ? accentNumber(cx, CARD_Y + 146, c.value, c.size, 'middle', maxW)
    : strong(cx, CARD_Y + 144, c.value, c.size, { weight: c.weight ?? 900, tracking: 0.5, fit: maxW, fitMin: 0.55 });
  return fadeUp(delay, `
    ${panelCard(x, CARD_Y, c.w, CARD_H, { hero: c.gold })}
    ${label(cx + 3, CARD_Y + 52, c.caption, { size: 13, tracking: 6 })}
    <line x1="${f(cx - 22)}" y1="${CARD_Y + 68}" x2="${f(cx + 22)}" y2="${CARD_Y + 68}" stroke="${ACCENT}" stroke-width="2.5" stroke-linecap="round"/>
    ${valueEl}
    ${c.note ? label(cx + 2, CARD_Y + 196, c.note, { size: 11, tracking: 4, fill: SOFT, weight: 700 }) : ''}
  `);
}

export function prepSvg(final = false, withEntries = true): string {
  const inner = RX - MX;
  const cards: Card[] = withEntries
    ? [
        { w: 400, caption: 'STAGE', value: '{{stage_label}}', note: 'CURRENT ROUND', size: 32 },
        { w: inner - 400 - 322 - GAP * 2, caption: 'ANNOUNCEMENT', value: '{{round_subtitle}}', size: 28, weight: 800 },
        { w: 322, caption: 'ENTRIES', value: '{{participants}}', note: 'ON THE FLOOR', size: 38, gold: true },
      ]
    : [
        { w: 520, caption: 'STAGE', value: '{{stage_label}}', note: 'CURRENT ROUND', size: 38, gold: true },
        { w: inner - 520 - GAP, caption: 'ANNOUNCEMENT', value: '{{round_subtitle}}', size: 30, weight: 800 },
      ];

  let x = MX;
  let body = '';
  cards.forEach((c, i) => {
    body += infoCard(x, c, 0.2 + i * 0.15);
    x += c.w + GAP;
  });

  return shell(`
    ${topBar()}

    ${label(CX + 5, 196, final ? 'THE GRAND FINAL' : 'WELCOME TO THE STAGE', { size: 15, tracking: 10 })}
    ${strong(CX, 306, '{{round_title}}', final ? 88 : 80, { cls: 'hero', weight: 900, tracking: 2, fit: 1180 })}
    ${accentRule(346, 240)}

    ${body}

    ${footBar()}
  `);
}
