// Design Ref: §11.1 #6 — Prep 스크린 (예선/본선 공통)
import { shell, heroHeader, citiesFooter } from './common';

export function prepSvg(): string {
  return shell(`
    ${heroHeader()}

    <text x="640" y="288" text-anchor="middle" font-family="Georgia, 'Gulim', '굴림', serif" font-size="20" letter-spacing="10" fill="#FFD56B" font-style="italic">{{stage_label}}</text>

    <text x="640" y="386" text-anchor="middle" font-family="Georgia, 'Gulim', '굴림', serif" font-weight="bold" font-size="84" letter-spacing="8" fill="url(#goldg)">{{round_title}}</text>
    <text x="640" y="430" text-anchor="middle" font-family="Georgia, 'Gulim', '굴림', serif" font-size="22" letter-spacing="12" fill="#E8E6DA" opacity="0.85">{{round_subtitle}}</text>

    <g transform="translate(640 526)">
      <rect x="-44" y="-42" width="88" height="3" fill="url(#goldg)"/>
      <rect x="-44" y="39" width="88" height="3" fill="url(#goldg)"/>
      <path d="M -38 -36 L 38 -36 L 38 -28 L 30 -28 Q 28 -8 0 0 Q -28 -8 -30 -28 L -38 -28 Z" fill="url(#goldg)" opacity="0.95"/>
      <path d="M -38 36 L 38 36 L 38 28 L 30 28 Q 28 8 0 0 Q -28 8 -30 28 L -38 28 Z" fill="url(#goldg)" opacity="0.95"/>
      <line x1="0" y1="-2" x2="0" y2="14" stroke="#FFEBA0" stroke-width="0.7" opacity="0.5">
        <animate attributeName="opacity" values="0.3;0.8;0.3" dur="0.9s" repeatCount="indefinite"/>
      </line>
      <circle r="1.8" fill="#FFEBA0">
        <animate attributeName="cy" values="-2;14" dur="0.9s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.15;0.85;1" dur="0.9s" repeatCount="indefinite"/>
      </circle>
      <circle r="1.5" fill="#FFEBA0">
        <animate attributeName="cy" values="-2;14" dur="0.9s" begin="0.3s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.15;0.85;1" dur="0.9s" begin="0.3s" repeatCount="indefinite"/>
      </circle>
      <circle r="1.3" fill="#FFEBA0">
        <animate attributeName="cy" values="-2;14" dur="0.9s" begin="0.6s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.15;0.85;1" dur="0.9s" begin="0.6s" repeatCount="indefinite"/>
      </circle>
      <ellipse cx="0" cy="22" rx="3" ry="1.5" fill="#FFEBA0" opacity="0.85">
        <animate attributeName="rx" values="3;14;3" dur="6s" repeatCount="indefinite"/>
        <animate attributeName="ry" values="1.5;3.5;1.5" dur="6s" repeatCount="indefinite"/>
      </ellipse>
      <ellipse cx="0" cy="-32" rx="14" ry="2.5" fill="#0F2C20" opacity="0.5">
        <animate attributeName="rx" values="3;14;3" dur="6s" repeatCount="indefinite"/>
      </ellipse>
    </g>

    <g transform="translate(640 612)">
      <line x1="-300" y1="0" x2="-110" y2="0" stroke="url(#goldgh)" stroke-width="0.7"/>
      <line x1="110" y1="0" x2="300" y2="0" stroke="url(#goldgh)" stroke-width="0.7"/>
      <text text-anchor="middle" y="6" font-family="Georgia, 'Gulim', '굴림', serif" font-size="15" letter-spacing="6" fill="#D4AF37">{{participants}}</text>
    </g>

    ${citiesFooter()}
  `);
}
