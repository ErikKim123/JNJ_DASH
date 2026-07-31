// Template 06 — PREP (예선/본선 공통).
// 초대장 구성: 스테이지 라벨 → 대형 세리프 제목 → 오너먼트 → 부제 → 참가 규모.
// 모든 요소가 세로 중심축에 정렬돼 시선이 위에서 아래로 한 번에 흐른다.
import { shell, topBar, footBar, ornament, metaLabel, DISPLAY, BODY, INK, INK_SOFT, ACCENT, CX } from '../common';

export function prepSvg(): string {
  return shell(`
    ${topBar()}

    ${metaLabel(CX, 218, '{{stage_label}}', { size: 15, tracking: 12 })}

    <text x="${CX}" y="${330}" text-anchor="middle" font-family="${DISPLAY}" font-weight="700"
      font-size="76" letter-spacing="4" fill="${INK}">{{round_title}}</text>

    ${ornament(374, 240)}

    <text x="${CX}" y="${424}" text-anchor="middle" font-family="${BODY}" font-weight="300"
      font-size="25" letter-spacing="8" fill="${INK_SOFT}">{{round_subtitle}}</text>

    ${metaLabel(CX, 486, '{{participants}}', { size: 14, tracking: 6, fill: ACCENT })}

    ${footBar()}
  `);
}
