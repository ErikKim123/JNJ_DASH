// Design Ref: §11.1 #6 — Result 스크린 (예선/본선의 통과자 명단, hexagon style)
import { shell, topHeader, citiesFooter, hexagonFrame, trophyIcon } from './common';

export function resultListSvg(count: number): string {
  let cfg: { namesPerRow: number; hexSize: number; spacingX: number; rowH: number; nameSize: number; startY: number };
  if (count <= 3) {
    cfg = { namesPerRow: 3, hexSize: 56, spacingX: 168, rowH: 0, nameSize: 22, startY: 410 };
  } else if (count <= 6) {
    cfg = { namesPerRow: 3, hexSize: 42, spacingX: 134, rowH: 150, nameSize: 17, startY: 348 };
  } else {
    // 예선 10명 case — 좌우 여백 ~40px 확보, 인접 이름과도 균형 잡힌 spacing.
    cfg = { namesPerRow: 5, hexSize: 30, spacingX: 110, rowH: 124, nameSize: 14, startY: 316 };
  }
  const totalRows = Math.ceil(count / cfg.namesPerRow);
  const leaderCx = count <= 6 ? 320 : 290;
  const followerCx = count <= 6 ? 960 : 990;

  let leaderHexes = '';
  let followerHexes = '';
  for (let i = 1; i <= count; i++) {
    const row = Math.floor((i - 1) / cfg.namesPerRow);
    const colInRow = (i - 1) % cfg.namesPerRow;
    const itemsThisRow = row < totalRows - 1 ? cfg.namesPerRow : count - row * cfg.namesPerRow;
    const rowOffsetX = -((itemsThisRow - 1) / 2) * cfg.spacingX;
    const x = rowOffsetX + colInRow * cfg.spacingX;
    const y = cfg.startY + row * cfg.rowH;
    const delay = i * 0.12;
    leaderHexes += hexagonFrame(leaderCx + x, y, `{{result_leader_${i}}}`, cfg.hexSize, delay, cfg.nameSize, `{{result_leader_num_${i}}}`, `{{result_leader_photo_${i}}}`);
    followerHexes += hexagonFrame(followerCx + x, y, `{{result_follower_${i}}}`, cfg.hexSize, delay + 0.04, cfg.nameSize, `{{result_follower_num_${i}}}`, `{{result_follower_photo_${i}}}`);
  }

  const trophyY = totalRows === 1 ? cfg.startY : cfg.startY + ((totalRows - 1) * cfg.rowH) / 2;
  const trophyScale = count <= 3 ? 1.1 : count <= 6 ? 0.95 : 0.78;
  const headerY = cfg.startY - 60;

  return shell(`
    ${topHeader()}
    <text x="640" y="156" text-anchor="middle" font-family="Georgia, 'Gulim', '굴림', serif" font-weight="bold" font-size="50" letter-spacing="10" fill="url(#goldg)">{{result_title}}</text>
    <text x="640" y="190" text-anchor="middle" font-family="Georgia, 'Gulim', '굴림', serif" font-style="italic" font-size="17" letter-spacing="6" fill="#E8E6DA" opacity="0.9">{{result_subtitle}}</text>

    <g transform="translate(0 ${headerY})">
      <text x="${leaderCx}" y="0" text-anchor="middle" font-family="ui-monospace, monospace" font-size="13" letter-spacing="6" fill="#D4AF37">{{label_leader}}</text>
      <text x="${followerCx}" y="0" text-anchor="middle" font-family="ui-monospace, monospace" font-size="13" letter-spacing="6" fill="#D4AF37">{{label_follower}}</text>
      <line x1="${leaderCx - 90}" y1="14" x2="${leaderCx + 90}" y2="14" stroke="url(#goldgh)" stroke-width="0.5"/>
      <line x1="${followerCx - 90}" y1="14" x2="${followerCx + 90}" y2="14" stroke="url(#goldgh)" stroke-width="0.5"/>
    </g>

    ${trophyIcon(640, trophyY, trophyScale)}

    ${leaderHexes}
    ${followerHexes}

    ${citiesFooter()}
  `);
}
