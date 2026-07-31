// 심사위원 소개 영상 화면 — 예선 JUDGES 다음. 헤더/타이틀/푸터 없이 영상만 크게 표출.
import { shell } from './common';
import { judgesVideoContent } from '../../shared/judgesVideo';

export function judgesVideoSvg(videoUrl: string): string {
  return shell(judgesVideoContent({ videoUrl }));
}
