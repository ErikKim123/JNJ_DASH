// Template 06 — OPEN.
// 원형 배지(04) 대신 초대장의 "내부 액자" — 이중 헤어라인 사각 프레임 안에 NOW / OPEN.
// 프레임 네 모서리의 짧은 골드 코너 마크가 인쇄물 재단선처럼 격식을 만든다.
import { shell, topBar, footBar, ornament, metaLabel, DISPLAY, BODY, INK, INK_SOFT, ACCENT, CX } from '../common';

function innerFrame(x: number, y: number, w: number, h: number): string {
  const c = 22; // 코너 마크 길이
  const corner = (px: number, py: number, sx: number, sy: number) => `
    <path d="M ${px + sx * c} ${py} L ${px} ${py} L ${px} ${py + sy * c}" fill="none"
      stroke="${ACCENT}" stroke-width="1.6"/>`;
  return `
    <g>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#FFFDF7" fill-opacity="0.6"
        stroke="${ACCENT}" stroke-opacity="0.45" stroke-width="1"/>
      <rect x="${x + 7}" y="${y + 7}" width="${w - 14}" height="${h - 14}" fill="none"
        stroke="${ACCENT}" stroke-opacity="0.22" stroke-width="0.7"/>
      ${corner(x, y, 1, 1)}
      ${corner(x + w, y, -1, 1)}
      ${corner(x, y + h, 1, -1)}
      ${corner(x + w, y + h, -1, -1)}
    </g>
  `;
}

export function openSvg(): string {
  const fx = CX - 270;
  const fy = 214;
  const fw = 540;
  const fh = 210;
  return shell(`
    ${topBar()}

    ${metaLabel(CX, 178, '{{round_title}}', { size: 15, tracking: 10, fill: INK_SOFT })}

    ${innerFrame(fx, fy, fw, fh)}

    ${metaLabel(CX, 262, 'NOW', { size: 13, tracking: 14 })}

    <text x="${CX}" y="${348}" text-anchor="middle" font-family="${DISPLAY}" font-weight="700"
      font-size="72" letter-spacing="16" fill="${INK}">OPEN</text>

    <text x="${CX}" y="${392}" text-anchor="middle" font-family="${BODY}" font-weight="300"
      font-size="14" letter-spacing="6" fill="${ACCENT}">the journey begins</text>

    ${ornament(462, 200)}

    <text x="${CX}" y="${508}" text-anchor="middle" font-family="${BODY}" font-weight="300"
      font-size="22" letter-spacing="2" fill="${INK}">{{open_quote}}</text>

    ${metaLabel(CX, 544, '{{open_subline}}', { size: 12, tracking: 6, fill: INK_SOFT })}

    ${footBar()}
  `);
}
