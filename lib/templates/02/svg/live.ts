// Design Ref: §11.1 #6 — Live 스크린 (라운드 무관 공통)
import { shell, citiesFooter } from './common';

export function liveSvg(): string {
  return shell(`
    <g transform="translate(80 80)">
      <rect x="0" y="0" width="100" height="36" rx="4" fill="url(#liveg)"/>
      <circle cx="16" cy="18" r="6" fill="#fff">
        <animate attributeName="opacity" values="1;0.3;1" dur="1.2s" repeatCount="indefinite"/>
      </circle>
      <text x="32" y="24" font-family="ui-monospace, monospace" font-size="15" font-weight="bold" letter-spacing="3" fill="#fff">LIVE</text>
    </g>
    <text x="200" y="103" font-family="Georgia, 'Gulim', '굴림', serif" font-style="italic" font-size="13" letter-spacing="4" fill="#9A98A8">{{stage_label}}</text>

    <text x="1200" y="103" text-anchor="end" font-family="Georgia, 'Gulim', '굴림', serif" font-weight="bold" font-size="20" letter-spacing="6" fill="#FFD56B">{{round_title}}</text>

    <g transform="translate(640 200)">
      <line x1="-110" y1="0" x2="-40" y2="0" stroke="url(#goldgh)" stroke-width="0.8"/>
      <line x1="40" y1="0" x2="110" y2="0" stroke="url(#goldgh)" stroke-width="0.8"/>
      <text y="6" text-anchor="middle" font-family="ui-monospace, monospace" font-size="14" letter-spacing="8" fill="#D4AF37">— ON STAGE —</text>
    </g>

    <g transform="translate(640 410)">
      <circle r="160" fill="none" stroke="url(#liveg)" stroke-width="2.4" opacity="0.4">
        <animate attributeName="r" values="155;195;155" dur="2.4s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.4;0;0.4" dur="2.4s" repeatCount="indefinite"/>
      </circle>
      <circle r="170" fill="none" stroke="url(#liveg)" stroke-width="1.8" opacity="0.3">
        <animate attributeName="r" values="160;205;160" dur="2.4s" begin="0.8s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.3;0;0.3" dur="2.4s" begin="0.8s" repeatCount="indefinite"/>
      </circle>
      <circle r="148" fill="#0F2C20" stroke="url(#goldg)" stroke-width="2.5"/>
      <circle r="134" fill="none" stroke="#D4AF37" stroke-width="0.6" opacity="0.6"/>
      <text y="26" text-anchor="middle" font-family="Georgia, 'Gulim', '굴림', serif" font-weight="bold" font-size="84" letter-spacing="16" fill="url(#goldg)">LIVE</text>
    </g>

    <text x="640" y="610" text-anchor="middle" font-family="Georgia, 'Gulim', '굴림', serif" font-style="italic" font-size="22" letter-spacing="4" fill="#FFEBA0">{{live_message}}</text>

    ${citiesFooter()}
  `);
}
