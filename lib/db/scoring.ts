// 결승 채점 6 항목의 canonical 정의.
// UI · API · DB 변환을 한 곳에서 관리. 새 항목 추가 시 이 파일과 0003+ 마이그레이션만 손대면 됨.
import type { JudgeVoteRow } from './types';

export type ScoringItemKey =
  | 'fundamentals'
  | 'connection'
  | 'musicality'
  | 'creativity'
  | 'crowd_reaction'
  | 'showmanship';

export interface ScoringItemDef {
  key: ScoringItemKey;
  label: string;       // UI 영문 라벨
  shortLabel: string;  // 매트릭스 셀 input placeholder 등에서 사용
  /** participants.meta 의 한글 suffix — 시트에서 import 된 키 끝부분과 매칭. */
  korLabel: string;
  /** judge_votes 테이블의 컬럼명 (historical 명명 보존). */
  column: 'basic_score' | 'connectivity_score' | 'musicality_score'
        | 'creativity_score' | 'crowd_reaction_score' | 'showmanship_score';
}

export const SCORING_ITEMS: readonly ScoringItemDef[] = [
  { key: 'fundamentals',   label: 'Fundamentals',   shortLabel: 'Fund',  korLabel: '기본기',  column: 'basic_score' },
  { key: 'connection',     label: 'Connection',     shortLabel: 'Conn',  korLabel: '연결성',  column: 'connectivity_score' },
  { key: 'musicality',     label: 'Musicality',     shortLabel: 'Mus',   korLabel: '음악성',  column: 'musicality_score' },
  { key: 'creativity',     label: 'Creativity',     shortLabel: 'Crea',  korLabel: '창의성',  column: 'creativity_score' },
  { key: 'crowd_reaction', label: 'Crowd Reaction', shortLabel: 'Crowd', korLabel: '호응도',  column: 'crowd_reaction_score' },
  { key: 'showmanship',    label: 'Showmanship',    shortLabel: 'Show',  korLabel: '쇼맨십',  column: 'showmanship_score' },
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
