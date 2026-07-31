// Template 05 — PREP (예선/본선 공통).
// 좌측 정렬 히어로: [강조 바][작은 스테이지 라벨][대형 라운드명][부제][참가 규모].
// 우측은 배경 사진이 그대로 보이는 여백 — 텍스트와 이미지가 서로 침범하지 않는다.
import { shell, topBar, footBar, accentBar, rule, metaLabel, DISPLAY, BODY, PAPER, DIM, ACCENT, MX } from '../common';

export function prepSvg(): string {
  return shell(`
    ${topBar('')}

    ${accentBar(212, 176)}

    ${metaLabel(MX + 26, 238, '{{stage_label}}', { size: 15, tracking: 9 })}

    <text x="${MX + 24}" y="${330}" font-family="${DISPLAY}" font-weight="600" font-size="86"
      letter-spacing="1.5" fill="${PAPER}">{{round_title}}</text>

    ${rule(360, MX + 24, MX + 420, 0.5, ACCENT)}

    <text x="${MX + 26}" y="${404}" font-family="${BODY}" font-weight="300" font-size="27"
      letter-spacing="6" fill="${DIM}">{{round_subtitle}}</text>

    ${metaLabel(MX + 26, 462, '{{participants}}', { size: 14, tracking: 5, fill: ACCENT })}

    ${footBar()}
  `);
}
