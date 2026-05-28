// participants.meta 의 38+ 시트 키들을 카테고리로 자동 분류.
// expand 패널에서 섹션 단위로 정리해서 보여주기 위한 helper.
import { SCORING_ITEMS } from '@/lib/db/scoring';

export type MetaCategory =
  | 'profile'         // 부문 / 장르 / 연락처 / 이메일 / Nationality / 접수일 / 사진원본 / 생일(X)
  | 'prelim_vote'     // ①~⑮ name (O/X) — 예선 통과 투표
  | 'final_score'     // ①~⑮ name {기본기|연결성|음악성|창의성|호응도|쇼맨십} — 결승 항목별 점수
  | 'pass_flag'       // 예선통과/본선통과/결승전 등 자동 통과 플래그
  | 'rank'            // 예선/본선 등수, 최종순위
  | 'score_agg'       // {항목} 합계, 결승 총점/평균
  | 'other';

const CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮';

const PROFILE_KEYS = new Set<string>([
  '부문', '장르', 'Division', '연락처', '이메일', 'Nationality', '접수일', '사진원본',
  'X', // 생일/생년월일이 시트 첫 칸에 X 라벨로 들어있음
]);

// 한글 채점 항목 6개 alternation. SCORING_ITEMS 에서 동적으로 빌드 — 항목 추가 시 자동 반영.
const KOR_ITEM_ALT = SCORING_ITEMS.map((s) => s.korLabel).join('|');
const FINAL_ITEM_SUFFIX_RE = new RegExp(`(${KOR_ITEM_ALT})\\s*$`);
const SCORE_AGG_RE = new RegExp(`(${KOR_ITEM_ALT}) 합계|결승 총점|결승 평균`);
const PASS_FLAG_RE = /(예선통과|본선통과|결승전)/;
const RANK_RE = /(예선 등수|본선 등수|최종순위)/;

// "기본기" / "연결성" 등 judge prefix 없는 단독 항목명 — 시트가 multi-row 헤더라서 첫 컬럼만
// "① Oliver" 와 묶이고 나머지는 단독 항목명으로 들어오는 케이스를 흡수.
const ITEM_ONLY_RE = new RegExp(`^(${KOR_ITEM_ALT})\\s*$`);

export function classifyMetaKey(key: string): MetaCategory {
  if (!key) return 'other';
  if (PROFILE_KEYS.has(key)) return 'profile';

  // judge 없는 짧은 한글 항목명 → final_score (judge='' 로 fallback)
  if (ITEM_ONLY_RE.test(key.trim())) return 'final_score';

  // 키 어디에든 ①~⑮ 가 포함되어 있는지 (긴 안내 헤더 "🟢 예선 ... ① Oliver" 케이스 흡수)
  const hasCircled = [...key].some((ch) => CIRCLED.indexOf(ch) >= 0);

  if (hasCircled) {
    if (FINAL_ITEM_SUFFIX_RE.test(key)) return 'final_score';
    return 'prelim_vote';
  }

  if (SCORE_AGG_RE.test(key)) return 'score_agg';
  if (PASS_FLAG_RE.test(key)) return 'pass_flag';
  if (RANK_RE.test(key)) return 'rank';

  return 'other';
}

/** "① Oliver" → 1, "⑮ 박박" → 15. 키 안 어디에 있어도 (긴 안내 헤더 케이스) 매칭. 못 찾으면 999. */
export function circledOrdinal(key: string): number {
  for (const ch of key) {
    const i = CIRCLED.indexOf(ch);
    if (i >= 0) return i + 1;
  }
  return 999;
}

/**
 * "① Oliver 기본기" → { judge: '① Oliver', item: '기본기' }
 * "기본기"             → { judge: '', item: '기본기' }      ← judge prefix 누락 케이스 fallback
 */
export function parseFinalScoreKey(key: string): { judge: string; item: string } | null {
  const trimmed = key.trim();
  // judge prefix 가 있는 형태
  const m = trimmed.match(new RegExp(`^(.+?)\\s+(${KOR_ITEM_ALT})\\s*$`));
  if (m) return { judge: m[1].trim(), item: m[2] };
  // 항목명만 단독으로 들어온 형태
  const justItem = trimmed.match(new RegExp(`^(${KOR_ITEM_ALT})$`));
  if (justItem) return { judge: '', item: justItem[1] };
  return null;
}

/** 분류된 그룹을 sorted entries 로 반환. 각 그룹 내부도 적절히 정렬. */
export function groupMeta(meta: Record<string, unknown>): Record<MetaCategory, [string, string][]> {
  const groups: Record<MetaCategory, [string, string][]> = {
    profile: [],
    prelim_vote: [],
    final_score: [],
    pass_flag: [],
    rank: [],
    score_agg: [],
    other: [],
  };
  for (const [k, v] of Object.entries(meta)) {
    const cat = classifyMetaKey(k);
    groups[cat].push([k, String(v ?? '')]);
  }
  // 정렬:
  //   prelim_vote / final_score : circled ordinal 순
  //   profile / pass_flag / rank / score_agg : 고정 순서 우선, 나머지 알파벳
  groups.prelim_vote.sort((a, b) => circledOrdinal(a[0]) - circledOrdinal(b[0]) || a[0].localeCompare(b[0]));
  groups.final_score.sort((a, b) => circledOrdinal(a[0]) - circledOrdinal(b[0]) || a[0].localeCompare(b[0]));

  const profileOrder = ['부문', '장르', 'Division', '연락처', '이메일', 'Nationality', '접수일', '사진원본', 'X'];
  groups.profile.sort((a, b) => {
    const ai = profileOrder.indexOf(a[0]); const bi = profileOrder.indexOf(b[0]);
    if (ai < 0 && bi < 0) return a[0].localeCompare(b[0]);
    if (ai < 0) return 1; if (bi < 0) return -1;
    return ai - bi;
  });

  const passOrder = ['예선통과 (자동)', '본선통과 (자동)', '결승전 (자동)'];
  const rankOrder = ['예선 등수', '본선 등수', '최종순위'];
  const aggOrder = ['결승 총점', '결승 평균', '기본기 합계', '연결성 합계', '음악성 합계'];
  function orderBy(list: string[]) {
    return (a: [string, string], b: [string, string]) => {
      const ai = list.indexOf(a[0]); const bi = list.indexOf(b[0]);
      if (ai < 0 && bi < 0) return a[0].localeCompare(b[0]);
      if (ai < 0) return 1; if (bi < 0) return -1;
      return ai - bi;
    };
  }
  groups.pass_flag.sort(orderBy(passOrder));
  groups.rank.sort(orderBy(rankOrder));
  groups.score_agg.sort(orderBy(aggOrder));
  groups.other.sort((a, b) => a[0].localeCompare(b[0]));

  return groups;
}

/** 결승 점수 키들을 judge 별로 묶기 — { '① Oliver': { '기본기': '9', '연결성': '9', '음악성': '5' } } */
export function groupFinalScoresByJudge(entries: [string, string][]): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  for (const [k, v] of entries) {
    const p = parseFinalScoreKey(k);
    if (!p) continue;
    if (!out[p.judge]) out[p.judge] = {};
    out[p.judge][p.item] = v;
  }
  return out;
}

/** 예선 투표 키 → judge 별 단일 표 (긴/짧은 헤더 동일 judge 로 normalize). */
export function normalizePrelimVotes(entries: [string, string][]): { judge: string; value: string }[] {
  // judge 라벨 = 짧은 form 우선. 같은 ordinal 의 긴 헤더는 짧은 form 으로 매핑.
  const byOrd = new Map<number, { judge: string; value: string }>();
  // 첫 패스: 짧은 헤더(<=30) 만 등록
  for (const [k, v] of entries) {
    if (k.length > 30) continue;
    const ord = circledOrdinal(k);
    if (!byOrd.has(ord)) byOrd.set(ord, { judge: k, value: v });
  }
  // 두 번째 패스: 짧은 form 없는 ordinal 만 긴 헤더로 채움
  for (const [k, v] of entries) {
    const ord = circledOrdinal(k);
    if (!byOrd.has(ord)) byOrd.set(ord, { judge: k, value: v });
  }
  return [...byOrd.entries()].sort((a, b) => a[0] - b[0]).map(([, x]) => x);
}

export const CATEGORY_LABEL: Record<MetaCategory, string> = {
  profile: 'Profile',
  prelim_vote: 'Prelim Vote (sheet)',
  final_score: 'Final Score (sheet)',
  pass_flag: 'Auto Pass Flags',
  rank: 'Sheet Ranks',
  score_agg: 'Score Aggregates',
  other: 'Other Sheet Fields',
};
