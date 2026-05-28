// Template 02 (JLCF — Jeju Latin Culture Festival) 진입점.
// 배경 이미지: DashDesignTemplates/02/2026배경.png (고객 제공)
// 레이아웃: 풀블리드 배경 (이미지 원본 그대로) + 좌우 사이드 패널에 동적 콘텐츠 표출
import type { TemplateModule } from '../types';
import type { RoundKey, StepDataPayload, StepKey } from '@/lib/sheets/types';
import { applyPlaceholders, flattenStepData } from '../placeholder';
import { prepSvg } from './svg/prep';
import { judgesIntroSvg } from './svg/judgesIntro';
import { pickPairingSvg } from './svg/pairing';
import { openSvg } from './svg/open';
import { liveSvg } from './svg/live';
import { wrapupSvg } from './svg/wrapup';
import { closeSvg } from './svg/close';
import { resultListSvg } from './svg/result';
import { finalPrepSvg, finalWrapupSvg, finalResultSvg, finalPairingSvg } from './svg/final';
import { ceremonySvg } from './svg/ceremony';

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
      const count = Math.max(
        data.data.leaders?.length ?? 0,
        data.data.followers?.length ?? 0
      );
      return resultListSvg(count);
    }
    case 'ceremony':
      // 비결승 라운드에서는 일반적으로 도달 불가 (라우트 차단) — 안전한 폴백.
      return ceremonySvg();
  }
}

/**
 * shell() 안의 <!--BG_OVERRIDE_SLOT--> 마커를 커스텀 배경 <image> 로 치환.
 * URL 비어있으면 마커 제거 (기본 배경 유지).
 */
function applyBackgroundOverride(svg: string, override?: string, opacityPct?: number): string {
  const marker = '<!--BG_OVERRIDE_SLOT-->';
  if (!override) return svg.replace(marker, '');
  const safe = override.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const clamped = Math.max(0, Math.min(100, typeof opacityPct === 'number' && !Number.isNaN(opacityPct) ? opacityPct : 100));
  const op = (clamped / 100).toString();
  const img = `<image href="${safe}" x="0" y="0" width="1280" height="720" preserveAspectRatio="xMidYMid slice" opacity="${op}"/>`;
  return svg.replace(marker, img);
}

export const Template03: TemplateModule = {
  id: 3,
  name: 'Jeju Latin Culture Festival (03)',
  render(round, step, data, opts) {
    const svg = selectSvg(round, step, data);
    const placeholders = flattenStepData(data);
    const filled = applyPlaceholders(svg, placeholders);
    return applyBackgroundOverride(filled, opts?.backgroundOverride, opts?.backgroundOpacity);
  },
};
