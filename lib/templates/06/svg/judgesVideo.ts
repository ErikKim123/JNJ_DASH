// Template 06 — 심사위원 소개 영상. 헤더/푸터 없이 영상만 크게(공용 레이아웃) 표출.
import { shell, INK, INK_SOFT, ACCENT, BODY, MONO } from '../common';
import { judgesVideoContent } from '../../shared/judgesVideo';

export function judgesVideoSvg(videoUrl: string): string {
  return shell(
    judgesVideoContent({
      videoUrl,
      theme: {
        frame: ACCENT,
        frameSoft: INK,
        emptyBg: '#EFE8D9',
        emptyBgOpacity: 0.8,
        emptyTitle: INK,
        emptyMeta: INK_SOFT,
        titleFont: BODY,
        metaFont: MONO,
        italicMeta: false,
      },
    })
  );
}
