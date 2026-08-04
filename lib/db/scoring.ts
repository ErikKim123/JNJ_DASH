// 결승 채점 8 항목의 canonical 정의.
// UI · API · DB 변환을 한 곳에서 관리. 새 항목 추가 시 이 파일과 0003+ 마이그레이션만 손대면 됨.
import type { JudgeVoteRow } from './types';

export type ScoringItemKey =
  | 'fundamentals'
  | 'connection'
  | 'musicality'
  | 'creativity'
  | 'crowd_reaction'
  | 'showmanship'
  | 'audience_impact'
  | 'techniques';

/** judge_votes 의 점수 컬럼명 (historical 명명 보존). */
export type ScoringColumn =
  | 'basic_score' | 'connectivity_score' | 'musicality_score'
  | 'creativity_score' | 'crowd_reaction_score' | 'showmanship_score'
  | 'audience_impact_score' | 'techniques_score';

export interface ScoringItemDef {
  key: ScoringItemKey;
  label: string;       // UI 영문 라벨
  shortLabel: string;  // 매트릭스 셀 input placeholder 등에서 사용
  /** participants.meta 의 한글 suffix — 시트에서 import 된 키 끝부분과 매칭. */
  korLabel: string;
  /** judge_votes 테이블의 컬럼명. */
  column: ScoringColumn;
}

export const SCORING_ITEMS: readonly ScoringItemDef[] = [
  { key: 'fundamentals',    label: 'Fundamentals',    shortLabel: 'Fund',  korLabel: '기본기',    column: 'basic_score' },
  { key: 'connection',      label: 'Connection',      shortLabel: 'Conn',  korLabel: '연결성',    column: 'connectivity_score' },
  { key: 'musicality',      label: 'Musicality',      shortLabel: 'Mus',   korLabel: '음악성',    column: 'musicality_score' },
  { key: 'creativity',      label: 'Creativity',      shortLabel: 'Crea',  korLabel: '창의성',    column: 'creativity_score' },
  { key: 'crowd_reaction',  label: 'Crowd Reaction',  shortLabel: 'Crowd', korLabel: '호응도',    column: 'crowd_reaction_score' },
  { key: 'showmanship',     label: 'Showmanship',     shortLabel: 'Show',  korLabel: '쇼맨십',    column: 'showmanship_score' },
  { key: 'audience_impact', label: 'Audience Impact', shortLabel: 'Aud',   korLabel: '관객임팩트', column: 'audience_impact_score' },
  { key: 'techniques',      label: 'Techniques',      shortLabel: 'Tech',  korLabel: '테크닉',    column: 'techniques_score' },
] as const;

/** 한글 suffix → ScoringItemKey 역매핑 (시트 import 키 분류용). */
export const KOR_LABEL_TO_KEY: Record<string, ScoringItemKey> = Object.fromEntries(
  SCORING_ITEMS.map((s) => [s.korLabel, s.key])
);

/** 활성 항목 키 목록을 ScoringItemDef[] 로 normalize (canonical 순서 유지). */
export function resolveActiveDefs(
  activeKeys: readonly ScoringItemKey[] | null | undefined
): ScoringItemDef[] {
  const src = activeKeys && activeKeys.length > 0 ? activeKeys : DEFAULT_SCORING_ITEMS;
  const set = new Set(src);
  return SCORING_ITEMS.filter((s) => set.has(s.key));
}

export const SCORING_KEYS: readonly ScoringItemKey[] =
  SCORING_ITEMS.map((s) => s.key);

export const DEFAULT_SCORING_ITEMS: readonly ScoringItemKey[] = [
  'fundamentals', 'connection', 'musicality',
] as const;

export function getScoringDef(key: ScoringItemKey): ScoringItemDef {
  const d = SCORING_ITEMS.find((s) => s.key === key);
  if (!d) throw new Error(`Unknown scoring key: ${key}`);
  return d;
}

// ─────────────────────────────────────────────────────────────
// 온라인 심사위원 전용 채점 항목.
//   판정단(SCORING_ITEMS)과 라벨/의미가 다르지만, 저장은 online_judge_votes 의
//   동일 6 컬럼을 재사용한다(온라인 투표는 별도 테이블이라 판정단과 충돌 없음).
//   대회별 활성 항목은 contests.online_scoring_items 에 저장.
// ─────────────────────────────────────────────────────────────
export type OnlineScoringItemKey =
  | 'wow_factor'
  | 'stage_presence'
  | 'visual_impact'
  | 'crowd_connection'
  | 'team_chemistry'
  | 'musical_energy';

/** online_judge_votes 는 판정단 기본 6 컬럼만 재사용한다(판정단 확장 컬럼은 미사용). */
export type OnlineScoringColumn =
  Exclude<ScoringColumn, 'audience_impact_score' | 'techniques_score'>;

export interface OnlineScoringItemDef {
  key: OnlineScoringItemKey;
  label: string;       // UI 영문 라벨
  shortLabel: string;  // 매트릭스 셀 라벨
  /** online_judge_votes 의 컬럼명 (판정단과 동일 스토리지 재사용). */
  column: OnlineScoringColumn;
}

export const ONLINE_SCORING_ITEMS: readonly OnlineScoringItemDef[] = [
  { key: 'wow_factor',       label: 'WOW Factor',       shortLabel: 'WOW',    column: 'basic_score' },
  { key: 'stage_presence',   label: 'Stage Presence',   shortLabel: 'Stage',  column: 'connectivity_score' },
  { key: 'visual_impact',    label: 'Visual Impact',    shortLabel: 'Visual', column: 'musicality_score' },
  { key: 'crowd_connection', label: 'Crowd Connection', shortLabel: 'Crowd',  column: 'creativity_score' },
  { key: 'team_chemistry',   label: 'Team Chemistry',   shortLabel: 'Chem',   column: 'crowd_reaction_score' },
  { key: 'musical_energy',   label: 'Musical Energy',   shortLabel: 'Energy', column: 'showmanship_score' },
] as const;

export const ONLINE_SCORING_KEYS: readonly OnlineScoringItemKey[] =
  ONLINE_SCORING_ITEMS.map((s) => s.key);

/** 기본 활성 온라인 항목 — 6개 전체. */
export const DEFAULT_ONLINE_SCORING_ITEMS: readonly OnlineScoringItemKey[] =
  ONLINE_SCORING_KEYS;

/** 활성 온라인 항목 키 목록을 OnlineScoringItemDef[] 로 normalize (canonical 순서 유지). */
export function resolveActiveOnlineDefs(
  activeKeys: readonly OnlineScoringItemKey[] | null | undefined
): OnlineScoringItemDef[] {
  const src = activeKeys && activeKeys.length > 0 ? activeKeys : DEFAULT_ONLINE_SCORING_ITEMS;
  const set = new Set(src);
  return ONLINE_SCORING_ITEMS.filter((s) => set.has(s.key));
}

/** 활성 항목 키 목록에서 vote row 의 점수를 모아 sum/count 계산. */
export function aggregateScores(
  v: JudgeVoteRow | undefined,
  activeKeys: readonly ScoringItemKey[]
): { sum: number; cnt: number } {
  if (!v) return { sum: 0, cnt: 0 };
  let sum = 0, cnt = 0;
  for (const k of activeKeys) {
    const col = getScoringDef(k).column;
    const s = v[col];
    if (s != null) { sum += Number(s); cnt++; }
  }
  return { sum, cnt };
}
