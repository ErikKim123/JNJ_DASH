// Template 06 — PAIRING.
// 도록의 목록(index) 페이지처럼 조 편성을 "표"로 읽힌다.
//   · 행마다 얇은 밑줄 → 눈이 가로로 미끄러지지 않는다.
//   · 순번(모노, 흐린 잉크) / 리더(골드) / 팔로워(딥 틸) 3개 필드가 항상 같은 x 에 온다.
//   · 인원이 늘면 열을 나눠 행 높이를 지킨다 (글자를 줄이지 않는다).
import {
  shell, topBar, footBar, hairline, metaLabel, panel,
  DISPLAY, MONO, INK, INK_SOFT, ACCENT, TEAL, LINE, CX, MX, RX,
} from '../common';
import { circlePairingLayout } from '../../shared/circlePairing';

// 헤더 블록(스테이지 라벨·제목·구분선)을 통째로 내리는 양.
// 지면 하단의 태그라인·스폰서 구역이 비어 있는 대회에선 화면이 위로 쏠려 보인다.
// 라벨 구간은 푸터 헤어라인(FOOT_RULE_Y=592) 여백을 지켜야 해서 같은 양만큼은 못 내려가므로,
// 위쪽을 더 잘라 내리는 방식으로 블록 중심을 함께 내린다.
const SHIFT = 16;
const STAGE_Y = 166 + SHIFT;
const TITLE_Y = 212 + SHIFT;
const RULE_Y = 232 + SHIFT;

const TOP = 268;
const BOTTOM = 574;

/**
 * 원형(타원) 배치 — 목록 대신 커플을 원 둘레에 놓는다.
 * 06 도 번호만 쓰는 템플릿이라 원형에서도 L###/F### 코드만 표기한다.
 */
function renderCircle(pairCount: number): string {
  const count = Math.max(1, Math.min(30, pairCount));
  const L = circlePairingLayout(count, { band: [266, 584], withNames: false, ryScale: 1.3 });
  const fs = L.fontSize;

  const body = L.slots
    .map(
      (s) => `
      <g opacity="0">
        <animate attributeName="opacity" values="0;1" dur="0.4s" begin="${s.delay}s" fill="freeze"/>
        <g transform="translate(${s.x} ${s.y})">
          <text text-anchor="${s.anchor}" y="0" font-family="${MONO}" font-size="${fs}"
            font-weight="700" letter-spacing="0.5" fill="${ACCENT}">L{{leader_num_${s.i}}}</text>
          <text text-anchor="${s.anchor}" y="${L.lineH}" font-family="${MONO}" font-size="${fs}"
            font-weight="700" letter-spacing="0.5" fill="${TEAL}">F{{follower_num_${s.i}}}</text>
          <line x1="${s.flourishX1}" y1="${s.flourishY}" x2="${s.flourishX2}" y2="${s.flourishY}"
            stroke="${LINE}" stroke-opacity="0.2" stroke-width="1"/>
        </g>
      </g>
    `
    )
    .join('');

  const centerMark = `
    <g transform="translate(${L.cx} ${L.cy})" opacity="0">
      <animate attributeName="opacity" values="0;1" dur="0.9s" begin="0s" fill="freeze"/>
      <line x1="-28" y1="0" x2="28" y2="0" stroke="${ACCENT}" stroke-opacity="0.5" stroke-width="1"/>
      ${metaLabel(0, 24, 'STAGE', { size: 12, tracking: 8, anchor: 'middle', fill: INK_SOFT })}
    </g>
  `;

  return shell(`
    ${topBar()}

    ${metaLabel(CX, STAGE_Y, '{{stage_label}}', { size: 13, tracking: 10 })}
    <text x="${CX}" y="${TITLE_Y}" text-anchor="middle" font-family="${DISPLAY}" font-weight="700"
      font-size="44" letter-spacing="4" fill="${INK}">{{round_title}}</text>
    ${metaLabel(RX, TITLE_Y, `${count} COUPLES`, { size: 12, tracking: 4, anchor: 'end', fill: INK_SOFT })}
    ${hairline(RULE_Y, MX, RX, 0.18)}

    ${centerMark}
    ${body}

    ${footBar()}
  `);
}

function renderList(pairCount: number): string {
  const count = Math.max(1, Math.min(25, pairCount));
  const cols = count <= 8 ? 1 : count <= 16 ? 2 : 3;
  const gap = 44;
  const colW = (RX - MX - gap * (cols - 1)) / cols;
  const perCol = Math.ceil(count / cols);
  const rowH = Math.min(46, (BOTTOM - TOP) / perCol);
  const fs = Math.max(12, Math.min(23, rowH * 0.52));
  const blockH = rowH * perCol;
  const top = TOP + (BOTTOM - TOP - blockH) / 2;

  let rows = '';
  for (let i = 1; i <= count; i++) {
    const col = Math.floor((i - 1) / perCol);
    const idxInCol = (i - 1) % perCol;
    const x0 = MX + col * (colW + gap);
    const cy = top + idxInCol * rowH + rowH / 2;
    const baseline = cy + fs * 0.35;
    rows += `
      <g opacity="0">
        <animate attributeName="opacity" values="0;1" dur="0.4s" begin="${(0.2 + i * 0.04).toFixed(2)}s" fill="freeze"/>
        <text x="${x0 + 2}" y="${baseline.toFixed(1)}" font-family="${MONO}" font-size="${(fs * 0.66).toFixed(1)}"
          letter-spacing="1" fill="${INK_SOFT}" opacity="0.8">${String(i).padStart(2, '0')}</text>
        <text x="${(x0 + colW * 0.46).toFixed(1)}" y="${baseline.toFixed(1)}" text-anchor="end" font-family="${MONO}"
          font-size="${fs.toFixed(1)}" font-weight="700" letter-spacing="0.5" fill="${ACCENT}">L{{leader_num_${i}}}</text>
        <text x="${(x0 + colW * 0.5).toFixed(1)}" y="${baseline.toFixed(1)}" text-anchor="middle" font-family="${MONO}"
          font-size="${(fs * 0.7).toFixed(1)}" fill="${LINE}" opacity="0.35">·</text>
        <text x="${(x0 + colW * 0.54).toFixed(1)}" y="${baseline.toFixed(1)}" text-anchor="start" font-family="${MONO}"
          font-size="${fs.toFixed(1)}" font-weight="700" letter-spacing="0.5" fill="${TEAL}">F{{follower_num_${i}}}</text>
        <line x1="${x0}" y1="${(cy + rowH / 2).toFixed(1)}" x2="${(x0 + colW).toFixed(1)}" y2="${(cy + rowH / 2).toFixed(1)}"
          stroke="${LINE}" stroke-opacity="0.13" stroke-width="1"/>
      </g>
    `;
  }

  return shell(`
    ${topBar()}

    ${metaLabel(CX, STAGE_Y, '{{stage_label}}', { size: 13, tracking: 10 })}
    <text x="${CX}" y="${TITLE_Y}" text-anchor="middle" font-family="${DISPLAY}" font-weight="700"
      font-size="44" letter-spacing="4" fill="${INK}">{{round_title}}</text>
    ${metaLabel(RX, TITLE_Y, `${count} COUPLES`, { size: 12, tracking: 4, anchor: 'end', fill: INK_SOFT })}
    ${hairline(RULE_Y, MX, RX, 0.18)}

    ${panel(MX - 16, top - 14, RX - MX + 32, blockH + 28, 0.4)}
    ${rows}

    ${footBar()}
  `);
}

export function pickPairingSvg(pairCount: number, pairCircle = false): string {
  return pairCircle ? renderCircle(pairCount) : renderList(pairCount);
}
