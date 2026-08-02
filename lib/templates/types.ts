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
      /**
       * PAIRING 스텝 레이아웃 — true 면 커플을 원(타원) 둘레에 배치.
       * 미지정/false 면 각 템플릿 기본(목록/격자) 레이아웃.
       * 템플릿 03·04 는 원형이 기본이라 이 값과 무관하게 항상 원형.
       */
      pairCircle?: boolean;
    }
  ): string;
}
