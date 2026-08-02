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

  // 카운트 티어별 ellipse 와 폰트 — 이름 제거로 라벨(L/F+번호)이 짧아졌으므로 글자를
  // 크게 키우고, 2줄 블록이 세로로 커진 만큼 RY·stagger 를 늘려 인접 라벨 비중첩.
  let RX: number, RY: number, roleFontSize: number, stagger: number;
  if (count <= 8) {
    RX = 235; RY = 150; roleFontSize = 30; stagger = 12;
  } else if (count <= 14) {
    RX = 335; RY = 165; roleFontSize = 22; stagger = 26;
  } else if (count <= 20) {
    RX = 405; RY = 172; roleFontSize = 18; stagger = 36;
  } else {
    RX = 430; RY = 176; roleFontSize = 15; stagger = 44;
  }

  const cx = 640;
  const cy = 420;

  // 코드성 텍스트(L095/F100)라 가독성 높은 굵은 sans-serif 로 표시.
  const roleFont = "'Helvetica Neue', 'Segoe UI', Arial, 'Malgun Gothic', '맑은 고딕', sans-serif";
  const lineH = roleFontSize + 6;
  const flourishGap = Math.round(roleFontSize * 0.28);
  const flourishHalf = Math.round(roleFontSize * 1.0);
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
          <text text-anchor="${anchor}" y="${leaderY}" font-family="${roleFont}" font-size="${roleFontSize}" font-weight="700" letter-spacing="0.5" fill="#FFD56B">L{{leader_num_${i}}}</text>
          <text text-anchor="${anchor}" y="${followerY}" font-family="${roleFont}" font-size="${roleFontSize}" font-weight="700" letter-spacing="0.5" fill="url(#silverg)">F{{follower_num_${i}}}</text>
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

// 목록 배치 PAIRING — 대시보드/MC 의 "목록 배치" 토글이 켜졌을 때 원형 대신 그린다.
// 03/04 는 이름 없이 L###/F### 코드만 쓰므로 목록도 같은 어휘로, 도록 색인처럼 정렬한다.
//   · 인원이 늘면 열을 나눠 행 높이를 지킨다(글자를 줄이지 않는다).
//   · 행마다 얇은 골드 그라디언트 밑줄 — 원형 배치의 커플 플뢰리시와 같은 결.
export function listPairingSvg(pairCount: number): string {
  const count = Math.max(1, Math.min(30, pairCount));
  const cols = count <= 8 ? 1 : count <= 16 ? 2 : 3;
  const MXX = 140;
  const RXX = 1140;
  const gap = 48;
  const colW = (RXX - MXX - gap * (cols - 1)) / cols;
  const perCol = Math.ceil(count / cols);
  const TOP = 216;
  const BOTTOM = 636;
  const rowH = Math.min(46, (BOTTOM - TOP) / perCol);
  const fs = Math.max(13, Math.min(26, rowH * 0.54));
  const blockH = rowH * perCol;
  const top = TOP + (BOTTOM - TOP - blockH) / 2;
  // 코드성 텍스트(L095/F100)라 원형 배치와 같은 굵은 sans-serif 로 맞춘다.
  const roleFont = "'Helvetica Neue', 'Segoe UI', Arial, 'Malgun Gothic', '맑은 고딕', sans-serif";
  const monoFont = 'ui-monospace, monospace';

  let rows = '';
  for (let i = 1; i <= count; i++) {
    const col = Math.floor((i - 1) / perCol);
    const idxInCol = (i - 1) % perCol;
    const x0 = MXX + col * (colW + gap);
    // 열이 넓어도(1열일 때 1000px) 순번·L·F 가 양끝으로 흩어지지 않게 고정 폭 트랙에 담고
    // 그 트랙을 열 가운데 놓는다.
    const trackW = Math.min(colW, 340);
    const tx = x0 + (colW - trackW) / 2;
    const cy = top + idxInCol * rowH + rowH / 2;
    const baseline = cy + fs * 0.35;
    rows += `
      <g opacity="0">
        <animate attributeName="opacity" values="0;1" dur="0.4s" begin="${(0.2 + i * 0.04).toFixed(2)}s" fill="freeze"/>
        <text x="${tx.toFixed(1)}" y="${baseline.toFixed(1)}" font-family="${monoFont}" font-size="${(fs * 0.62).toFixed(1)}"
          letter-spacing="1.5" fill="#9A98A8" opacity="0.7">${String(i).padStart(2, '0')}</text>
        <text x="${(tx + trackW * 0.62).toFixed(1)}" y="${baseline.toFixed(1)}" text-anchor="end" font-family="${roleFont}"
          font-size="${fs.toFixed(1)}" font-weight="700" letter-spacing="0.5" fill="#FFD56B">L{{leader_num_${i}}}</text>
        <text x="${(tx + trackW * 0.67).toFixed(1)}" y="${baseline.toFixed(1)}" text-anchor="middle" font-family="${roleFont}"
          font-size="${(fs * 0.7).toFixed(1)}" fill="#9A98A8" opacity="0.5">·</text>
        <text x="${(tx + trackW * 0.72).toFixed(1)}" y="${baseline.toFixed(1)}" text-anchor="start" font-family="${roleFont}"
          font-size="${fs.toFixed(1)}" font-weight="700" letter-spacing="0.5" fill="url(#silverg)">F{{follower_num_${i}}}</text>
        <line x1="${tx.toFixed(1)}" y1="${(cy + rowH / 2).toFixed(1)}" x2="${(tx + trackW).toFixed(1)}" y2="${(cy + rowH / 2).toFixed(1)}"
          stroke="url(#goldgh)" stroke-width="0.7" opacity="0.4"/>
      </g>
    `;
  }

  const colHeaders = Array.from({ length: cols }, (_, c) => {
    const x0 = MXX + c * (colW + gap);
    const trackW = Math.min(colW, 340);
    const tx = x0 + (colW - trackW) / 2;
    return `
      <g transform="translate(0 ${(top - 16).toFixed(1)})">
        <text x="${(tx + trackW * 0.62).toFixed(1)}" y="0" text-anchor="end" font-family="${monoFont}" font-size="10" letter-spacing="4" fill="#D4AF37">{{label_leader}}</text>
        <text x="${(tx + trackW * 0.72).toFixed(1)}" y="0" text-anchor="start" font-family="${monoFont}" font-size="10" letter-spacing="4" fill="#D4AF37">{{label_follower}}</text>
      </g>
    `;
  }).join('');

  return shell(`
    ${topHeader()}
    <text x="640" y="146" text-anchor="middle" font-family="'Cinzel', 'Cormorant Garamond', Georgia, 'Gulim', '굴림', serif" font-weight="bold" font-size="36" letter-spacing="10" fill="url(#goldg)">{{round_title}}</text>
    <text x="640" y="176" text-anchor="middle" font-family="'Cormorant Garamond', Georgia, 'Gulim', '굴림', serif" font-style="italic" font-size="15" letter-spacing="6" fill="#E8E6DA" opacity="0.85">{{stage_label}}</text>

    ${colHeaders}
    ${rows}

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
export function pickPairingSvg(pairCount: number, pairCircle = false): string {
  return pairCircle ? renderCirclePairing(pairCount) : listPairingSvg(pairCount);
}
