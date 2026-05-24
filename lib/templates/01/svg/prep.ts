// Design Ref: §11.1 #6 — Prep 스크린 (예선/본선 공통). 중앙 아이콘은 돌하르방 3개 pulse.
import { shell, heroHeader, citiesFooter, sponsorRow } from './common';
import { dolharubangSvg } from '../../shared/dolharubang';

export function prepSvg(): string {
  return shell(`
    ${heroHeader()}

    <text x="640" y="288" text-anchor="middle" font-family="'Cormorant Garamond', Georgia, 'Gulim', '굴림', serif" font-size="20" letter-spacing="10" fill="#FFD56B" font-style="italic">{{stage_label}}</text>

    <text x="640" y="386" text-anchor="middle" font-family="'Cinzel', 'Cormorant Garamond', Georgia, 'Gulim', '굴림', serif" font-weight="bold" font-size="84" letter-spacing="8" fill="url(#goldg)">{{round_title}}</text>
    <text x="640" y="430" text-anchor="middle" font-family="'Cormorant Garamond', Georgia, 'Gulim', '굴림', serif" font-size="22" letter-spacing="12" fill="#E8E6DA" opacity="0.85">{{round_subtitle}}</text>

    ${dolharubangSvg()}

    ${citiesFooter(610)}
    ${sponsorRow()}
  `);
}
