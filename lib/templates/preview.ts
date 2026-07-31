// Design Ref: §2.3 — 관리자 폼 디자인 템플릿 카드 갤러리 미리보기용 샘플 데이터.
// 대회 데이터 없이도 템플릿 디자인을 그대로 렌더할 수 있게, 각 화면(prep/open/live/result/ceremony)의
// StepDataPayload 를 더미 값으로 만들어 둔다. 채워지지 않은 placeholder 는 빈 문자열로 치환된다
// (placeholder.ts applyPlaceholders) — 사진 등은 비워도 안전.
import type { RoundKey, StepKey, StepDataPayload, ResultEntry } from '@/lib/sheets/types';
import type { MessageKey } from '@/lib/i18n/messages';
import { TEMPLATES, getTemplate } from './registry';

/** 폼 셀렉션에 쓸 템플릿 목록 — registry 에 등록된 것만, id 오름차순. */
export interface TemplateOption {
  id: number;
  name: string;
}

export function templateOptions(): TemplateOption[] {
  return Object.values(TEMPLATES)
    .map((t) => ({ id: t.id, name: t.name }))
    .sort((a, b) => a.id - b.id);
}

// ─── 샘플 값 ────────────────────────────────────────────────────────────────

const HEADER = 'JNJ LATIN FESTIVAL';
const TAGLINE = 'Feel the rhythm, share the joy';

const SAMPLE_LEADER_NAMES = ['Diego Alvarez', 'Marco Silva', 'Kenji Sato', 'Luis Romero', 'Andre Costa'];
const SAMPLE_FOLLOWER_NAMES = ['Sofia Reyes', 'Yuna Park', 'Elena Cruz', 'Mia Tanaka', 'Clara Mendes'];

function entries(names: readonly string[], count: number, base: number): ResultEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    idx: i + 1,
    name: names[i % names.length],
    num: String(base + i * 3),
    photo: '',
  }));
}

// ─── 미리보기 화면 정의 ──────────────────────────────────────────────────────

export type PreviewScreenKey = 'prep' | 'open' | 'live' | 'result' | 'ceremony';

export interface PreviewScreen {
  key: PreviewScreenKey;
  /** i18n 라벨 키 — 카드 갤러리 / 모달 탭에 표시. */
  labelKey: MessageKey;
  round: RoundKey;
  step: StepKey;
  data: StepDataPayload;
}

export const PREVIEW_SCREENS: readonly PreviewScreen[] = [
  {
    key: 'prep',
    labelKey: 'cf.tplScreenPrep',
    round: 'prelim',
    step: 'prep',
    data: {
      kind: 'prep',
      data: {
        festival_header: HEADER,
        stage_label: 'PRELIMINARY',
        round_title: 'PRELIMINARY ROUND',
        round_subtitle: 'Salsa Jack & Jill',
        participants: '60 COUPLES',
        tagline: TAGLINE,
      },
    },
  },
  {
    key: 'open',
    labelKey: 'cf.tplScreenOpen',
    round: 'prelim',
    step: 'open',
    data: {
      kind: 'open',
      data: {
        festival_header: HEADER,
        round_title: 'PRELIMINARY ROUND',
        open_quote: 'Dance is the hidden language of the soul',
        open_subline: 'Judges are ready — let the music begin',
        tagline: TAGLINE,
      },
    },
  },
  {
    key: 'live',
    labelKey: 'cf.tplScreenLive',
    round: 'prelim',
    step: 'live',
    data: {
      kind: 'live',
      data: {
        festival_header: HEADER,
        stage_label: 'PRELIMINARY',
        round_title: 'PRELIMINARY ROUND',
        live_message: 'Judging in progress',
        tagline: TAGLINE,
      },
    },
  },
  {
    key: 'result',
    labelKey: 'cf.tplScreenResult',
    round: 'prelim',
    step: 'result',
    data: {
      kind: 'result',
      data: {
        festival_header: HEADER,
        result_title: 'QUALIFIERS',
        result_subtitle: 'Preliminary → Semi Final',
        label_leader: 'LEADER',
        label_follower: 'FOLLOWER',
        leaders: entries(SAMPLE_LEADER_NAMES, 5, 101),
        followers: entries(SAMPLE_FOLLOWER_NAMES, 5, 201),
        tagline: TAGLINE,
      },
    },
  },
  {
    key: 'ceremony',
    labelKey: 'cf.tplScreenCeremony',
    round: 'final',
    step: 'ceremony',
    data: {
      kind: 'ceremony',
      data: {
        festival_header: HEADER,
        ceremony_title: 'AWARD CEREMONY',
        ceremony_subtitle: 'Final Round',
        label_leader: 'LEADER',
        label_follower: 'FOLLOWER',
        leaders: entries(SAMPLE_LEADER_NAMES, 3, 101),
        followers: entries(SAMPLE_FOLLOWER_NAMES, 3, 201),
        tagline: TAGLINE,
      },
    },
  },
];

/** 카드 썸네일에 쓰는 기본 화면. */
export const DEFAULT_PREVIEW_SCREEN: PreviewScreenKey = 'prep';

export function getPreviewScreen(key: PreviewScreenKey): PreviewScreen {
  return PREVIEW_SCREENS.find((s) => s.key === key) ?? PREVIEW_SCREENS[0];
}

/** 템플릿 번호 + 화면 키 → placeholder 치환이 끝난 SVG 문자열. */
export function renderPreviewSvg(templateId: number, screenKey: PreviewScreenKey): string {
  const screen = getPreviewScreen(screenKey);
  return getTemplate(templateId).render(screen.round, screen.step, screen.data);
}
