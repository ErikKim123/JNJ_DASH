// 전 라운드 성적표(예선·본선·결승) → Wolf 점수관리(jnj_scores) 게시.
//
// 시상대(jnj_winners)는 1~3위 '얼굴' 이고, 이쪽은 대회 전체 성적표다 — 예선에서 떨어진
// 사람까지 전부 들어간다. 고객몰 /jnj 의 '전체 결과' 섹션이 이 테이블을 읽는다.
//
// 라운드마다 점수 체계가 다르다(J&J Dash 와 같다):
//   · 예선·본선 : qualifiers — 득표(votes) + 통과 여부(passed). 순위 점수는 없다.
//   · 결승      : final_results — 순위 + 최종(가중) 총점 + 평균 + 채점 상세(항목별)
// 한 모양으로 접어 한 테이블에 넣고, 해당 없는 칸은 비워 둔다.
//
// 값·규칙은 Wolf 어드민의 가져오기와 같아야 한다 — 어느 쪽으로 넣었느냐에 따라 숫자가
// 달라지면 안 된다. 참고: wolf/apps/admin/src/lib/queries/jnj-import.ts
import { getSupabaseAdmin } from '@/lib/db/client';
import { toCountryCode } from './country';
import { computeFinalScores, exportScore } from '@/lib/judging/final-score';
import { normalizePhotoUrl, scoringItems } from './winners';

export type WolfRound = 'prelim' | 'semi' | 'final';

/** 라운드 표시 순서 — 화면·정렬 모두 이 순서를 따른다. */
export const ROUND_ORDER: WolfRound[] = ['prelim', 'semi', 'final'];

/**
 * 성적 1줄에 붙는 결승 채점 상세. items 와 scores 는 같은 순서·같은 길이다.
 *
 * 심사위원 이름을 함께 싣는다(운영 요청). jnj_scores 는 비로그인도 읽을 수 있으므로
 * — RLS 공개 읽기 — 이 표는 '누가 누구에게 몇 점' 을 공개한다는 뜻이다. 채점을 드러내는
 * 것이 이 표의 목적이라 그렇게 둔다.
 *
 * name 이 비어 있을 수 있다(이름이 빈 심사위원, 또는 이름을 싣기 전에 게시한 옛 스냅샷).
 * 그때는 화면이 '심사위원 1·2·3' 으로 되돌아간다 — 줄 순서는 언제나 심사석 순번이다.
 */
export interface ScoreCriteria {
  items: string[];
  judges: { name?: string; scores: (number | null)[] }[];
}

export interface ScoreEntry {
  /** 라운드+역할+참가번호 — 미리보기 체크 식별용. */
  key: string;
  round: WolfRound;
  role: 'leader' | 'follower';
  entryNo: string;
  name: string;
  country: string | null;
  countryRaw: string;
  photoUrl: string;
  /** 예선·본선 — O=1 · 1/2=0.5 로 더한 득표라 4.5 같은 반 표가 나올 수 있다. */
  votes: number | null;
  passed: boolean | null;
  /** 결승 */
  rank: number | null;
  totalScore: number | null;
  avgScore: number | null;
  criteria: ScoreCriteria | null;
  /** 표 안 정렬(결승=순위, 예선·본선=득표 내림차순). */
  sortOrder: number;
}

/**
 * 채점 항목 코드 → judge_votes 의 점수 컬럼.
 * 항목 이름(scoring_items)과 컬럼 이름이 따로 굳어 있어(fundamentals ↔ basic_score)
 * 표를 세우려면 이 대응표가 필요하다. 여기 없는 코드는 빈 열이 된다 — 새 항목이 생겨도
 * 게시가 깨지지는 않는다.
 */
const CRITERIA_COLUMN: Record<string, string> = {
  fundamentals: 'basic_score',
  basics: 'basic_score',
  connection: 'connectivity_score',
  connectivity: 'connectivity_score',
  musicality: 'musicality_score',
  creativity: 'creativity_score',
  crowd_reaction: 'crowd_reaction_score',
  showmanship: 'showmanship_score',
  techniques: 'techniques_score',
  technique: 'techniques_score',
  audience_impact: 'audience_impact_score',
};

/**
 * 결승 채점 상세 — 참가번호 → 심사위원별 항목 점수.
 *
 * judge_votes 에는 대회 id 가 없다(심사위원에 딸려 있다). 결승 심사위원 id 를 먼저 뽑고
 * 그 id 로만 투표를 읽는다 — 예선·본선 심사위원 행은 자연히 걸러진다.
 * 한 항목도 안 매긴 심사위원은 표에서 뺀다(빈 줄만 늘어난다).
 */
async function finalCriteria(contestId: string, items: string[]): Promise<Map<string, ScoreCriteria>> {
  const out = new Map<string, ScoreCriteria>();
  if (items.length === 0) return out;
  const sb = getSupabaseAdmin();

  const judges = await sb
    .from('judges')
    .select('id, display_order, name')
    .eq('contest_id', contestId)
    .eq('round', 'final')
    .order('display_order', { ascending: true });
  const panel = (judges.data ?? []) as { id: string; display_order: number; name: string | null }[];
  if (judges.error || panel.length === 0) return out;

  const columns = items.map((it) => CRITERIA_COLUMN[it] ?? null);
  const select = ['judge_id', 'participant_num', ...new Set(columns.filter(Boolean) as string[])];
  const votes = await sb
    .from('judge_votes')
    .select(select.join(', '))
    .in('judge_id', panel.map((j) => j.id));
  if (votes.error) return out;

  const num = (v: unknown) => (v == null || v === '' ? null : Number(v));
  // 이름 없이 줄만 남기므로 순서가 곧 신원이다 — 표시 순번으로 자리를 정해 두고 그 자리에 넣는다
  // (투표 행이 오는 순서는 보장되지 않는다).
  const seat = new Map(panel.map((j, i) => [j.id, i]));
  const seatName = panel.map((j) => (j.name ?? '').trim());
  const rows = new Map<string, ((number | null)[] | null)[]>();
  for (const row of ((votes.data ?? []) as unknown as Record<string, unknown>[])) {
    const at = seat.get(String(row.judge_id));
    if (at == null) continue;
    const scores = columns.map((c) => (c ? num(row[c]) : null));
    // 전부 비어 있으면 채점을 안 한 것 — 빈 줄을 만들지 않는다.
    if (scores.every((s) => s == null || Number.isNaN(s))) continue;
    const seats = rows.get(String(row.participant_num)) ?? Array.from({ length: panel.length }, () => null);
    seats[at] = scores.map((s) => (s != null && Number.isFinite(s) ? s : null));
    rows.set(String(row.participant_num), seats);
  }
  for (const [participantNum, seats] of rows) {
    // 채점을 건너뛴 심사위원 줄은 빠지므로, 이름은 자리(index)를 버리기 전에 붙여야 한다.
    const list: ScoreCriteria['judges'] = [];
    seats.forEach((scores, at) => {
      if (scores === null) return;
      const name = seatName[at];
      list.push(name ? { name, scores } : { scores });
    });
    if (list.length > 0) out.set(participantNum, { items, judges: list });
  }
  return out;
}

/**
 * 이 대회의 전 라운드 성적.
 * 아직 안 치른 라운드는 그냥 빠진다(그 라운드 행이 없다).
 */
export async function buildScoreEntries(contestId: string): Promise<ScoreEntry[]> {
  const sb = getSupabaseAdmin();
  const items = await scoringItems(contestId);
  const [qual, fin, parts, criteria, scores] = await Promise.all([
    sb
      .from('qualifiers')
      .select('round, participant_num, team_name, representative, role, passed, votes, photo_url')
      .eq('contest_id', contestId),
    sb
      .from('final_results')
      .select('participant_num, team_name, role, final_rank, total_score, average, photo_url')
      .eq('contest_id', contestId),
    sb.from('participants').select('num, team_name, representative, photo_url').eq('contest_id', contestId),
    finalCriteria(contestId, items),
    // 결승 점수는 관리 화면과 같은 산출을 쓴다(lib/judging/final-score.ts).
    computeFinalScores(contestId),
  ]);

  type P = { num: string; team_name: string | null; representative: string | null; photo_url: string | null };
  const byNum = new Map(((parts.data ?? []) as P[]).map((p) => [p.num, p]));

  type Q = {
    round: 'prelim' | 'semi'; participant_num: string; team_name: string | null;
    representative: string | null; role: 'leader' | 'follower';
    passed: boolean | null; votes: number | null; photo_url: string | null;
  };
  type F = {
    participant_num: string; team_name: string | null; role: 'leader' | 'follower';
    final_rank: number | null; total_score: number | null; average: number | null; photo_url: string | null;
  };

  const rows: Omit<ScoreEntry, 'sortOrder'>[] = [];

  for (const q of (qual.data ?? []) as Q[]) {
    // 헬퍼(helper_leader 등)는 순위 대상이 아니라 qualifiers 에 역할이 두 갈래로만 들어온다.
    if (q.role !== 'leader' && q.role !== 'follower') continue;
    const p = byNum.get(q.participant_num);
    const countryRaw = (q.representative ?? p?.representative ?? '').trim();
    rows.push({
      key: `${q.round}-${q.role}-${q.participant_num}`,
      round: q.round,
      role: q.role,
      entryNo: q.participant_num,
      name: (q.team_name ?? '').trim() || (p?.team_name ?? '').trim() || q.participant_num,
      country: toCountryCode(countryRaw),
      countryRaw,
      photoUrl: normalizePhotoUrl(q.photo_url) || normalizePhotoUrl(p?.photo_url),
      // numeric 컬럼이라 문자열로 올 수 있다 — 숫자로 고정해야 0.5 가 살아서 넘어간다.
      votes: q.votes == null ? null : Number(q.votes),
      passed: q.passed,
      rank: null,
      totalScore: null,
      avgScore: null,
      criteria: null,
    });
  }

  for (const r of (fin.data ?? []) as F[]) {
    const p = byNum.get(r.participant_num);
    const countryRaw = (p?.representative ?? '').trim();
    rows.push({
      key: `final-${r.role}-${r.participant_num}`,
      round: 'final',
      role: r.role,
      entryNo: r.participant_num,
      name: (r.team_name ?? '').trim() || (p?.team_name ?? '').trim() || r.participant_num,
      country: toCountryCode(countryRaw),
      countryRaw,
      photoUrl: normalizePhotoUrl(r.photo_url) || normalizePhotoUrl(p?.photo_url),
      votes: null,
      passed: null,
      rank: r.final_rank,
      ...exportScore(
        scores.breakdown[r.participant_num],
        { total_score: r.total_score, average: r.average },
        scores.itemCount,
      ),
      criteria: criteria.get(r.participant_num) ?? null,
    });
  }

  // 라운드 → 역할 → (결승=순위 / 예선·본선=득표 내림차순) 으로 정렬하고 그 순서를 sort_order 로 굳힌다.
  rows.sort((a, b) => {
    const byRound = ROUND_ORDER.indexOf(a.round) - ROUND_ORDER.indexOf(b.round);
    if (byRound) return byRound;
    if (a.role !== b.role) return a.role === 'leader' ? -1 : 1;
    if (a.round === 'final') return (a.rank ?? 99) - (b.rank ?? 99);
    return (b.votes ?? -1) - (a.votes ?? -1) || a.entryNo.localeCompare(b.entryNo);
  });

  const seq = new Map<string, number>();
  return rows.map((r) => {
    const k = `${r.round}-${r.role}`;
    const n = (seq.get(k) ?? 0) + 1;
    seq.set(k, n);
    return { ...r, sortOrder: n };
  });
}

/**
 * 보내려는 득표에 반 표(0.5)가 섞여 있는지.
 *
 * Wolf 의 jnj_scores.votes 가 아직 integer 인 환경에서는 12.5 가 13 으로 반올림돼 들어간다
 * (wolf 0100 마이그레이션으로 numeric 이 된다). 조용히 틀린 숫자가 고객몰에 올라가는 것이
 * 제일 나쁘므로, 화면이 미리 경고할 수 있게 여기서 알려 준다.
 */
export function hasHalfVotes(entries: ScoreEntry[]): boolean {
  return entries.some((e) => e.votes != null && !Number.isInteger(e.votes));
}

/** 대상 에디션·부문에 이미 들어 있는 성적 건수 — 덮어쓰기 안내에 쓴다. */
export async function countExistingScores(editionId: string, division: string): Promise<number> {
  const sb = getSupabaseAdmin();
  const { count, error } = await sb
    .from('jnj_scores')
    .select('id', { count: 'exact', head: true })
    .eq('edition_id', editionId)
    .eq('division', division);
  if (error) return 0;
  return count ?? 0;
}

/**
 * 성적표를 Wolf 에 넣는다.
 *
 * replace=true 여도 지우는 것은 '이번에 넣는 라운드' 뿐이다. 예선만 다시 올릴 때
 * 결승 성적까지 사라지면, 라운드를 나눠 올리는 운영에서 매번 사고가 난다.
 */
export async function publishScoresToWolf(args: {
  editionId: string;
  division: string;
  entries: ScoreEntry[];
  replace: boolean;
}): Promise<{ inserted: number; removed: number; criteriaDropped: boolean }> {
  const sb = getSupabaseAdmin();
  let removed = 0;
  const rounds = [...new Set(args.entries.map((e) => e.round))];
  if (args.replace && rounds.length) {
    const { data, error } = await sb
      .from('jnj_scores')
      .delete()
      .eq('edition_id', args.editionId)
      .eq('division', args.division)
      .in('round', rounds)
      .select('id');
    if (error) throw new Error(`publishScoresToWolf(delete): ${error.message}`);
    removed = (data ?? []).length;
  }
  if (args.entries.length === 0) return { inserted: 0, removed, criteriaDropped: false };

  const rows = args.entries.map((e) => ({
    edition_id: args.editionId,
    division: args.division,
    round: e.round,
    role: e.role,
    entry_no: e.entryNo,
    name: e.name,
    country: e.country,
    photo_url: e.photoUrl || null,
    votes: e.votes,
    passed: e.passed,
    rank: e.rank,
    total_score: e.totalScore,
    avg_score: e.avgScore,
    criteria: e.criteria,
    sort_order: e.sortOrder,
    is_active: true,
  }));

  let res = await sb.from('jnj_scores').insert(rows).select('id');
  let criteriaDropped = false;
  // 0084 미적용 환경 — 채점 상세 칸만 빼고 다시 넣는다. 성적을 통째로 못 넣는 것보다 낫다.
  if (res.error && /criteria/.test(res.error.message ?? '')) {
    const plain = rows.map(({ criteria: _criteria, ...rest }) => rest);
    res = await sb.from('jnj_scores').insert(plain).select('id');
    criteriaDropped = true;
  }
  if (res.error) throw new Error(`publishScoresToWolf(insert): ${res.error.message}`);
  return { inserted: (res.data ?? []).length, removed, criteriaDropped };
}
