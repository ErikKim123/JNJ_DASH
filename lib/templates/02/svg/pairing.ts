// Design Ref: §11.1 #6 — Pairing 스크린 (예선 ≤25 / 본선 10 / 폴백 5)
// 페어 수에 따라 레이아웃이 달라지므로 변형별 함수 분리
import { shell, topHeader, citiesFooter } from './common';

// 예선 — 2 columns × ceil(count/2) rows. 최대 25페어 지원.
// 중앙 PAIR 번호 배지는 제거(좌우 번호 배지로 충분), 행 높이는 페어 수에 맞춰 자동 축소.
export function pairingSvg20(pairCount: number = 20): string {
  const count = Math.max(11, Math.min(25, pairCount));
  const firstColEnd = Math.ceil(count / 2);
  const rowsPerCol = firstColEnd;
  const startY = 232;
  const availableHeight = 428;
  const rowH = Math.min(42, Math.floor(availableHeight / Math.max(1, rowsPerCol - 1)));
  // 컬럼 중심을 안쪽으로 더 모으고(좌 360, 우 920) 각 컬럼 너비도 축소(NUM_OFFSET 256 → 220).
  // → 각 컬럼은 440px 폭으로 더 콤팩트, 가운데 컬럼 간 공백은 120px, 좌우 외곽 여백도 140px로 균형 잡힘.
  const cols = [
    { cx: 360, start: 1, end: firstColEnd },
    { cx: 920, start: firstColEnd + 1, end: count },
  ];
  // 한글 5~6자, 영문 8자 이상 이름이 와도 겹치지 않게 배지·이름 위치/크기 튜닝.
  // NAME_OFFSET 60: 리더/팔로워 이름 가운데 공백 = 120px.
  // NUM_OFFSET 220: 배지가 이름 쪽으로 더 가깝게(이전 256보다 36px 안쪽).
  const NUM_OFFSET = 220;
  const NAME_OFFSET = 60;
  const NAME_SIZE = 20;
  const stripeH = Math.max(28, rowH - 2);

  let body = '';
  for (const col of cols) {
    for (let i = col.start; i <= col.end; i++) {
      const rowIdx = i - col.start;
      const y = startY + rowIdx * rowH;
      const delay = (rowIdx * 0.05).toFixed(2);
      const isStripe = rowIdx % 2 === 1;
      const stripe = isStripe
        ? `<rect x="${col.cx - (NUM_OFFSET + 30)}" y="${y - stripeH / 2}" width="${(NUM_OFFSET + 30) * 2}" height="${stripeH}" rx="4" fill="#0F2C20" opacity="0.55"/>`
        : '';
      body += `
        ${stripe}
        <g transform="translate(${col.cx} ${y})" opacity="0">
          <animate attributeName="opacity" values="0;1" dur="0.5s" begin="${delay}s" fill="freeze"/>
          <g transform="translate(-${NUM_OFFSET} 0)">
            <rect x="-26" y="-13" width="52" height="26" rx="13" fill="url(#goldg)" opacity="0.2"/>
            <rect x="-26" y="-13" width="52" height="26" rx="13" fill="none" stroke="#9C7C2C" stroke-width="0.9"/>
            <text y="5" text-anchor="middle" font-family="ui-monospace, monospace" font-size="12.5" letter-spacing="1" fill="#FFD56B" font-weight="700">{{leader_num_${i}}}</text>
          </g>
          <text x="-${NAME_OFFSET}" y="7" text-anchor="end" font-family="'Gulim', '굴림', sans-serif" font-size="${NAME_SIZE}" font-weight="700" fill="#FFEBA0">{{leader_${i}}}</text>
          <text x="${NAME_OFFSET}" y="7" text-anchor="start" font-family="'Gulim', '굴림', sans-serif" font-size="${NAME_SIZE}" font-weight="700" fill="#FFEBA0">{{follower_${i}}}</text>
          <g transform="translate(${NUM_OFFSET} 0)">
            <rect x="-26" y="-13" width="52" height="26" rx="13" fill="url(#goldg)" opacity="0.2"/>
            <rect x="-26" y="-13" width="52" height="26" rx="13" fill="none" stroke="#9C7C2C" stroke-width="0.9"/>
            <text y="5" text-anchor="middle" font-family="ui-monospace, monospace" font-size="12.5" letter-spacing="1" fill="#FFD56B" font-weight="700">{{follower_num_${i}}}</text>
          </g>
        </g>
      `;
    }
  }

  const dividerTop = startY - 26;
  const dividerBottom = startY + (rowsPerCol - 1) * rowH + 22;
  const verticalDivider = `<line x1="640" y1="${dividerTop}" x2="640" y2="${dividerBottom}" stroke="#D4AF37" stroke-width="0.5" opacity="0.35" stroke-dasharray="2 6"/>`;

  const colHeaders = cols
    .map((col) => `
      <g transform="translate(${col.cx} 200)">
        <text x="-${NAME_OFFSET}" y="0" text-anchor="end" font-family="ui-monospace, monospace" font-size="10" letter-spacing="4" fill="#D4AF37">{{label_leader}}</text>
        <text x="${NAME_OFFSET}" y="0" text-anchor="start" font-family="ui-monospace, monospace" font-size="10" letter-spacing="4" fill="#D4AF37">{{label_follower}}</text>
        <line x1="-${NUM_OFFSET}" y1="14" x2="${NUM_OFFSET}" y2="14" stroke="url(#goldgh)" stroke-width="0.5" opacity="0.6"/>
      </g>
    `)
    .join('');

  return shell(`
    ${topHeader()}
    <text x="640" y="146" text-anchor="middle" font-family="'Cinzel', 'Cormorant Garamond', Georgia, 'Gulim', '굴림', serif" font-weight="bold" font-size="36" letter-spacing="10" fill="url(#goldg)">{{round_title}}</text>
    <text x="640" y="176" text-anchor="middle" font-family="'Cormorant Garamond', Georgia, 'Gulim', '굴림', serif" font-style="italic" font-size="15" letter-spacing="6" fill="#E8E6DA" opacity="0.85">{{stage_label}}</text>

    ${colHeaders}
    ${verticalDivider}
    ${body}

    ${citiesFooter()}
  `);
}

// 10 pairs (본선) — single column with mid separator at row 5
export function pairingSvg10(): string {
  let rows = '';
  const rowH = 40;
  const groupGap = 10;
  const startY = 230;
  for (let i = 1; i <= 10; i++) {
    const groupOffset = i > 5 ? groupGap : 0;
    const y = startY + (i - 1) * rowH + groupOffset;
    const delay = (i * 0.07).toFixed(2);
    const isStripe = i % 2 === 0;
    const stripe = isStripe
      ? `<rect x="100" y="${y - 19}" width="1080" height="38" rx="5" fill="#0F2C20" opacity="0.6"/>`
      : '';
    rows += `
      ${stripe}
      <g transform="translate(0 ${y})" opacity="0">
        <animate attributeName="opacity" values="0;1" dur="0.5s" begin="${delay}s" fill="freeze"/>
        <g transform="translate(140 0)">
          <rect x="-32" y="-15" width="64" height="30" rx="15" fill="url(#goldg)" opacity="0.22"/>
          <rect x="-32" y="-15" width="64" height="30" rx="15" fill="none" stroke="#9C7C2C" stroke-width="1"/>
          <text y="6" text-anchor="middle" font-family="ui-monospace, monospace" font-size="15" letter-spacing="1" fill="#FFD56B" font-weight="700">{{leader_num_${i}}}</text>
        </g>
        <text x="340" y="10" text-anchor="end" font-family="'Gulim', '굴림', sans-serif" font-size="28" font-weight="700" fill="#FFEBA0">{{leader_${i}}}</text>
        <text x="940" y="10" text-anchor="start" font-family="'Gulim', '굴림', sans-serif" font-size="28" font-weight="700" fill="#FFEBA0">{{follower_${i}}}</text>
        <g transform="translate(1140 0)">
          <rect x="-32" y="-15" width="64" height="30" rx="15" fill="url(#goldg)" opacity="0.22"/>
          <rect x="-32" y="-15" width="64" height="30" rx="15" fill="none" stroke="#9C7C2C" stroke-width="1"/>
          <text y="6" text-anchor="middle" font-family="ui-monospace, monospace" font-size="15" letter-spacing="1" fill="#FFD56B" font-weight="700">{{follower_num_${i}}}</text>
        </g>
      </g>
    `;
  }
  const midSepY = startY + 5 * rowH + Math.floor(groupGap / 2) - 5;
  const midSep = `
    <line x1="180" y1="${midSepY}" x2="540" y2="${midSepY}" stroke="#D4AF37" stroke-width="0.5" opacity="0.5" stroke-dasharray="4 5"/>
    <line x1="740" y1="${midSepY}" x2="1100" y2="${midSepY}" stroke="#D4AF37" stroke-width="0.5" opacity="0.5" stroke-dasharray="4 5"/>
    <text x="640" y="${midSepY + 4}" text-anchor="middle" font-family="'Cormorant Garamond', Georgia, 'Gulim', '굴림', serif" font-size="11" fill="#D4AF37" opacity="0.65">✦</text>
  `;

  return shell(`
    ${topHeader()}
    <text x="640" y="146" text-anchor="middle" font-family="'Cinzel', 'Cormorant Garamond', Georgia, 'Gulim', '굴림', serif" font-weight="bold" font-size="36" letter-spacing="10" fill="url(#goldg)">{{round_title}}</text>
    <text x="640" y="176" text-anchor="middle" font-family="'Cormorant Garamond', Georgia, 'Gulim', '굴림', serif" font-style="italic" font-size="15" letter-spacing="6" fill="#E8E6DA" opacity="0.85">{{stage_label}}</text>

    <g transform="translate(0 206)">
      <text x="340" y="0" text-anchor="end" font-family="ui-monospace, monospace" font-size="11" letter-spacing="5" fill="#D4AF37">{{label_leader}}</text>
      <text x="940" y="0" text-anchor="start" font-family="ui-monospace, monospace" font-size="11" letter-spacing="5" fill="#D4AF37">{{label_follower}}</text>
      <line x1="120" y1="14" x2="540" y2="14" stroke="url(#goldgh)" stroke-width="0.5" opacity="0.6"/>
      <line x1="740" y1="14" x2="1160" y2="14" stroke="url(#goldgh)" stroke-width="0.5" opacity="0.6"/>
    </g>

    ${midSep}
    ${rows}

    ${citiesFooter()}
  `);
}

// 5 pairs — 미사용(현재 디자인 1번에서 사용 안 함). 폴백용으로 유지.
export function pairingSvg5(): string {
  let rows = '';
  const rowH = 60;
  const startY = 260;
  for (let i = 1; i <= 5; i++) {
    const y = startY + (i - 1) * rowH;
    const delay = (i * 0.1).toFixed(2);
    rows += `
      <g transform="translate(0 ${y})" opacity="0">
        <animate attributeName="opacity" values="0;1" dur="0.6s" begin="${delay}s" fill="freeze"/>
        <text x="240" y="0" text-anchor="end" font-family="'Cormorant Garamond', Georgia, 'Gulim', '굴림', serif" font-size="30" font-weight="500" fill="#FFEBA0">{{leader_${i}}}</text>
        <text x="240" y="22" text-anchor="end" font-family="ui-monospace, monospace" font-size="11" letter-spacing="3" fill="#9C7C2C">{{leader_num_${i}}}</text>
        <g transform="translate(640 -4)">
          <line x1="-200" y1="0" x2="-30" y2="0" stroke="#9C7C2C" stroke-width="0.7" opacity="0.7"/>
          <circle r="22" fill="none" stroke="url(#goldg)" stroke-width="1.4"/>
          <circle r="14" fill="url(#goldg)" opacity="0.18"/>
          <text y="7" text-anchor="middle" font-family="'Cormorant Garamond', Georgia, 'Gulim', '굴림', serif" font-size="20" font-weight="600" fill="#FFD56B">${i.toString().padStart(2, '0')}</text>
          <line x1="30" y1="0" x2="200" y2="0" stroke="#9C7C2C" stroke-width="0.7" opacity="0.7"/>
        </g>
        <text x="1040" y="0" text-anchor="start" font-family="'Cormorant Garamond', Georgia, 'Gulim', '굴림', serif" font-size="30" font-weight="500" fill="#FFEBA0">{{follower_${i}}}</text>
        <text x="1040" y="22" text-anchor="start" font-family="ui-monospace, monospace" font-size="11" letter-spacing="3" fill="#9C7C2C">{{follower_num_${i}}}</text>
      </g>
    `;
  }
  return shell(`
    ${topHeader()}
    <text x="640" y="160" text-anchor="middle" font-family="'Cinzel', 'Cormorant Garamond', Georgia, 'Gulim', '굴림', serif" font-weight="bold" font-size="44" letter-spacing="12" fill="url(#goldg)">{{round_title}}</text>
    <text x="640" y="194" text-anchor="middle" font-family="'Cormorant Garamond', Georgia, 'Gulim', '굴림', serif" font-style="italic" font-size="16" letter-spacing="6" fill="#E8E6DA" opacity="0.85">{{stage_label}}</text>

    <g transform="translate(0 234)">
      <text x="240" y="0" text-anchor="end" font-family="ui-monospace, monospace" font-size="12" letter-spacing="5" fill="#D4AF37">{{label_leader}}</text>
      <text x="640" y="0" text-anchor="middle" font-family="ui-monospace, monospace" font-size="12" letter-spacing="5" fill="#9A98A8">PAIR</text>
      <text x="1040" y="0" text-anchor="start" font-family="ui-monospace, monospace" font-size="12" letter-spacing="5" fill="#D4AF37">{{label_follower}}</text>
    </g>

    ${rows}

    ${citiesFooter()}
  `);
}

/**
 * 페어 수에 따라 적절한 변형 선택. 디자인 1번 기준:
 *   prelim = 11~25 pairs, semi = 10 pairs.
 *   그 외(예: 12) — 가장 가까운 변형으로 폴백 (≥11 → 예선 2열, 6~10 → 10, ≤5 → 5)
 */
export function pickPairingSvg(pairCount: number): string {
  if (pairCount >= 11) return pairingSvg20(pairCount);
  if (pairCount >= 6) return pairingSvg10();
  return pairingSvg5();
}
