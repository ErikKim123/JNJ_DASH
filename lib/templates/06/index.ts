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
import { shell, topBar, BG_LAYER, WASH_LAYER, DISPLAY, BODY, MONO, PAPER, INK, PLATE, ACCENT, TEAL, ROSE } from './common';
import { renderReportSvg } from '../shared/reportSvg';
import { applyContestIcon, type IconRect } from '../shared/contestIcon';

const REPORT_THEME = {
  accent: ACCENT,
  text: INK,
  silver: TEAL,
  bronze: ROSE,
  goldFill: ACCENT,
  // 06 은 1·2·3위 메달 면이 모두 딥 톤(브론즈/틸/테라코타) — 숫자는 밝아야 읽힌다.
  medalText: PAPER,
  silverText: PAPER,
  bronzeText: PAPER,
  rowBg: PLATE,
  rowBgOpacity: 0.55,
  topRowBgOpacity: 0.14,
  display: DISPLAY,
  body: BODY,
  mono: MONO,
  italic: false,
  // 06 은 표가 지면(card) 안쪽 프레임(x 76~1204, y 56~664)에 들어가야 한다.
  // 기본 좌표(x 60~1220, 마지막 행 하단 692)는 프레임을 좌·우·아래로 넘겨서 잘렸다.
  layout: {
    leftX: 88,
    rightX: 664,
    colW: 528,   // 88+528=616 · 664+528=1192 → 640 기준 좌우 대칭, 프레임 안쪽
    rowH: 74,
    rowGap: 6,
    startY: 256, // 5행 마지막 하단 = 256 + 4×80 + 74 = 650 (프레임 하단 664 위)
    headerY: 232,
    titleY: 168, // 상단 헤어라인(124)과 겹치지 않게 아래로
    titleSize: 42,
    titleTracking: 10,
    subtitleY: 198,
  },
} as const;

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
      return ceremonySvg();
    case 'report':
      return '';
  }
}

/**
 * 배경 레이어 확정.
 *  · 커스텀 배경이 있으면 그 이미지 하나만 깐다 — 지면(card)이 투명해졌으므로 업로드한
 *    이미지가 화면 전체에 그대로 보인다. 기본 사진/워시를 깔면 색이 섞이므로 넣지 않는다.
 *  · 없으면 기존 기본 사진 + 밝은 워시로 폴백.
 */
function applyBackgroundOverride(svg: string, override?: string, opacityPct?: number): string {
  const defaultMarker = '<!--BG_DEFAULT_SLOT-->';
  const marker = '<!--BG_OVERRIDE_SLOT-->';
  if (!override) {
    return svg.replace(defaultMarker, `${BG_LAYER}${WASH_LAYER}`).replace(marker, '');
  }
  const safe = override.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const clamped = Math.max(
    0,
    Math.min(100, typeof opacityPct === 'number' && !Number.isNaN(opacityPct) ? opacityPct : 100)
  );
  const img = `<image href="${safe}" x="0" y="0" width="1280" height="720" preserveAspectRatio="xMidYMid slice" opacity="${(clamped / 100).toString()}"/>`;
  return svg.replace(defaultMarker, '').replace(marker, img);
}

/**
 * 대회 아이콘 박스 — 상단 중앙, 대회명(y=104) 위.
 * 기존 260×40 의 2배(520×80). 높이를 키우는 만큼 위로 올려(y 48→8) 하단(88)은 그대로 두어
 * 대회명·헤어라인(124)과 겹치지 않게 한다. 로고는 이 안에서 비율 유지로 맞춰진다.
 */
const ICON_RECT: IconRect = { x: 380, y: 8, w: 520, h: 80 };

export const Template06: TemplateModule = {
  id: 6,
  name: 'Ivory Gallery — 라이트 에디토리얼 (06)',
  render(round, step, data, opts) {
    const svg = selectSvg(round, step, data, opts?.pairCircle);
    const placeholders = flattenStepData(data);
    const filled = applyPlaceholders(svg, placeholders);
    const withBg = applyBackgroundOverride(filled, opts?.backgroundOverride, opts?.backgroundOpacity);
    // VIDEO(심사위원 소개 영상) 스텝은 플레이어가 화면을 꽉 채워서 아이콘이 영상 위에 걸린다 — 표출하지 않는다.
    const icon = data.kind === 'judgesVideo' ? undefined : opts?.iconOverride;
    return applyContestIcon(withBg, ICON_RECT, icon, opts?.iconOpacity);
  },
};
