// Design Ref: §11.1 #6 — Wrapup (Calculate Total) 스크린
import { shell, topHeader, bottomSeal, sponsorRow } from './common';

export function wrapupSvg(): string {
  return shell(`
    ${topHeader()}
    <text x="640" y="160" text-anchor="middle" font-family="'Cormorant Garamond', Georgia, 'Gulim', '굴림', serif" font-style="italic" font-size="22" letter-spacing="8" fill="#FFD56B">{{stage_label}}</text>

    <text x="640" y="280" text-anchor="middle" font-family="'Cinzel', 'Cormorant Garamond', Georgia, 'Gulim', '굴림', serif" font-weight="bold" font-size="68" letter-spacing="6" fill="url(#goldg)">{{wrap_title}}</text>
    <text x="640" y="328" text-anchor="middle" font-family="'Cormorant Garamond', Georgia, 'Gulim', '굴림', serif" font-size="26" letter-spacing="14" fill="#E8E6DA" opacity="0.85">{{wrap_subtitle}}</text>

    <g transform="translate(640 440)" opacity="0.95">
      <polygon points="-60,-30 -30,-60 30,-60 60,-30 60,30 30,60 -30,60 -60,30"
        fill="none" stroke="url(#goldg)" stroke-width="2"/>
      <polygon points="-50,-22 -22,-50 22,-50 50,-22 50,22 22,50 -22,50 -50,22"
        fill="none" stroke="#D4AF37" stroke-width="0.6" opacity="0.6"/>
      <g fill="url(#goldg)">
        <path d="M -22 18 L 18 -22 L 26 -14 L -14 26 Z"/>
        <path d="M -14 26 L -22 18 L -28 32 Z" fill="#FFEBA0"/>
        <circle cx="14" cy="-18" r="3" fill="#FFEBA0"/>
      </g>
    </g>

    <g transform="translate(640 540)" fill="#FFD56B">
      <circle cx="-30" cy="0" r="5">
        <animate attributeName="opacity" values="0.3;1;0.3" dur="1.4s" begin="0s" repeatCount="indefinite"/>
      </circle>
      <circle cx="0" cy="0" r="5">
        <animate attributeName="opacity" values="0.3;1;0.3" dur="1.4s" begin="0.2s" repeatCount="indefinite"/>
      </circle>
      <circle cx="30" cy="0" r="5">
        <animate attributeName="opacity" values="0.3;1;0.3" dur="1.4s" begin="0.4s" repeatCount="indefinite"/>
      </circle>
    </g>
    <text x="640" y="582" text-anchor="middle" font-family="'Cormorant Garamond', Georgia, 'Gulim', '굴림', serif" font-style="italic" font-size="14" letter-spacing="4" fill="#9A98A8">{{wrap_message}}</text>

    ${bottomSeal(610)}
    ${sponsorRow()}
  `);
}
