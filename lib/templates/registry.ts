// Design Ref: §2.3 — 디자인 템플릿 번호 → 모듈 매핑.
// Plan §12 OQ2 / Design §12: 누락된 번호는 1번으로 폴백.
import type { TemplateModule } from './types';
import { Template01 } from './01';
import { Template02 } from './02';
import { Template03 } from './03';

export const TEMPLATES: Record<number, TemplateModule> = {
  1: Template01,
  2: Template02,
  3: Template03,
};

export const DEFAULT_TEMPLATE_ID = 1;

export function getTemplate(id: number): TemplateModule {
  return TEMPLATES[id] ?? TEMPLATES[DEFAULT_TEMPLATE_ID];
}
