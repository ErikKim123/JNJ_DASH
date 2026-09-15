// Template 08 — 심사위원 소개 영상. 헤더/푸터 없이 영상만 크게(공용 레이아웃) 표출.
import { shell, DISPLAY, NIGHT, WHITE, ACCENT } from '../common';
import { judgesVideoContent } from '../../shared/judgesVideo';

export function judgesVideoSvg(videoUrl: string): string {
  return shell(
    judgesVideoContent({
      videoUrl,
      theme: {
        frame: 'url(#goldg)',
        frameSoft: ACCENT,
        emptyBg: NIGHT,
        emptyBgOpacity: 0.6,
        emptyTitle: WHITE,
        emptyMeta: ACCENT,
        titleFont: DISPLAY,
        metaFont: DISPLAY,
        italicMeta: false,
      },
    })
  );
}
