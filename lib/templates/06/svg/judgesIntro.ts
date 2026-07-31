// Template 06 — 심사위원 소개.
// 카드 그리드는 공용 레이아웃(shared/judgesIntro)을 쓰고, 타이틀은 06 의 중앙 헤더로 대체.
import { shell, topBar, footBar, hairline, metaLabel, DISPLAY, BODY, INK, INK_SOFT, ACCENT, CX, MX, RX } from '../common';
import { judgesIntroContent } from '../../shared/judgesIntro';

export function judgesIntroSvg(count: number): string {
  return shell(`
    ${topBar()}

    ${metaLabel(CX, 164, '{{stage_label}}', { size: 13, tracking: 10 })}
    <text x="${CX}" y="${210}" text-anchor="middle" font-family="${DISPLAY}" font-weight="700"
      font-size="46" letter-spacing="6" fill="${INK}">{{intro_title}}</text>
    <text x="${CX}" y="${238}" text-anchor="middle" font-family="${BODY}" font-weight="300"
      font-size="15" letter-spacing="5" fill="${INK_SOFT}">{{intro_subtitle}}</text>
    ${hairline(258, MX, RX, 0.16)}

    ${judgesIntroContent({
      count,
      hideTitle: true,
      contentTop: 278,
      contentBottom: 578,
      paddingX: MX,
      theme: {
        name: INK,
        alias: ACCENT,
        ring: ACCENT,
        ringSoft: INK,
        cardBg: 'url(#hxg)',
        title: INK,
        eyebrow: ACCENT,
        subtitle: INK_SOFT,
        displayFont: DISPLAY,
        bodyFont: BODY,
        nameFont: BODY,
        italicMeta: false,
      },
    })}

    ${footBar()}
  `);
}
