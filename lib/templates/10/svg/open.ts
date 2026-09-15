// Template 10 — OPEN.
// 화면 폭 전체의 유리 무대 띠 안에 초대형 "OPEN". 좌·우 상단에서 무대 조명이 교차하며 비추고,
// 글자 위로 빛줄기(shine)가 주기적으로 훑고 지나간다.
import { shell, topBar, footBar, stageBand, label, strong, DISPLAY, WHITE, CX } from '../common';

function beams(): string {
  return `
    <defs>
      <linearGradient id="t10Beam" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#9DB4FF" stop-opacity="0.08"/>
        <stop offset="1" stop-color="#BFF6FF" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <g fill="url(#t10Beam)">
      <polygon points="60,0 200,0 720,560 470,560">
        <animate attributeName="opacity" values="0.45;1;0.45" dur="4.8s" repeatCount="indefinite"/>
      </polygon>
      <polygon points="1080,0 1220,0 810,560 560,560">
        <animate attributeName="opacity" values="1;0.45;1" dur="4.8s" repeatCount="indefinite"/>
      </polygon>
    </g>`;
}

export function openSvg(): string {
  const titleAttrs = `x="${CX + 5}" y="464" text-anchor="middle" font-family="${DISPLAY}" font-weight="900" font-size="168" letter-spacing="10"`;
  return shell(`
    ${beams()}
    ${topBar()}
    ${stageBand(176, 344)}

    ${label(CX + 5, 236, '{{round_title}}', { size: 16, tracking: 10, fit: 1100 })}
    ${strong(CX + 11, 292, 'NOW', 28, { weight: 800, tracking: 22 })}

    <text class="hero" ${titleAttrs} fill="${WHITE}">OPEN</text>
    <defs><clipPath id="t10OpenClip"><text ${titleAttrs}>OPEN</text></clipPath></defs>
    <g clip-path="url(#t10OpenClip)">
      <rect x="-300" y="320" width="150" height="170" fill="url(#t10Shine)" opacity="0.7" transform="skewX(-18)">
        <animate attributeName="x" values="-300;1500" dur="3.2s" begin="0.8s" repeatCount="indefinite"/>
      </rect>
    </g>

    ${strong(CX, 574, '{{open_quote}}', 24, { weight: 700, tracking: 0.5, fit: 1180 })}
    ${label(CX + 2, 610, '{{open_subline}}', { size: 13, tracking: 5, fit: 1180 })}

    ${footBar()}
  `);
}
