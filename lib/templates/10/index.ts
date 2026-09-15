// Template 10 — "SPORTS WAVE".
// 스포츠 방송 배경 — 딥 네이비 위로 가는 선 수십 가닥이 꼬인 리본(블루→퍼플)으로 흐르고,
// 흰 속도선이 비스듬히 스치며, 흰색 이탤릭 제목이 은은한 빛을 머금는다.
// 잭앤질 스텝 화면·흐름은 07(LIVE ARENA)과 같고 10/common.ts 의 시각 프리미티브만 다르다.
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
import { shell, topBar, BG_LAYER, OVERRIDE_SCRIM, DISPLAY, WHITE, ACCENT, SILVER, BRONZE, NIGHT } from './common';
import { renderReportSvg } from '../shared/reportSvg';
import { applyContestIcon, type IconRect } from '../shared/contestIcon';
import { applyTextFit } from '../07/fit';

const REPORT_THEME = {
  accent: ACCENT,
  text: WHITE,
  silver: SILVER,
  bronze: BRONZE,
  goldFill: 'url(#goldg)',
  medalText: '#2A1600',
  silverText: NIGHT,
  bronzeText: '#2A1206',
  rowBg: '#172A78',
  rowBgOpacity: 0.55,
  topRowBgOpacity: 0.2,
  display: DISPLAY,
  body: DISPLAY,
  mono: DISPLAY,
  italic: false,
  // 10 은 상단 러너(대회명·아이콘·라이브 뱃지)가 y 84 까지 쓰고 하단 러너가 y 660 부터 시작한다.
  // 표를 그 사이(192~644)에 넣고, 좌우는 10 의 여백(32)에 맞춰 넓게 편다.
  layout: {
    leftX: 32,
    rightX: 652,
    colW: 596,
    rowH: 80,
    rowGap: 8,
    startY: 212, // 5행 마지막 하단 = 212 + 4×88 + 80 = 644
    headerY: 192,
    titleY: 122,
    titleSize: 40,
    titleTracking: 6,
    subtitleY: 152,
  },
} as const;

function selectSvg(round: RoundKey, _step: StepKey, data: StepDataPayload, pairCircle = false): string {
  if (round === 'final') {
    switch (data.kind) {
      case 'prep':
        return finalPrepSvg(Boolean(data.data.participants?.trim()));
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
      // 참가 규모가 비어 있으면(운영 기본값) ENTRIES 카드를 빼고 카드 2장으로 폭을 채운다.
      return prepSvg(false, Boolean(data.data.participants?.trim()));
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

/**
 * 배경 레이어 확정.
 *  · 커스텀 배경이 없으면 10 기본 배경(벡터 연출)을 깐다 (그 아래 바탕 그라디언트는 shell 이 항상 깐다).
 *  · 있으면 기본 배경을 빼고 운영자 이미지 + 스크림을 깐다 — 10 은 흰 글자라
 *    밝은 사진이 오면 스크림 없이는 글자가 묻힌다.
 */
function applyBackgroundOverride(svg: string, override?: string, opacityPct?: number): string {
  const defaultMarker = '<!--BG_DEFAULT_SLOT-->';
  const marker = '<!--BG_OVERRIDE_SLOT-->';
  if (!override) {
    return svg.replace(defaultMarker, BG_LAYER).replace(marker, '');
  }
  const safe = override.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const clamped = Math.max(
    0,
    Math.min(100, typeof opacityPct === 'number' && !Number.isNaN(opacityPct) ? opacityPct : 100)
  );
  const img = `<image href="${safe}" x="0" y="0" width="1280" height="720" preserveAspectRatio="xMidYMid slice" opacity="${(clamped / 100).toString()}"/>`;
  return svg.replace(defaultMarker, '').replace(marker, `${img}${OVERRIDE_SCRIM}`);
}

/**
 * 대회 아이콘 박스 — 상단 러너 중앙. 좌측 대회명(~452)과 우측 라이브 뱃지(976~) 사이.
 * 하단(74)은 대형 제목(cap top ≈ 90) 위에서 끝난다.
 */
const ICON_RECT: IconRect = { x: 490, y: 10, w: 300, h: 64 };

export const Template10: TemplateModule = {
  id: 10,
  name: 'Sports Wave — 라인 웨이브 스포츠 (10)',
  render(round, step, data, opts) {
    const svg = selectSvg(round, step, data, opts?.pairCircle);
    const placeholders = flattenStepData(data);
    // 치환이 끝나야 실제 글자 길이를 알 수 있으므로 자동 맞춤은 치환 직후에 적용한다.
    const filled = applyTextFit(applyPlaceholders(svg, placeholders));
    const withBg = applyBackgroundOverride(filled, opts?.backgroundOverride, opts?.backgroundOpacity);
    // VIDEO(심사위원 소개 영상) 스텝은 플레이어가 화면을 꽉 채워서 아이콘이 영상 위에 걸린다 — 표출하지 않는다.
    const icon = data.kind === 'judgesVideo' ? undefined : opts?.iconOverride;
    return applyContestIcon(withBg, ICON_RECT, icon, opts?.iconOpacity);
  },
};
