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
  const { data, error } = await sb
    .from('judge_votes')
    .select('*')
    .in('judge_id', ids);
  if (error) throw new Error(`listJudgeVotes: ${error.message}`);
  return (data ?? []) as JudgeVoteRow[];
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
    const { data: votes, error: ve } = await sb
      .from('judge_votes')
      .select('participant_num, vote_mark')
      .in('judge_id', judgeIds);
    if (ve) throw new Error(`listQualifiersWithLiveVotes(votes): ${ve.message}`);
    for (const v of (votes ?? []) as { participant_num: string; vote_mark: 'O' | 'X' | null }[]) {
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
