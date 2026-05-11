// Design Ref: §11.1 #6 — Result 스크린 (예선/본선의 통과자 명단, hexagon style)
import { shell, topHeader, citiesFooter, hexagonFrame, trophyIcon } from './common';

export function resultListSvg(count: number): string {
  let cfg: { namesPerRow: number; hexSize: number; spacingX: number; rowH: number; nameSize: number; startY: number };
  // 본선 case(주로 7~8명) — 3+4 또는 4+4 균형 레이아웃을 위해 4 cols + 짧은 행 상단 배치.
  let reverseRowOrder = false;
  if (count <= 3) {
    cfg = { namesPerRow: 3, hexSize: 56, spacingX: 168, rowH: 0, nameSize: 22, startY: 410 };
  } else if (count <= 6) {
    cfg = { namesPerRow: 3, hexSize: 42, spacingX: 134, rowH: 150, nameSize: 17, startY: 348 };
  } else if (count <= 8) {
    // 본선 7~8명 — 4 cols × 2 rows. 짧은 행을 상단에 배치(3+4).
    cfg = { namesPerRow: 4, hexSize: 34, spacingX: 120, rowH: 134, nameSize: 16, startY: 332 };
    reverseRowOrder = true;
  } else if (count <= 10) {
    // 예선 10명 case — 좌우 여백 ~40px 확보, 인접 이름과도 균형 잡힌 spacing.
    cfg = { namesPerRow: 5, hexSize: 30, spacingX: 110, rowH: 124, nameSize: 14, startY: 316 };
  } else if (count <= 15) {
    // 5 cols × 3 rows
    cfg = { namesPerRow: 5, hexSize: 26, spacingX: 100, rowH: 104, nameSize: 13, startY: 280 };
  } else if (count <= 20) {
    // 5 cols × 4 rows
    cfg = { namesPerRow: 5, hexSize: 22, spacingX: 88, rowH: 88, nameSize: 12, startY: 260 };
  } else {
    // 5 cols × 5 rows (최대 25명 지원)
    cfg = { namesPerRow: 5, hexSize: 20, spacingX: 82, rowH: 78, nameSize: 11, startY: 248 };
  }
  const totalRows = Math.ceil(count / cfg.namesPerRow);
  const leaderCx = count <= 6 ? 320 : count <= 8 ? 310 : count <= 10 ? 290 : 270;
  const followerCx = count <= 6 ? 960 : count <= 8 ? 970 : count <= 10 ? 990 : 1010;
  // 짧은 행 우선 배치 시 상단 행 인원 (정수). 그 외엔 마지막 행이 짧음.
  const firstRowItems =
    reverseRowOrder && totalRows > 1
      ? count - cfg.namesPerRow * (totalRows - 1)
      : Math.min(cfg.namesPerRow, count);

  let leaderHexes = '';
  let followerHexes = '';
  for (let i = 1; i <= count; i++) {
    let row: number;
    let colInRow: number;
    let itemsThisRow: number;
    if (reverseRowOrder && totalRows > 1) {
      if (i <= firstRowItems) {
        row = 0;
        colInRow = i - 1;
        itemsThisRow = firstRowItems;
      } else {
        const idxInRest = i - firstRowItems - 1;
        row = Math.floor(idxInRest / cfg.namesPerRow) + 1;
        colInRow = idxInRest % cfg.namesPerRow;
        itemsThisRow = cfg.namesPerRow;
      }
    } else {
      row = Math.floor((i - 1) / cfg.namesPerRow);
      colInRow = (i - 1) % cfg.namesPerRow;
      itemsThisRow = row < totalRows - 1 ? cfg.namesPerRow : count - row * cfg.namesPerRow;
    }
    const rowOffsetX = -((itemsThisRow - 1) / 2) * cfg.spacingX;
    const x = rowOffsetX + colInRow * cfg.spacingX;
    const y = cfg.startY + row * cfg.rowH;
    const delay = i * 0.12;
    leaderHexes += hexagonFrame(leaderCx + x, y, `{{result_leader_${i}}}`, cfg.hexSize, delay, cfg.nameSize, `{{result_leader_num_${i}}}`, `{{result_leader_photo_${i}}}`);
    followerHexes += hexagonFrame(followerCx + x, y, `{{result_follower_${i}}}`, cfg.hexSize, delay + 0.04, cfg.nameSize, `{{result_follower_num_${i}}}`, `{{result_follower_photo_${i}}}`);
  }

  const trophyY = totalRows === 1 ? cfg.startY : cfg.startY + ((totalRows - 1) * cfg.rowH) / 2;
  const trophyScale =
    count <= 3 ? 1.1 :
    count <= 6 ? 0.95 :
    count <= 8 ? 0.85 :
    count <= 10 ? 0.78 :
    count <= 15 ? 0.65 :
    count <= 20 ? 0.55 :
    0.5;
  const headerY = cfg.startY - 60;

  return shell(`
    ${topHeader()}
    <text x="640" y="156" text-anchor="middle" font-family="Georgia, 'Gulim', '굴림', serif" font-weight="bold" font-size="50" letter-spacing="10" fill="url(#goldg)">{{result_title}}</text>
    <text x="640" y="190" text-anchor="middle" font-family="Georgia, 'Gulim', '굴림', serif" font-style="italic" font-size="17" letter-spacing="6" fill="#E8E6DA" opacity="0.9">{{result_subtitle}}</text>

    <g transform="translate(0 ${headerY})">
      <text x="${leaderCx}" y="0" text-anchor="middle" font-family="ui-monospace, monospace" font-size="22" font-weight="600" letter-spacing="8" fill="#D4AF37">{{label_leader}}</text>
      <text x="${followerCx}" y="0" text-anchor="middle" font-family="ui-monospace, monospace" font-size="22" font-weight="600" letter-spacing="8" fill="#D4AF37">{{label_follower}}</text>
      <line x1="${leaderCx - 110}" y1="18" x2="${leaderCx + 110}" y2="18" stroke="url(#goldgh)" stroke-width="0.6"/>
      <line x1="${followerCx - 110}" y1="18" x2="${followerCx + 110}" y2="18" stroke="url(#goldgh)" stroke-width="0.6"/>
    </g>

    ${trophyIcon(640, trophyY, trophyScale)}

    ${leaderHexes}
    ${followerHexes}

    ${citiesFooter()}
  `);
}
