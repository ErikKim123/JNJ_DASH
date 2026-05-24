// Design Ref: §11.1 #6 — Close 스크린
import { shell, topHeader, bottomSeal } from './common';

export function closeSvg(): string {
  const ribbonPoints = Array.from({ length: 16 })
    .map((_, i) => {
      const ang = (i * 22.5) * Math.PI / 180;
      const x = (Math.cos(ang) * 118).toFixed(1);
      const y = (Math.sin(ang) * 118).toFixed(1);
      return `<circle cx="${x}" cy="${y}" r="2.4"/>`;
    })
    .join('');

  return shell(`
    ${topHeader()}
    <text x="640" y="160" text-anchor="middle" font-family="Georgia, 'Gulim', '굴림', serif" font-style="italic" font-size="22" letter-spacing="8" fill="#FFD56B">{{stage_label}}</text>

    <g transform="translate(640 360)">
      <circle r="118" fill="none" stroke="url(#goldg)" stroke-width="2.4"/>
      <circle r="106" fill="none" stroke="#D4AF37" stroke-width="0.6" opacity="0.6"/>
      <circle r="92" fill="none" stroke="url(#goldg)" stroke-width="1.4"/>
      <circle r="80" fill="#0F2C20"/>
      <g fill="url(#goldg)">${ribbonPoints}</g>
      <path d="M -32 4 L -10 28 L 32 -22" fill="none" stroke="url(#goldg)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
    </g>

    <text x="640" y="540" text-anchor="middle" font-family="Georgia, 'Gulim', '굴림', serif" font-weight="bold" font-size="50" letter-spacing="6" fill="url(#goldg)">{{close_title}}</text>
    <text x="640" y="582" text-anchor="middle" font-family="Georgia, 'Gulim', '굴림', serif" font-size="20" letter-spacing="8" fill="#E8E6DA" opacity="0.85">{{close_subtitle}}</text>
    <text x="640" y="616" text-anchor="middle" font-family="Georgia, 'Gulim', '굴림', serif" font-style="italic" font-size="14" letter-spacing="4" fill="#D4AF37">{{close_message}}</text>

    ${bottomSeal()}
  `);
}
