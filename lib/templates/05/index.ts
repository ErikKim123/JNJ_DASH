// Template 05 — "MIDNIGHT EDITORIAL".
// 어떤 배경(어두운 사진 / 밝은 사진 / 단색)이 와도 텍스트 대비가 일정하도록
// 배경 위에 스크림(그라디언트 오버레이)을 깔고, 정보 밀도가 높은 블록은 반투명 판 위에 올린다.
// 레이아웃은 좌측 정렬 비대칭 + 콘덴스드 대문자 타이포.
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
import { shell, topBar, DISPLAY, BODY, MONO, PAPER, ACCENT, COOL } from './common';
import { renderReportSvg } from '../shared/reportSvg';

const REPORT_THEME = {
  accent: ACCENT,
  text: PAPER,
  silver: COOL,
  bronze: '#D08F63',
  goldFill: ACCENT,
  medalText: '#1B1405',
  rowBg: '#0A0A0F',
  rowBgOpacity: 0.5,
  topRowBgOpacity: 0.18,
  display: DISPLAY,
  body: BODY,
  mono: MONO,
  italic: false,
} as const;

function reportHeader(): string {
  return topBar('');
}

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
        return renderReportSvg(data.data, shell, reportHeader, REPORT_THEME);
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
      // 비결승 라운드에서는 라우트가 막지만 안전한 폴백.
      return ceremonySvg();
    case 'report':
      return '';
  }
}

/** shell() 안의 <!--BG_OVERRIDE_SLOT--> 를 커스텀 배경 <image> 로 치환 (스크림 아래에 깔린다). */
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

export const Template05: TemplateModule = {
  id: 5,
  name: 'Midnight Editorial — 다크 시네마틱 (05)',
  render(round, step, data, opts) {
    const svg = selectSvg(round, step, data);
    const placeholders = flattenStepData(data);
    const filled = applyPlaceholders(svg, placeholders);
    return applyBackgroundOverride(filled, opts?.backgroundOverride, opts?.backgroundOpacity);
  },
};
