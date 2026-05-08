// Design Ref: §11.1 #6 — Open 스크린
import { shell, topHeader, bottomSeal } from './common';

export function openSvg(): string {
  const rays = Array.from({ length: 24 })
    .map((_, i) => {
      const ang = (i * 15) * Math.PI / 180;
      const x1 = Math.cos(ang) * 160;
      const y1 = Math.sin(ang) * 160;
      const x2 = Math.cos(ang) * 250;
      const y2 = Math.sin(ang) * 250;
      return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`;
    })
    .join('');

  return shell(`
    ${topHeader()}

    <g transform="translate(640 360)" opacity="0.85">
      <circle r="190" fill="url(#sgw)"/>
      <g stroke="url(#goldg)" stroke-width="0.8" opacity="0.5">
        <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="80s" repeatCount="indefinite"/>
        ${rays}
      </g>
    </g>

    <g transform="translate(640 360)">
      <circle r="86" fill="#0F2C20" stroke="url(#goldg)" stroke-width="2"/>
      <circle r="78" fill="none" stroke="#D4AF37" stroke-width="0.6" opacity="0.6"/>
      <text y="-12" text-anchor="middle" font-family="Georgia, 'Gulim', '굴림', serif" font-style="italic" font-size="13" letter-spacing="5" fill="#FFD56B">NOW</text>
      <text y="18" text-anchor="middle" font-family="Georgia, 'Gulim', '굴림', serif" font-weight="bold" font-size="34" letter-spacing="10" fill="#FFEBA0">OPEN</text>
      <text y="44" text-anchor="middle" font-family="Georgia, 'Gulim', '굴림', serif" font-style="italic" font-size="11" letter-spacing="3" fill="#D4AF37" opacity="0.8">the journey begins</text>
    </g>

    <text x="640" y="190" text-anchor="middle" font-family="Georgia, 'Gulim', '굴림', serif" font-weight="bold" font-size="58" letter-spacing="10" fill="url(#goldg)">{{round_title}}</text>

    <text x="640" y="568" text-anchor="middle" font-family="Georgia, 'Gulim', '굴림', serif" font-style="italic" font-size="20" letter-spacing="3" fill="#FFEBA0">{{open_quote}}</text>
    <text x="640" y="600" text-anchor="middle" font-family="ui-monospace, monospace" font-size="12" letter-spacing="6" fill="#D4AF37">{{open_subline}}</text>

    ${bottomSeal()}
  `);
}
