// Design Ref: §2.3, §11.1 — 템플릿 모듈 인터페이스. 신규 디자인 추가 시 같은 인터페이스 구현.
import type { RoundKey, StepKey, StepDataPayload } from '@/lib/sheets/types';

export interface TemplateModule {
  id: number;
  name: string;
  /**
   * 주어진 (round, step, data) 조합에 대해 placeholder 치환이 완료된 SVG 문자열을 반환.
   * 호출 측은 `dangerouslySetInnerHTML`로 그대로 렌더 가능.
   */
  render(
    round: RoundKey,
    step: StepKey,
    data: StepDataPayload,
    opts?: {
      backgroundOverride?: string;
      /** 0-100. backgroundOverride 가 설정된 경우에만 적용. 미지정 시 100 (불투명). */
      backgroundOpacity?: number;
    }
  ): string;
}
