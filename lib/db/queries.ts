// 서버 전용 — Supabase admin 클라이언트로 자료운영 UI 가 쓰는 read 헬퍼.
// Phase 3 에서 표출 화면도 DB 로 전환되면 anon 클라이언트용 별도 모듈을 또 만들 예정.
// (server-only 패키지는 별도 의존성이라 미사용. getSupabaseAdmin 호출이 service role
//  키를 요구하므로 클라이언트에서 빌드 시도하면 즉시 throw → 사실상 server-only)
import { getSupabaseAdmin } from './client';
import type {
  ContestRow,
  ParticipantRow,
  PairingRow,
  QualifierRow,
  FinalResultRow,
  JudgeRow,
  JudgeVoteRow,
  OnlineJudgeRow,
  OnlineJudgeVoteRow,
  PairingRoundDb,
  QualifierRoundDb,
  JudgingRound,
} from './types';

export async function listContests(): Promise<ContestRow[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('contests')
    .select('*')
    .order('id', { ascending: true });
  if (error) throw new Error(`listContests: ${error.message}`);
  return (data ?? []) as ContestRow[];
}

export async function getContest(id: string): Promise<ContestRow | null> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from('contests').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(`getContest: ${error.message}`);
  return (data ?? null) as ContestRow | null;
}

export async function listParticipants(contestId: string): Promise<ParticipantRow[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('participants')
    .select('*')
    .eq('contest_id', contestId)
    .order('num', { ascending: true });
  if (error) throw new Error(`listParticipants: ${error.message}`);
  return (data ?? []) as ParticipantRow[];
}

export async function listPairings(
  contestId: string,
  round: PairingRoundDb
): Promise<PairingRow[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('pairings')
    .select('*')
    .eq('contest_id', contestId)
    .eq('round', round)
    .order('pair_idx', { ascending: true });
  if (error) throw new Error(`listPairings: ${error.message}`);
  return (data ?? []) as PairingRow[];
}

export async function listQualifiers(
  contestId: string,
  round: QualifierRoundDb
): Promise<QualifierRow[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('qualifiers')
    .select('*')
    .eq('contest_id', contestId)
    .eq('round', round)
    .order('display_order', { ascending: true })
    .order('votes', { ascending: false })
    .order('participant_num', { ascending: true });
  if (error) throw new Error(`listQualifiers: ${error.message}`);
  return (data ?? []) as QualifierRow[];
}

export async function listFinalResults(contestId: string): Promise<FinalResultRow[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('final_results')
    .select('*')
    .eq('contest_id', contestId)
    .order('role', { ascending: true })
    .order('final_rank', { ascending: true });
  if (error) throw new Error(`listFinalResults: ${error.message}`);
  return (data ?? []) as FinalResultRow[];
}

export async function listJudges(contestId: string, round: JudgingRound): Promise<JudgeRow[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('judges')
    .select('*')
    .eq('contest_id', contestId)
    .eq('round', round)
    .order('display_order', { ascending: true });
  if (error) throw new Error(`listJudges: ${error.message}`);
  return (data ?? []) as JudgeRow[];
}

// Supabase/PostgREST 기본 1000행 제한 회피 — judge_id IN 조회를 페이지네이션으로 전부 가져온다.
// (심사위원 20 × 참가자 120 = 2400표처럼 1000행을 넘으면 잘려서 매트릭스/집계가 틀어짐)
export async function selectJudgeVotesAll(
  sb: ReturnType<typeof getSupabaseAdmin>,
  judgeIds: string[],
  columns = '*'
): Promise<Record<string, unknown>[]> {
  if (judgeIds.length === 0) return [];
  const PAGE = 1000;
  const all: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from('judge_votes')
      .select(columns)
      .in('judge_id', judgeIds)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`selectJudgeVotesAll: ${error.message}`);
    const rows = (data ?? []) as unknown as Record<string, unknown>[];
    all.push(...rows);
    if (rows.length < PAGE) break;
  }
  return all;
}

export async function listJudgeVotes(contestId: string, round: JudgingRound): Promise<JudgeVoteRow[]> {
  const sb = getSupabaseAdmin();
  // judges 의 id 들로 필터 → 라운드 votes 만.
  const { data: judges, error: je } = await sb
    .from('judges')
    .select('id')
    .eq('contest_id', contestId)
    .eq('round', round);
  if (je) throw new Error(`listJudgeVotes(judges): ${je.message}`);
  const ids = (judges ?? []).map((j) => j.id);
  if (ids.length === 0) return [];
  const data = await selectJudgeVotesAll(sb, ids, '*');
  return data as unknown as JudgeVoteRow[];
}

/**
 * judge_votes 의 O 카운트로 qualifiers.votes 를 덮어쓴 라이브 뷰.
 *   - 라운드의 judges 명단을 가져와서 그 judge_id 별로 votes 합산
 *   - participant_num 별로 votes 누적
 *   - qualifiers row 와 merge 시 voteCounts 가 있으면 우선, 없으면 row.votes 유지
 *
 * 결과는 qualifiers.passed 와 무관하게 모든 row 를 반환. 운영자가 page 측에서 필터.
 */
export async function listQualifiersWithLiveVotes(
  contestId: string,
  round: QualifierRoundDb
): Promise<QualifierRow[]> {
  const sb = getSupabaseAdmin();
  const [{ data: rawQ, error: qe }, { data: judges, error: je }] = await Promise.all([
    sb.from('qualifiers').select('*').eq('contest_id', contestId).eq('round', round),
    sb.from('judges').select('id').eq('contest_id', contestId).eq('round', round),
  ]);
  if (qe) throw new Error(`listQualifiersWithLiveVotes(qualifiers): ${qe.message}`);
  if (je) throw new Error(`listQualifiersWithLiveVotes(judges): ${je.message}`);

  const judgeIds = (judges ?? []).map((j) => j.id);
  const voteCounts = new Map<string, number>();
  // 한 번이라도 judge_votes 에 등장한 (=심사된) 참가자 집합 — 마크가 X/null 이어도 포함.
  // O 만 카운트하다 보면 "전부 X 로 바꿈 → voteCounts 미존재 → stale r.votes 폴백" 버그가 생긴다.
  const judgedSet = new Set<string>();
  if (judgeIds.length > 0) {
    const votes = await selectJudgeVotesAll(sb, judgeIds, 'participant_num, vote_mark');
    for (const v of votes as unknown as { participant_num: string; vote_mark: 'O' | 'X' | null }[]) {
      judgedSet.add(v.participant_num);
      if (v.vote_mark === 'O') {
        voteCounts.set(v.participant_num, (voteCounts.get(v.participant_num) ?? 0) + 1);
      }
    }
  }

  return ((rawQ ?? []) as QualifierRow[]).map((r) => ({
    ...r,
    // 심사된 적 있는 참가자 → 라이브 O 카운트 (전부 X 면 0). 한 번도 심사 안 됨 → 저장된 votes 보존.
    votes: judgedSet.has(r.participant_num)
      ? (voteCounts.get(r.participant_num) ?? 0)
      : r.votes,
  }));
}

/**
 * 온라인 심사위원 목록 — 대회당 최대 ~1000명이라 페이지네이션(기본 50/page).
 *   page 는 1-기반. total 은 필터된 전체 건수(페이지 계산용).
 */
export async function listOnlineJudges(
  contestId: string,
  page = 1,
  pageSize = 50
): Promise<{ rows: OnlineJudgeRow[]; total: number }> {
  const sb = getSupabaseAdmin();
  const safeSize = Math.max(1, Math.min(200, Math.floor(pageSize)));
  const safePage = Math.max(1, Math.floor(page));
  const from = (safePage - 1) * safeSize;
  const to = from + safeSize - 1;
  const { data, error, count } = await sb
    .from('online_judges')
    .select('*', { count: 'exact' })
    .eq('contest_id', contestId)
    .order('display_order', { ascending: true })
    .range(from, to);
  if (error) throw new Error(`listOnlineJudges: ${error.message}`);
  return { rows: (data ?? []) as OnlineJudgeRow[], total: count ?? 0 };
}

/** 온라인 심사위원 전체(페이지 없이) — 결승 채점 매트릭스 컬럼용. 대회당 최대 ~1000명. */
export async function listAllOnlineJudges(contestId: string): Promise<OnlineJudgeRow[]> {
  const sb = getSupabaseAdmin();
  const PAGE = 1000;
  const all: OnlineJudgeRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from('online_judges')
      .select('*')
      .eq('contest_id', contestId)
      .order('display_order', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`listAllOnlineJudges: ${error.message}`);
    const rows = (data ?? []) as OnlineJudgeRow[];
    all.push(...rows);
    if (rows.length < PAGE) break;
  }
  return all;
}

/** 온라인 심사위원 결승 채점 votes 전체 — 대회의 online_judge id 들로 조회(1000행 페이지네이션). */
export async function listOnlineJudgeVotes(contestId: string): Promise<OnlineJudgeVoteRow[]> {
  const sb = getSupabaseAdmin();
  const { data: judges, error: je } = await sb
    .from('online_judges')
    .select('id')
    .eq('contest_id', contestId);
  if (je) throw new Error(`listOnlineJudgeVotes(judges): ${je.message}`);
  const ids = (judges ?? []).map((j) => j.id);
  if (ids.length === 0) return [];
  const PAGE = 1000;
  const all: OnlineJudgeVoteRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from('online_judge_votes')
      .select('*')
      .in('online_judge_id', ids)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`listOnlineJudgeVotes: ${error.message}`);
    const rows = (data ?? []) as OnlineJudgeVoteRow[];
    all.push(...rows);
    if (rows.length < PAGE) break;
  }
  return all;
}

/** 사이드바용 경량 목록 — id/name 만. */
export async function listContestSummaries(): Promise<{ id: string; name: string }[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('contests')
    .select('id,name')
    .order('id', { ascending: true });
  if (error) throw new Error(`listContestSummaries: ${error.message}`);
  return (data ?? []) as { id: string; name: string }[];
}
