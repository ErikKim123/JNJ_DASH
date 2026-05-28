// 심사위원 소개 화면 — 예선 PREP 다음. 공용 layout (judgesIntroContent) 사용.
import { shell, heroHeader, citiesFooter } from './common';
import { judgesIntroContent } from '../../shared/judgesIntro';

export function judgesIntroSvg(count: number): string {
  return shell(`
    ${heroHeader()}
    ${judgesIntroContent({ count })}
    ${citiesFooter(700)}
  `);
}
