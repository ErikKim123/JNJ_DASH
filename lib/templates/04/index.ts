// Template 04 — Template 03 사본에서 고정 그래픽(JLCF 골드 스탬프 로고, 돌하르방)만 제거한 변형.
// 배경/타이포/레이아웃은 03과 동일하므로, 대회 로고를 배경 이미지에 직접 넣거나
// 로고 없이 텍스트만 노출하고 싶을 때 이 템플릿을 쓴다.
// 배경 이미지: public/templates/02/background.jpg (03과 공유)
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
import { shell, topHeader } from './svg/common';
import { renderReportSvg } from '../shared/reportSvg';

function selectSvg(round: RoundKey, _step: StepKey, data: StepDataPayload, pairCircle = false): string {
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
        return renderReportSvg(data.data, shell, topHeader);
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
      return pickPairingSvg(data.data.pairs?.length ?? 0, pairCircle);
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
    case 'report':
      // 보고서는 SVG 템플릿이 아닌 React 표(FinalReport)로 렌더 — 여기 도달하지 않음.
      return '';
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

export const Template04: TemplateModule = {
  id: 4,
  name: 'Jeju Latin Culture Festival — No Logo (04)',
  render(round, step, data, opts) {
    const svg = selectSvg(round, step, data, opts?.pairCircle);
    const placeholders = flattenStepData(data);
    const filled = applyPlaceholders(svg, placeholders);
    return applyBackgroundOverride(filled, opts?.backgroundOverride, opts?.backgroundOpacity);
  },
};
