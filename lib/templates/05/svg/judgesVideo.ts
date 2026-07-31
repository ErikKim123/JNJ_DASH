// Template 05 — 심사위원 소개 영상. 헤더/푸터 없이 영상만 크게(공용 레이아웃) 표출.
import { shell, PAPER, ACCENT, DIM, BODY, MONO } from '../common';
import { judgesVideoContent } from '../../shared/judgesVideo';

export function judgesVideoSvg(videoUrl: string): string {
  return shell(
    judgesVideoContent({
      videoUrl,
      theme: {
        frame: ACCENT,
        frameSoft: PAPER,
        emptyBg: '#07070C',
        emptyBgOpacity: 0.62,
        emptyTitle: PAPER,
        emptyMeta: DIM,
        titleFont: BODY,
        metaFont: MONO,
        italicMeta: false,
      },
    })
  );
}
