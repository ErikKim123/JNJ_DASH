// Template 10 — 심사위원 소개.
// 카드 배치는 공용 레이아웃(shared/judgesIntro), 그 뒤에 화면 폭 전체의 유리 판을 깔아 07 톤으로 묶는다.
// 1명(hero) 레이아웃은 공용 좌표가 판 아래까지 내려오므로 판을 깔지 않는다.
import { shell, topBar, footBar, heading, waveCard, DISPLAY, WHITE, SOFT, ACCENT, MX, RX } from '../common';
import { judgesIntroContent } from '../../shared/judgesIntro';

export function judgesIntroSvg(count: number): string {
  return shell(`
    ${topBar()}
    ${heading('{{intro_title}}', `<tspan fill="${ACCENT}">{{stage_label}}</tspan>  ·  {{intro_subtitle}}`)}

    ${count >= 2 ? waveCard(MX, 170, RX - MX, 478, { rx: 24 }) : ''}

    ${judgesIntroContent({
      count,
      hideTitle: true,
      contentTop: 186,
      contentBottom: 632,
      paddingX: 64,
      theme: {
        eyebrow: ACCENT,
        title: WHITE,
        subtitle: SOFT,
        name: WHITE,
        alias: ACCENT,
        ring: 'url(#goldg)',
        ringSoft: WHITE,
        cardBg: 'url(#hxg)',
        displayFont: DISPLAY,
        bodyFont: DISPLAY,
        nameFont: DISPLAY,
        italicMeta: false,
      },
    })}

    ${footBar()}
  `);
}
