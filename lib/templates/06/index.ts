// Template 06 — "IVORY GALLERY".
// 배경 위에 거의 불투명한 아이보리 지면을 얹고 그 위에 진한 잉크색 글자를 쓴다.
// 배경이 흰색이든 검정 사진이든 지면 안쪽 명도가 고정되므로 대비가 항상 같다.
// 레이아웃은 중앙 대칭(전시 도록/초대장 문법) — 05 의 좌측 비대칭과 정반대.
import type { TemplateModule } from '../types';
import type { RoundKey, StepDataPayload, StepKey } from '@/lib/sheets/types';
import { applyPlaceholders, flattenStepData } from '../placeholder';
import { prepSvg } from './svg/prep';
import { judgesIntroSvg } from './svg/judgesIntro';
import { judgesVideoSvg } from './svg/judgesVideo';
import { pickPairingSvg } from './svg/pairing';
import { openSvg } from './svg/open';
import { liveSvg } from './svg/live';
import { wrapupSvg } from './svg/wrapup';
import { closeSvg } from './svg/close';
import { resultListSvg } from './svg/result';
import { finalPrepSvg, finalWrapupSvg, finalResultSvg, finalPairingSvg } from './svg/final';
import { ceremonySvg } from './svg/ceremony';
import { shell, topBar, DISPLAY, BODY, MONO, PAPER, INK, ACCENT, TEAL, ROSE } from './common';
import { renderReportSvg } from '../shared/reportSvg';

const REPORT_THEME = {
  accent: ACCENT,
  text: INK,
  silver: TEAL,
  bronze: ROSE,
  goldFill: ACCENT,
  medalText: PAPER,
  rowBg: '#EFE8D9',
  rowBgOpacity: 0.55,
  topRowBgOpacity: 0.2,
  display: DISPLAY,
  body: BODY,
  mono: MONO,
  italic: false,
} as const;

function selectSvg(round: RoundKey, _step: StepKey, data: StepDataPayload): string {
  if (round === 'final') {
    switch (data.kind) {
      case 'prep':
        return finalPrepSvg();
      case 'wrapup':
        return finalWrapupSvg();
      case 'result':
        return finalResultSvg();
      case 'ceremony':
        return ceremonySvg();
      case 'report':
        return renderReportSvg(data.data, shell, topBar, REPORT_THEME);
      case 'pairing':
        return finalPairingSvg();
      case 'open':
        return openSvg();
      case 'live':
        return liveSvg();
      case 'close':
        return closeSvg();
      case 'judgesIntro':
        return judgesIntroSvg(data.data.judges?.length ?? 0);
    }
  }

  switch (data.kind) {
    case 'prep':
      return prepSvg();
    case 'judgesIntro':
      return judgesIntroSvg(data.data.judges?.length ?? 0);
    case 'judgesVideo':
      return judgesVideoSvg(data.data.video_url ?? '');
    case 'pairing':
      return pickPairingSvg(data.data.pairs?.length ?? 0);
    case 'open':
      return openSvg();
    case 'live':
      return liveSvg();
    case 'wrapup':
      return wrapupSvg();
    case 'close':
      return closeSvg();
    case 'result': {
      const count = Math.max(data.data.leaders?.length ?? 0, data.data.followers?.length ?? 0);
      return resultListSvg(count);
    }
    case 'ceremony':
      return ceremonySvg();
    case 'report':
      return '';
  }
}

/** shell() 안의 <!--BG_OVERRIDE_SLOT--> 를 커스텀 배경 <image> 로 치환 (워시/지면 아래에 깔린다). */
function applyBackgroundOverride(svg: string, override?: string, opacityPct?: number): string {
  const marker = '<!--BG_OVERRIDE_SLOT-->';
  if (!override) return svg.replace(marker, '');
  const safe = override.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const clamped = Math.max(
    0,
    Math.min(100, typeof opacityPct === 'number' && !Number.isNaN(opacityPct) ? opacityPct : 100)
  );
  const img = `<image href="${safe}" x="0" y="0" width="1280" height="720" preserveAspectRatio="xMidYMid slice" opacity="${(clamped / 100).toString()}"/>`;
  return svg.replace(marker, img);
}

export const Template06: TemplateModule = {
  id: 6,
  name: 'Ivory Gallery — 라이트 에디토리얼 (06)',
  render(round, step, data, opts) {
    const svg = selectSvg(round, step, data);
    const placeholders = flattenStepData(data);
    const filled = applyPlaceholders(svg, placeholders);
    return applyBackgroundOverride(filled, opts?.backgroundOverride, opts?.backgroundOpacity);
  },
};
