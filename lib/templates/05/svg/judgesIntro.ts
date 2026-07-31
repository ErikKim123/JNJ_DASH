// Template 05 — 심사위원 소개.
// 카드 그리드 자체는 공용 레이아웃(shared/judgesIntro)을 쓰되, 타이틀 블록은 05 의
// 좌측 정렬 헤더로 대체(hideTitle)하고 팔레트/폰트만 05 로 덮어쓴다.
import { shell, topBar, footBar, accentBar, rule, metaLabel, DISPLAY, BODY, PAPER, DIM, ACCENT, MX, RX } from '../common';
import { judgesIntroContent } from '../../shared/judgesIntro';

export function judgesIntroSvg(count: number): string {
  return shell(`
    ${topBar('')}

    ${accentBar(140, 78)}
    ${metaLabel(MX + 26, 164, '{{stage_label}}', { size: 13, tracking: 8 })}
    <text x="${MX + 24}" y="${212}" font-family="${DISPLAY}" font-weight="600" font-size="50"
      letter-spacing="2" fill="${PAPER}">{{intro_title}}</text>
    <text x="${RX}" y="${212}" text-anchor="end" font-family="${BODY}" font-weight="300" font-size="18"
      letter-spacing="4" fill="${DIM}">{{intro_subtitle}}</text>
    ${rule(234, MX, RX, 0.16)}

    ${judgesIntroContent({
      count,
      hideTitle: true,
      contentTop: 268,
      contentBottom: 614,
      paddingX: MX,
      theme: {
        name: PAPER,
        alias: ACCENT,
        ring: ACCENT,
        ringSoft: PAPER,
        cardBg: 'url(#hxg)',
        title: PAPER,
        eyebrow: ACCENT,
        subtitle: DIM,
        displayFont: DISPLAY,
        bodyFont: BODY,
        nameFont: BODY,
        italicMeta: false,
      },
    })}

    ${footBar()}
  `);
}
