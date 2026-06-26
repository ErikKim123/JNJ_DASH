// Design Ref: §2.3, §11.1 — Template 01 (Jeju Bachata Art Deco) 진입점.
// (round, data) 조합 → SVG 생성기 매핑 + placeholder 치환을 한 곳에서 처리.
// 변경: step 파라미터 대신 data.kind 기반 분기 (race condition 방지).
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

// step 파라미터는 디버그/로깅 용도로만 유지 (선택)
function selectSvg(round: RoundKey, _step: StepKey, data: StepDataPayload): string {
  // Final round 전용 SVG (kind 기반 분기 — 데이터 형태와 일치)
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
        return finalPairingSvg(); // 폴백 (라우트 레벨 차단됨)
      case 'open':
        return openSvg();
      case 'live':
        return liveSvg();
      case 'close':
        return closeSvg();
      case 'judgesIntro':
        // 결승에는 노출 안 함 — 라우트 차단이지만 안전한 폴백.
        return judgesIntroSvg(data.data.judges?.length ?? 0);
    }
  }

  // prelim / semi 공통 — data.kind 기반 분기
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

function applyBackgroundOverride(svg: string, override?: string, opacityPct?: number): string {
  const marker = '<!--BG_OVERRIDE_SLOT-->';
  if (!override) return svg.replace(marker, '');
  const safe = override.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const clamped = Math.max(0, Math.min(100, typeof opacityPct === 'number' && !Number.isNaN(opacityPct) ? opacityPct : 100));
  const op = (clamped / 100).toString();
  const img = `<image href="${safe}" x="0" y="0" width="1280" height="720" preserveAspectRatio="xMidYMid slice" opacity="${op}"/>`;
  return svg.replace(marker, img);
}

export const Template01: TemplateModule = {
  id: 1,
  name: 'Jeju Bachata Art Deco',
  render(round, step, data, opts) {
    const svg = selectSvg(round, step, data);
    const placeholders = flattenStepData(data);
    const filled = applyPlaceholders(svg, placeholders);
    return applyBackgroundOverride(filled, opts?.backgroundOverride, opts?.backgroundOpacity);
  },
};
