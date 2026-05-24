// Design Ref: Template 03 — PAIRING.
// 디자이너 v6 — 미니멀 타이포그래피, 색상만으로 역할 구분:
//   • 단일 폰트(Georgia + Gulim 폴백) — 리더/팔로워 동일 serif 패밀리, 동일 weight(600).
//   • 색상으로만 역할 구분:
//       ─ 리더: 골드 #FFD56B
//       ─ 팔로워: 실버 그라디언트 url(#silverg)
//   • 표식(●/○) 없음, 이탤릭 없음 — 색상 대비만으로 즉시 식별.
//   • 하단: 짧은 골드 그라디언트 라인 (커플 종결 플뢰리시) — 두 줄을 한 커플로 묶는 유일한 디자인 요소.
//   • 원 → 타원(ellipse) 레이아웃 + 짝수 페어 stagger → 상/하단도 라벨 비중첩.
//   • 회전 0, 텍스트 100% 가로.
//   • 카운트 티어별 RX/RY/폰트/stagger 튜닝 — 5~25 페어 모두 비중첩.
import { shell, topHeader, citiesFooter } from './common';

function renderCirclePairing(pairCount: number): string {
  const count = Math.max(2, Math.min(25, pairCount));

  // 카운트 티어별 ellipse 와 폰트 — 라벨 폭과 인접 간격을 함께 고려해 튜닝.
  let RX: number, RY: number, nameFontSize: number, stagger: number;
  if (count <= 8) {
    RX = 230; RY = 130; nameFontSize = 18; stagger = 0;
  } else if (count <= 14) {
    RX = 330; RY = 152; nameFontSize = 14; stagger = 18;
  } else if (count <= 20) {
    RX = 400; RY = 158; nameFontSize = 12; stagger = 22;
  } else {
    RX = 425; RY = 154; nameFontSize = 11; stagger = 24;
  }

  const cx = 640;
  const cy = 425;

  const partNumSize = Math.max(9, Math.round(nameFontSize * 0.78));
  const lineH = nameFontSize + 4;
  const flourishGap = Math.round(nameFontSize * 0.35);
  const flourishHalf = Math.round(nameFontSize * 1.6);
  const blockH = lineH * 2 + flourishGap;

  // 가운데 워드마크
  const centerMark = `
    <g transform="translate(${cx} ${cy})" opacity="0">
      <animate attributeName="opacity" values="0;1" dur="0.9s" begin="0s" fill="freeze"/>
      <text text-anchor="middle" y="-8" font-family="'Cormorant Garamond', Georgia, serif" font-size="22" letter-spacing="6" fill="#D4AF37" opacity="0.55">✦</text>
      <line x1="-34" y1="10" x2="34" y2="10" stroke="url(#goldgh)" stroke-width="0.7" opacity="0.65"/>
      <text text-anchor="middle" y="28" font-family="'Cormorant Garamond', Georgia, serif" font-style="italic" font-size="11" letter-spacing="5" fill="#D4AF37" opacity="0.55">stage</text>
    </g>
  `;

  function anchorFor(dx: number): 'start' | 'middle' | 'end' {
    if (dx > 0.35) return 'start';
    if (dx < -0.35) return 'end';
    return 'middle';
  }
  function yShiftFor(dy: number): number {
    if (dy < -0.4) return -blockH + lineH * 0.4;
    if (dy > 0.4) return lineH * 0.4;
    return -blockH / 2 + lineH * 0.5;
  }
  function flourishLineX(anchor: 'start' | 'middle' | 'end'): { x1: number; x2: number } {
    if (anchor === 'start') return { x1: 0, x2: flourishHalf * 2 };
    if (anchor === 'end') return { x1: -flourishHalf * 2, x2: 0 };
    return { x1: -flourishHalf, x2: flourishHalf };
  }

  let body = '';
  for (let i = 1; i <= count; i++) {
    const angleDeg = -90 + (i - 1) * (360 / count);
    const angleRad = (angleDeg * Math.PI) / 180;

    const dx = Math.cos(angleRad);
    const dy = Math.sin(angleRad);

    // 짝수 페어 → ellipse 배율 약간 확대 (RX/RY 비율 유지하며 외곽 이동).
    const factor = i % 2 === 0 ? 1 + stagger / RX : 1;
    const px = cx + dx * RX * factor;
    const py = cy + dy * RY * factor + yShiftFor(dy);

    const anchor = anchorFor(dx);

    const leaderY = 0;
    const followerY = leaderY + lineH;
    const flourishY = followerY + flourishGap;
    const { x1: fx1, x2: fx2 } = flourishLineX(anchor);

    const delay = (0.5 + i * 0.045).toFixed(2);

    body += `
      <g opacity="0">
        <animate attributeName="opacity" values="0;1" dur="0.5s" begin="${delay}s" fill="freeze"/>
        <g transform="translate(${px.toFixed(1)} ${py.toFixed(1)})" font-family="'Cormorant Garamond', Georgia, 'Gulim', '굴림', serif">
          <text text-anchor="${anchor}" y="${leaderY}" font-size="${nameFontSize}" font-weight="600" letter-spacing="0.4" fill="#FFD56B">
            <tspan font-size="${partNumSize}" letter-spacing="1.5">{{leader_num_${i}}}</tspan>
            <tspan dx="7">{{leader_${i}}}</tspan>
          </text>
          <text text-anchor="${anchor}" y="${followerY}" font-size="${nameFontSize}" font-weight="600" letter-spacing="0.4" fill="url(#silverg)">
            <tspan font-size="${partNumSize}" letter-spacing="1.5">{{follower_num_${i}}}</tspan>
            <tspan dx="7">{{follower_${i}}}</tspan>
          </text>
          <line x1="${fx1}" y1="${flourishY}" x2="${fx2}" y2="${flourishY}" stroke="url(#goldgh)" stroke-width="0.7" opacity="0.75"/>
        </g>
      </g>
    `;
  }

  return shell(`
    ${topHeader()}
    <text x="640" y="146" text-anchor="middle" font-family="'Cinzel', 'Cormorant Garamond', Georgia, 'Gulim', '굴림', serif" font-weight="bold" font-size="36" letter-spacing="10" fill="url(#goldg)">{{round_title}}</text>
    <text x="640" y="176" text-anchor="middle" font-family="'Cormorant Garamond', Georgia, 'Gulim', '굴림', serif" font-style="italic" font-size="15" letter-spacing="6" fill="#E8E6DA" opacity="0.85">{{stage_label}}</text>

    ${centerMark}
    ${body}

    ${citiesFooter()}
  `);
}

// 외부 인터페이스 — 02 와 동일.
export function pairingSvg20(pairCount: number = 20): string {
  return renderCirclePairing(pairCount);
}
export function pairingSvg10(): string {
  return renderCirclePairing(10);
}
export function pairingSvg5(): string {
  return renderCirclePairing(5);
}
export function pickPairingSvg(pairCount: number): string {
  return renderCirclePairing(pairCount);
}
