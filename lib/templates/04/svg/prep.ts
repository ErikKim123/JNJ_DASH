// Design Ref: §11.1 #6 — Prep 스크린 (예선/본선 공통).
// Template 04: Template 03의 중앙 돌하르방 3개 애니메이션을 제거 (텍스트만 노출).
import { shell, heroHeader, citiesFooter, sponsorRow } from './common';

export function prepSvg(): string {
  return shell(`
    ${heroHeader()}

    <text x="640" y="288" text-anchor="middle" font-family="'Cormorant Garamond', Georgia, 'Gulim', '굴림', serif" font-size="20" letter-spacing="10" fill="#F5C64E" font-style="italic">{{stage_label}}</text>

    <text x="640" y="386" text-anchor="middle" font-family="'Cinzel', 'Cormorant Garamond', Georgia, 'Gulim', '굴림', serif" font-weight="bold" font-size="84" letter-spacing="8" fill="url(#goldgt)">{{round_title}}</text>
    <text x="640" y="430" text-anchor="middle" font-family="'Cormorant Garamond', Georgia, 'Gulim', '굴림', serif" font-size="22" letter-spacing="12" fill="#F7F4EA" opacity="0.85">{{round_subtitle}}</text>

    ${citiesFooter(610)}
    ${sponsorRow()}
  `);
}
