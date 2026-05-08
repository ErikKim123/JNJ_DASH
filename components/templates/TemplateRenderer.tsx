// Design Ref: §2.3, §5 — 디자인 템플릿 번호 + (round, step, data) → SVG 렌더.
// SVG 문자열은 placeholder 치환이 끝난 신뢰 가능 데이터(xmlEscape 적용됨)이므로
// dangerouslySetInnerHTML로 렌더해도 안전.
'use client';

import type { RoundKey, StepKey, StepDataPayload } from '@/lib/sheets/types';
import { getTemplate } from '@/lib/templates/registry';
import { ScalingFrame } from '@/components/ui/ScalingFrame';

export interface TemplateRendererProps {
  templateId: number;
  round: RoundKey;
  step: StepKey;
  data: StepDataPayload;
  fit?: 'width' | 'viewport';
}

export function TemplateRenderer({ templateId, round, step, data, fit = 'width' }: TemplateRendererProps) {
  const template = getTemplate(templateId);
  const svg = template.render(round, step, data);

  return (
    <ScalingFrame fit={fit}>
      <div
        className="w-full h-full"
        // svg 내부에 이미 xmlns + viewBox 포함됨. xmlEscape를 거친 안전한 데이터.
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </ScalingFrame>
  );
}
