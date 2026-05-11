// Design Ref: §11.1 #6 — Prep 스크린 (예선/본선 공통). 중앙 아이콘은 돌하르방 3개 pulse.
import { shell, heroHeader, citiesFooter } from './common';
import { dolharubangSvg } from '../../shared/dolharubang';

export function prepSvg(): string {
  return shell(`
    ${heroHeader()}

    <text x="640" y="288" text-anchor="middle" font-family="Georgia, 'Gulim', '굴림', serif" font-size="20" letter-spacing="10" fill="#FFD56B" font-style="italic">{{stage_label}}</text>

    <text x="640" y="386" text-anchor="middle" font-family="Georgia, 'Gulim', '굴림', serif" font-weight="bold" font-size="84" letter-spacing="8" fill="url(#goldg)">{{round_title}}</text>
    <text x="640" y="430" text-anchor="middle" font-family="Georgia, 'Gulim', '굴림', serif" font-size="22" letter-spacing="12" fill="#E8E6DA" opacity="0.85">{{round_subtitle}}</text>

    ${dolharubangSvg()}

    <g transform="translate(640 612)">
      <line x1="-300" y1="0" x2="-110" y2="0" stroke="url(#goldgh)" stroke-width="0.7"/>
      <line x1="110" y1="0" x2="300" y2="0" stroke="url(#goldgh)" stroke-width="0.7"/>
      <text text-anchor="middle" y="6" font-family="Georgia, 'Gulim', '굴림', serif" font-size="15" letter-spacing="6" fill="#D4AF37">{{participants}}</text>
    </g>

    ${citiesFooter()}
  `);
}
