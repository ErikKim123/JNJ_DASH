// Template 02 (JLCF — Jeju Latin Culture Festival) 진입점.
// 배경 이미지: DashDisignTemplates/02/2026배경.png (고객 제공)
// 레이아웃: 풀블리드 배경 (이미지 원본 그대로) + 좌우 사이드 패널에 동적 콘텐츠 표출
import type { TemplateModule } from '../types';
import type { RoundKey, StepDataPayload, StepKey } from '@/lib/sheets/types';
import { applyPlaceholders, flattenStepData } from '../placeholder';
import { prepSvg } from './svg/prep';
import { pickPairingSvg } from './svg/pairing';
import { openSvg } from './svg/open';
import { liveSvg } from './svg/live';
import { wrapupSvg } from './svg/wrapup';
import { closeSvg } from './svg/close';
import { resultListSvg } from './svg/result';
import { finalPrepSvg, finalWrapupSvg, finalResultSvg, finalPairingSvg } from './svg/final';

function selectSvg(round: RoundKey, _step: StepKey, data: StepDataPayload): string {
  if (round === 'final') {
    switch (data.kind) {
      case 'prep':
        return finalPrepSvg();
      case 'wrapup':
        return finalWrapupSvg();
      case 'result':
        return finalResultSvg();
      case 'pairing':
        return finalPairingSvg();
      case 'open':
        return openSvg();
      case 'live':
        return liveSvg();
      case 'close':
        return closeSvg();
    }
  }

  switch (data.kind) {
    case 'prep':
      return prepSvg();
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
  }
}

export const Template02: TemplateModule = {
  id: 2,
  name: 'Jeju Latin Culture Festival',
  render(round, step, data) {
    const svg = selectSvg(round, step, data);
    const placeholders = flattenStepData(data);
    return applyPlaceholders(svg, placeholders);
  },
};
