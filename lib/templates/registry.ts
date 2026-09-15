// Design Ref: §2.3 — 디자인 템플릿 번호 → 모듈 매핑.
// Plan §12 OQ2 / Design §12: 누락된 번호는 1번으로 폴백.
import type { TemplateModule } from './types';
import { Template01 } from './01';
import { Template02 } from './02';
import { Template03 } from './03';
import { Template04 } from './04';
import { Template05 } from './05';
import { Template06 } from './06';
import { Template07 } from './07';
// 08–11: BATTLE_DASH_DB 템플릿 이식 — 07 의 잭앤질 스텝 화면에 각자의 시각 프리미티브만 바꿔 입힌다.
import { Template08 } from './08';
import { Template09 } from './09';
import { Template10 } from './10';
import { Template11 } from './11';

export const TEMPLATES: Record<number, TemplateModule> = {
  1: Template01,
  2: Template02,
  3: Template03,
  4: Template04,
  5: Template05,
  6: Template06,
  7: Template07,
  8: Template08,
  9: Template09,
  10: Template10,
  11: Template11,
};

export const DEFAULT_TEMPLATE_ID = 1;

export function getTemplate(id: number): TemplateModule {
  return TEMPLATES[id] ?? TEMPLATES[DEFAULT_TEMPLATE_ID];
}
