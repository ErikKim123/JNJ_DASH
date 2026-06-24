// DB 기반 표출 어댑터. lib/sheets/adapter.ts 와 동일한 외부 시그니처를 유지해
// API route 가 import 만 바꿔서 점진 전환할 수 있게 함.
//
// 핵심 변경:
//   - 모든 read 가 Supabase 에서 옴 (cf. lib/sheets/client.ts 의 gviz CSV → 폐기)
//   - 페어링 스냅샷(파일 기반 RAND() 락) 불필요 — pairings.status='confirmed' 가 동일 역할
//   - refresh 옵션은 무시 (DB 가 진실 원천이라 캐시 없음, 호환을 위해 인자만 유지)
//
// 도메인 타입은 lib/sheets/types.ts 를 그대로 재사용 (의도된 의존 — sheets/* 는 점진 폐기 예정).
import { getSupabaseAdmin } from './client';
import { listQualifiersWithLiveVotes } from './queries';
import { normalizePhotoUrl, resolvePhotoUrl } from '@/lib/photo';
import type {
  PairingRow,
  QualifierRow,
  FinalResultRow,
  ContestRow,
} from './types';
import type {
  ContestSummary,
  ContestMeta,
  FinalPodiumEntry,
  FinalTieEntry,
  FinalTieInfo,
  JudgesIntroData,
  JudgesIntroEntry,
  OverflowEntry,
  Pair,
  PairingData,
  ParticipantStats,
  ResultData,
  ResultEntry,
  RoundKey,
  StepKey,
  StepDataPayload,
  CeremonyData,
} from '@/lib/sheets/types';
import { STEPS_BY_ROUND } from '@/lib/sheets/types';

// ─── 에러 (sheets adapter 와 동일 시그니처) ─────────────────────────────
export class ContestNotFoundError extends Error {
  constructor(public contestId: string) {
    super(`Contest not found: ${contestId}`);
    this.name = 'ContestNotFoundError';
  }
}

export class StepNotAvailableError extends Error {
  constructor(public round: RoundKey, public step: StepKey) {
    super(`Step "${step}" is not available for round "${round}"`);
    this.name = 'StepNotAvailableError';
  }
}

const HELPER_NAME = '헬퍼유저';
const HELPER_NUM = '—';

const ROUND_LABELS: Record<RoundKey, string> = {
  prelim: 'Preliminary',
  semi: 'Semi-Final',
  final: 'Grand Final',
};

const FINAL_PODIUM_MAX_RANK = 7;

/**
 * participants 테이블에서 participant_num → 표시용 사진 URL 맵.
 * qualifiers/final_results 가 photo_url 비어있을 때 폴백으로 사용.
 */
async function getParticipantPhotoMap(contestId: string): Promise<Map<string, string>> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('participants')
    .select('num, photo_url, meta')
    .eq('contest_id', contestId);
  if (error) throw new Error(`getParticipantPhotoMap: ${error.message}`);
  const map = new Map<string, string>();
  for (const p of (data ?? []) as { num: string; photo_url: string | null; meta: Record<string, unknown> | null }[]) {
    const url = resolvePhotoUrl(p);
    if (url) map.set(p.num, url);
  }
  return map;
}

// ─── Contest 목록/단일 조회 ──────────────────────────────────────────────

function contestRowToSummary(c: ContestRow): ContestSummary {
  return {
    contestId: c.id,
    name: c.name,
    // ContestSummary 타입에 남아있는 필드 — legacy 값을 그대로 노출. 클라이언트엔 어차피 빼서 보냄.
    spreadsheetId: c.legacy_spreadsheet_id ?? '',
    designTemplateNumber: c.design_template_number,
    startDate: c.period_start ?? undefined,
    endDate: c.period_end ?? undefined,
    status: c.status,
  };
}

export async function getContestList(): Promise<ContestSummary[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('contests')
    .select('*')
    .neq('status', 'archived')
    .order('id', { ascending: true });
  if (error) throw new Error(`getContestList: ${error.message}`);
  return ((data ?? []) as ContestRow[]).map(contestRowToSummary);
}

export async function getContestSummary(contestId: string): Promise<ContestSummary | null> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('contests')
    .select('*')
    .eq('id', contestId)
    .maybeSingle();
  if (error) throw new Error(`getContestSummary: ${error.message}`);
  return data ? contestRowToSummary(data as ContestRow) : null;
}

// ─── 참가자 통계 ──────────────────────────────────────────────────────────

async function getParticipantStats(
  contest: ContestRow
): Promise<ParticipantStats> {
  const sb = getSupabaseAdmin();
  const cid = contest.id;

  const [pAll, qPrelim, qSemi, finalsRows] = await Promise.all([
    sb.from('participants').select('role').eq('contest_id', cid),
    sb.from('qualifiers').select('role').eq('contest_id', cid).eq('round', 'prelim').eq('passed', true),
    sb.from('qualifiers').select('role').eq('contest_id', cid).eq('round', 'semi').eq('passed', true),
    sb.from('final_results').select('role,team_name,participant_num,final_rank').eq('contest_id', cid),
  ]);

  if (pAll.error) throw new Error(`getParticipantStats(participants): ${pAll.error.message}`);
  if (qPrelim.error) throw new Error(`getParticipantStats(qPrelim): ${qPrelim.error.message}`);
  if (qSemi.error) throw new Error(`getParticipantStats(qSemi): ${qSemi.error.message}`);
  if (finalsRows.error) throw new Error(`getParticipantStats(finals): ${finalsRows.error.message}`);

  const counts = { leaders: 0, followers: 0, helperLeaders: 0, helperFollowers: 0 };
  for (const r of pAll.data ?? []) {
    if (r.role === 'leader') counts.leaders++;
    else if (r.role === 'follower') counts.followers++;
    else if (r.role === 'helper_leader') counts.helperLeaders++;
    else if (r.role === 'helper_follower') counts.helperFollowers++;
  }

  // boundary tie 가 commit 에 포함되어 qualifiers 가 정원을 초과할 수 있다 (e.g. 24 정원에 25/26).
  // 통과수는 동점 처리에 따라 변동하는 값이므로 cap 없이 실제 passed=true 카운트 그대로 노출.
  let semiLeaders = 0, semiFollowers = 0;
  for (const r of qPrelim.data ?? []) {
    if (r.role === 'leader') semiLeaders++;
    else if (r.role === 'follower') semiFollowers++;
  }
  let finalLeaders = 0, finalFollowers = 0;
  for (const r of qSemi.data ?? []) {
    if (r.role === 'leader') finalLeaders++;
    else if (r.role === 'follower') finalFollowers++;
  }

  const finalLeaderPodium: FinalPodiumEntry[] = [];
  const finalFollowerPodium: FinalPodiumEntry[] = [];
  for (const r of (finalsRows.data ?? []) as Array<{ role: 'leader' | 'follower'; team_name: string; participant_num: string; final_rank: number | null }>) {
    if (r.final_rank == null || r.final_rank < 1 || r.final_rank > FINAL_PODIUM_MAX_RANK) continue;
    const entry: FinalPodiumEntry = { rank: r.final_rank, num: r.participant_num ?? '', name: r.team_name, score: '' };
    if (r.role === 'leader') finalLeaderPodium.push(entry);
    else if (r.role === 'follower') finalFollowerPodium.push(entry);
  }
  finalLeaderPodium.sort((a, b) => a.rank - b.rank);
  finalFollowerPodium.sort((a, b) => a.rank - b.rank);

  return {
    ...counts,
    semiLeaders,
    semiFollowers,
    finalLeaders,
    finalFollowers,
    prelimPassCouples: contest.prelim_pass_per_role,
    semiPassCouples: contest.semi_pass_per_role,
    finalLeaderPodium,
    finalFollowerPodium,
  };
}

// finalLeaderPodium 의 score 도 채워주기 위해 podium 만 별도 조회 (위에서 score 가 텍스트라 number→string 변환 필요).
async function getFinalPodiumWithScore(
  contestId: string
): Promise<{ finalLeaderPodium: FinalPodiumEntry[]; finalFollowerPodium: FinalPodiumEntry[] }> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('final_results')
    .select('role,team_name,participant_num,final_rank,total_score')
    .eq('contest_id', contestId);
  if (error) throw new Error(`getFinalPodiumWithScore: ${error.message}`);

  const leaders: FinalPodiumEntry[] = [];
  const followers: FinalPodiumEntry[] = [];
  for (const r of (data ?? []) as Array<{
    role: 'leader' | 'follower'; team_name: string; participant_num: string; final_rank: number | null; total_score: number | null;
  }>) {
    if (r.final_rank == null || r.final_rank < 1 || r.final_rank > FINAL_PODIUM_MAX_RANK) continue;
    const entry: FinalPodiumEntry = {
      rank: r.final_rank,
      num: r.participant_num ?? '',
      name: r.team_name,
      score: r.total_score == null ? '' : String(r.total_score),
    };
    if (r.role === 'leader') leaders.push(entry);
    else followers.push(entry);
  }
  leaders.sort((a, b) => a.rank - b.rank);
  followers.sort((a, b) => a.rank - b.rank);
  return { finalLeaderPodium: leaders, finalFollowerPodium: followers };
}

// ─── Meta ────────────────────────────────────────────────────────────────

export async function getContestMeta(contestId: string): Promise<ContestMeta | null> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from('contests').select('*').eq('id', contestId).maybeSingle();
  if (error) throw new Error(`getContestMeta: ${error.message}`);
  if (!data) return null;
  const contest = data as ContestRow;

  const [stats, podium] = await Promise.all([
    getParticipantStats(contest),
    getFinalPodiumWithScore(contestId),
  ]);
  // score 가 채워진 podium 으로 교체
  stats.finalLeaderPodium = podium.finalLeaderPodium;
  stats.finalFollowerPodium = podium.finalFollowerPodium;

  return {
    contestId: contest.id,
    name: contest.name,
    designTemplateNumber: contest.design_template_number,
    festivalHeader: contest.festival_header || contest.name,
    tagline: contest.tagline ?? '',
    participantStats: stats,
    backgroundImage: contest.background_image ?? '',
    backgroundOpacity:
      typeof contest.background_opacity === 'number' ? contest.background_opacity : 100,
    rounds: {
      prelim: { label: '예선', steps: STEPS_BY_ROUND.prelim },
      semi: { label: '본선', steps: STEPS_BY_ROUND.semi },
      final: { label: '결승', steps: STEPS_BY_ROUND.final },
    },
  };
}

// ─── Pairings ────────────────────────────────────────────────────────────

async function getConfirmedPairs(
  contestId: string,
  round: 'prelim' | 'semi'
): Promise<Pair[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('pairings')
    .select('*')
    .eq('contest_id', contestId)
    .eq('round', round)
    .eq('status', 'confirmed')
    .order('pair_idx', { ascending: true });
  if (error) throw new Error(`getConfirmedPairs: ${error.message}`);
  return ((data ?? []) as PairingRow[]).map((p) => ({
    idx: p.pair_idx,
    leader: p.leader_name || HELPER_NAME,
    leaderNum: p.leader_name ? p.leader_num : HELPER_NUM,
    follower: p.follower_name || HELPER_NAME,
    followerNum: p.follower_name ? p.follower_num : HELPER_NUM,
  }));
}

// ─── Qualifiers / Finals ─────────────────────────────────────────────────

async function getQualifiersForResult(
  contestId: string,
  round: 'prelim' | 'semi',
  maxPerRole: number
): Promise<{ leaders: ResultEntry[]; followers: ResultEntry[]; rawAll: QualifierRow[] }> {
  // judge_votes 기반 라이브 votes 가 채워진 qualifiers — Prelim/Semi Judging 에서
  // 점수 한 표라도 받은 사람만 통과 후보로 인정.
  const [rows, photoMap] = await Promise.all([
    listQualifiersWithLiveVotes(contestId, round),
    getParticipantPhotoMap(contestId),
  ]);

  function buildList(role: 'leader' | 'follower'): ResultEntry[] {
    const roleRows = rows.filter((r) => r.role === role);
    // 1) votes > 0 인 후보만 (점수 못 받은 사람 제외)
    const eligible = roleRows.filter((r) => r.votes > 0);
    const passed = eligible.filter((r) => r.passed)
      .sort((a, b) => (a.display_order - b.display_order) || (b.votes - a.votes));
    const unpassed = eligible.filter((r) => !r.passed)
      .sort((a, b) => (b.votes - a.votes) || (a.display_order - b.display_order));
    // 2) 커밋(확정)된 라운드는 운영자의 passed 를 그대로 반영 — 동점 추려내기로 정원보다
    //    적게 확정했어도 자동 보강하지 않는다. (qualifiers 행이 있으면 = 커밋됨)
    //    미커밋(qualifiers 비어있음) 상태에서만 votes desc 로 정원만큼 미리보기 채움.
    const committed = roleRows.length > 0;
    const need = committed ? 0 : Math.max(0, maxPerRole - passed.length);
    const combined = [...passed, ...unpassed.slice(0, need)];
    return combined.map((r, i) => ({
      idx: i + 1,
      name: r.team_name,
      num: r.participant_num,
      photo: normalizePhotoUrl(r.photo_url) || photoMap.get(r.participant_num) || '',
    }));
  }

  return {
    leaders: buildList('leader'),
    followers: buildList('follower'),
    rawAll: rows,
  };
}

async function getFinalResults(
  contestId: string
): Promise<{ leaders: ResultEntry[]; followers: ResultEntry[]; rows: FinalResultRow[] }> {
  const sb = getSupabaseAdmin();
  const [{ data, error }, photoMap] = await Promise.all([
    sb.from('final_results').select('*').eq('contest_id', contestId),
    getParticipantPhotoMap(contestId),
  ]);
  if (error) throw new Error(`getFinalResults: ${error.message}`);
  const rows = (data ?? []) as FinalResultRow[];
  const leaders: ResultEntry[] = [];
  const followers: ResultEntry[] = [];
  for (const r of rows) {
    if (r.final_rank == null || r.final_rank < 1 || r.final_rank > 3) continue;
    // 1순위: final_results.photo_url (normalize) — 2순위: participants 폴백
    const photo = normalizePhotoUrl(r.photo_url) || photoMap.get(r.participant_num) || '';
    const entry: ResultEntry = {
      idx: r.final_rank, name: r.team_name, num: r.participant_num, photo,
    };
    if (r.role === 'leader' && !leaders.find((x) => x.idx === r.final_rank)) leaders.push(entry);
    else if (r.role === 'follower' && !followers.find((x) => x.idx === r.final_rank)) followers.push(entry);
  }
  leaders.sort((a, b) => a.idx - b.idx);
  followers.sort((a, b) => a.idx - b.idx);
  return { leaders, followers, rows };
}

// ─── Overflow / Final Tie ────────────────────────────────────────────────

async function computeOverflowInfo(
  contestId: string,
  round: 'prelim' | 'semi',
  maxPerRole: number
): Promise<ResultData['overflow']> {
  // Overflow 는 passed=true 가 정원 초과한 경우만. 자동 보강분은 overflow 가 아님.
  const { rawAll } = await getQualifiersForResult(contestId, round, maxPerRole);
  const passedLeaders = rawAll.filter((r) => r.passed && r.role === 'leader');
  const passedFollowers = rawAll.filter((r) => r.passed && r.role === 'follower');
  const leaderOverflow = Math.max(0, passedLeaders.length - maxPerRole);
  const followerOverflow = Math.max(0, passedFollowers.length - maxPerRole);
  if (leaderOverflow === 0 && followerOverflow === 0) return undefined;

  const toEntry = (q: QualifierRow): OverflowEntry => ({
    num: q.participant_num, name: q.team_name, votes: q.votes,
  });
  const leaderEntries = passedLeaders.map(toEntry).sort((a, b) => b.votes - a.votes);
  const followerEntries = passedFollowers.map(toEntry).sort((a, b) => b.votes - a.votes);

  return {
    maxPerRole,
    leaderTotal: passedLeaders.length,
    followerTotal: passedFollowers.length,
    leaderOverflow,
    followerOverflow,
    leaderEntries,
    followerEntries,
  };
}

async function computeFinalTieInfo(contestId: string): Promise<FinalTieInfo | undefined> {
  const { rows } = await getFinalResults(contestId);
  const leaderEntries: FinalTieEntry[] = [];
  const followerEntries: FinalTieEntry[] = [];
  for (const r of rows) {
    if (r.final_rank == null || r.final_rank < 1 || r.final_rank > 3) continue;
    const entry: FinalTieEntry = {
      num: r.participant_num,
      name: r.team_name,
      rank: r.final_rank,
      score: r.total_score == null ? '' : String(r.total_score),
    };
    if (r.role === 'leader') leaderEntries.push(entry);
    else if (r.role === 'follower') followerEntries.push(entry);
  }
  leaderEntries.sort((a, b) => a.rank - b.rank);
  followerEntries.sort((a, b) => a.rank - b.rank);
  const lc = new Map<number, number>();
  for (const e of leaderEntries) lc.set(e.rank, (lc.get(e.rank) ?? 0) + 1);
  const fc = new Map<number, number>();
  for (const e of followerEntries) fc.set(e.rank, (fc.get(e.rank) ?? 0) + 1);
  const hasTie =
    [...lc.values()].some((c) => c > 1) || [...fc.values()].some((c) => c > 1);
  if (!hasTie) return undefined;
  return { leaderEntries, followerEntries, hasTie };
}

// ─── Static steps ───────────────────────────────────────────────────────

function staticPrep(
  roundLabel: string,
  festivalHeader: string,
  tagline: string,
  sponsorLogos: string[] = [],
  sponsorOpacities: number[] = [],
): StepDataPayload {
  return {
    kind: 'prep',
    data: {
      festival_header: festivalHeader,
      stage_label: `${roundLabel.toUpperCase()} ROUND`,
      round_title: 'PREPARING',
      round_subtitle: 'Get ready · take your places',
      participants: '',
      tagline,
      sponsor_logos: sponsorLogos,
      sponsor_logo_opacities: sponsorOpacities,
    },
  };
}

function staticOpen(
  roundLabel: string,
  festivalHeader: string,
  tagline: string,
  sponsorLogos: string[] = [],
  sponsorOpacities: number[] = [],
): StepDataPayload {
  return {
    kind: 'open',
    data: {
      festival_header: festivalHeader,
      round_title: `${roundLabel.toUpperCase()} ROUND`,
      open_quote: '"Let the rhythm guide you."',
      open_subline: 'LET THE DANCE BEGIN',
      tagline,
      sponsor_logos: sponsorLogos,
      sponsor_logo_opacities: sponsorOpacities,
    },
  };
}

function staticLive(
  roundLabel: string,
  festivalHeader: string,
  tagline: string,
  sponsorLogos: string[] = [],
  sponsorOpacities: number[] = [],
): StepDataPayload {
  return {
    kind: 'live',
    data: {
      festival_header: festivalHeader,
      stage_label: `${roundLabel.toUpperCase()} ROUND`,
      round_title: roundLabel.toUpperCase(),
      live_message: 'The stage belongs to the dancers',
      tagline,
      sponsor_logos: sponsorLogos,
      sponsor_logo_opacities: sponsorOpacities,
    },
  };
}

function staticClose(
  roundLabel: string,
  festivalHeader: string,
  tagline: string,
  sponsorLogos: string[] = [],
  sponsorOpacities: number[] = [],
): StepDataPayload {
  return {
    kind: 'close',
    data: {
      festival_header: festivalHeader,
      stage_label: `${roundLabel.toUpperCase()} ROUND`,
      close_title: 'ROUND COMPLETE',
      close_subtitle: `${roundLabel.toUpperCase()} · CLOSED`,
      close_message: 'Thank you to all dancers',
      tagline,
      sponsor_logos: sponsorLogos,
      sponsor_logo_opacities: sponsorOpacities,
    },
  };
}

/**
 * 심사위원 소개 화면 데이터 — judges 테이블의 prelim 라운드 행만 추출.
 * (한 명의 심사위원이 prelim/semi/final 3 row 로 mirror 되므로 한 라운드만 보면 충분)
 * display_order 오름차순. 최대 20명까지 노출 — 그 이상은 단순 슬라이스.
 */
async function buildJudgesIntro(
  contestId: string,
  roundLabel: string,
  festivalHeader: string,
  tagline: string,
): Promise<StepDataPayload> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('judges')
    .select('display_order,name,alias,specialty,photo_url')
    .eq('contest_id', contestId)
    .eq('round', 'prelim')
    .order('display_order', { ascending: true })
    .limit(20);
  if (error) throw new Error(`buildJudgesIntro: ${error.message}`);

  const rows = (data ?? []) as Array<{
    display_order: number;
    name: string;
    alias: string | null;
    specialty: string | null;
    photo_url: string | null;
  }>;

  const judges: JudgesIntroEntry[] = rows.map((r, i) => ({
    idx: i + 1, // 1-based slot index — 빈 자리는 없도록 압축 후 재할당
    name: r.name ?? '',
    alias: r.alias ?? '',
    specialty: r.specialty ?? '',
    photo: r.photo_url ?? '',
  }));

  const out: JudgesIntroData = {
    festival_header: festivalHeader,
    stage_label: `${roundLabel.toUpperCase()} ROUND`,
    intro_title: 'OUR JUDGES',
    intro_subtitle: 'Honoring the experts who guide us',
    judges,
    tagline,
  };
  return { kind: 'judgesIntro', data: out };
}

function staticWrapup(
  roundLabel: string,
  festivalHeader: string,
  tagline: string,
  sponsorLogos: string[] = [],
  sponsorOpacities: number[] = [],
): StepDataPayload {
  return {
    kind: 'wrapup',
    data: {
      festival_header: festivalHeader,
      stage_label: `${roundLabel.toUpperCase()} ROUND`,
      wrap_title: 'CALCULATING TOTAL',
      wrap_subtitle: 'IN PROGRESS',
      wrap_message: 'Please stand by — results coming up shortly',
      tagline,
      sponsor_logos: sponsorLogos,
      sponsor_logo_opacities: sponsorOpacities,
    },
  };
}

// ─── Main entry point ───────────────────────────────────────────────────

export interface GetStepDataParams {
  contestId: string;
  round: RoundKey;
  step: StepKey;
  /** 호환을 위해 유지 — DB 가 진실 원천이라 의미 없음. */
  refresh?: boolean;
}

export async function getStepData(params: GetStepDataParams): Promise<StepDataPayload> {
  const { contestId, round, step } = params;

  const allowedSteps = STEPS_BY_ROUND[round];
  if (!allowedSteps.includes(step)) {
    throw new StepNotAvailableError(round, step);
  }

  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from('contests').select('*').eq('id', contestId).maybeSingle();
  if (error) throw new Error(`getStepData(contests): ${error.message}`);
  if (!data) throw new ContestNotFoundError(contestId);
  const contest = data as ContestRow;
  const festivalHeader = contest.festival_header || contest.name;
  const tagline = contest.tagline ?? '';
  const roundLabel = ROUND_LABELS[round];

  // ── Pairing 류 ──
  if (step === 'pairing' || step === 'pairingB' || step === 'pairingC') {
    if (round === 'final') {
      // 결승은 자동 매핑 없음 — 빈 페어 + PAIRING 화면만.
      // 하단 광고는 PREP 과 동일한 스폰서 로고 6슬롯 표출.
      return {
        kind: 'pairing',
        data: {
          festival_header: festivalHeader,
          stage_label: 'GRAND FINAL',
          round_title: 'PAIRING',
          label_leader: 'LEADER',
          label_follower: 'FOLLOWER',
          pairs: [],
          tagline: '',
          sponsor_logos: Array.isArray(contest.sponsor_logos) ? contest.sponsor_logos : [],
          sponsor_logo_opacities: Array.isArray(contest.sponsor_logo_opacities) ? contest.sponsor_logo_opacities : [],
        },
      };
    }
    const pairs = await getConfirmedPairs(contestId, round);

    // 페이지 분할 — sheets adapter 와 동일 규칙.
    const pageLetter = step === 'pairingC' ? 'C' : step === 'pairingB' ? 'B' : 'A';
    const pageIndex = pageLetter === 'C' ? 2 : pageLetter === 'B' ? 1 : 0;
    const sortedPairs = pairs.slice().sort((a, b) => a.idx - b.idx);

    // 페이지 분할 — 관리자 설정 그룹(prelim_groups/semi_groups)을 우선 사용해
    // 표출(DASH) 페어링도 관리자 페어링 화면과 동일하게 A·B·C 로 나눈다.
    // 그룹 미설정 시 기존 고정 규칙(예선 20씩, 본선 반반)으로 폴백.
    const groups = round === 'prelim' ? contest.prelim_groups : contest.semi_groups;
    let pagedPairs: Pair[];
    if (Array.isArray(groups) && groups.length > 0) {
      const sizes = groups.map((n) => Math.max(0, Math.floor(Number(n) || 0)));
      let start = 0;
      for (let g = 0; g < pageIndex && g < sizes.length; g++) start += sizes[g];
      // 마지막 표출 페이지(C)는 정의된 그룹 합을 넘는 잔여 페어까지 흡수(표출 누락 방지).
      const end = pageIndex >= 2 ? sortedPairs.length : start + (sizes[pageIndex] ?? 0);
      const lo = Math.min(start, sortedPairs.length);
      const hi = Math.min(Math.max(start, end), sortedPairs.length);
      pagedPairs = sortedPairs.slice(lo, hi).map((p, i) => ({ ...p, idx: i + 1 }));
    } else if (round === 'prelim') {
      const PAGE_SIZE = 20;
      const lo = pageIndex * PAGE_SIZE + 1;
      const hi = (pageIndex + 1) * PAGE_SIZE;
      pagedPairs = sortedPairs.filter((p) => p.idx >= lo && p.idx <= hi).map((p, i) => ({ ...p, idx: i + 1 }));
    } else {
      const half = Math.ceil(sortedPairs.length / 2);
      const slice = pageLetter === 'B' ? sortedPairs.slice(half) : sortedPairs.slice(0, half);
      pagedPairs = slice.map((p, i) => ({ ...p, idx: i + 1 }));
    }

    const pageSuffix = ` · ${pageLetter}`;
    const out: PairingData = {
      festival_header: festivalHeader,
      stage_label: `${roundLabel.toUpperCase()} ROUND${pageSuffix}`,
      round_title: 'RANDOM PAIRING',
      label_leader: 'LEADER',
      label_follower: 'FOLLOWER',
      pairs: pagedPairs,
      tagline: '',
    };
    return { kind: 'pairing', data: out };
  }

  // ── Result ──
  if (step === 'result') {
    const yearSrc = contest.period_start || contest.name;
    const yearMatch = String(yearSrc).match(/\b(\d{4})\b/);
    const year = yearMatch ? yearMatch[1] : new Date().getFullYear().toString();

    if (round === 'final') {
      const { leaders, followers } = await getFinalResults(contestId);
      const finalTie = await computeFinalTieInfo(contestId);
      const out: ResultData = {
        festival_header: festivalHeader,
        result_title: 'CHAMPIONS',
        result_subtitle: `JEJU ${year} · GRAND FINAL`,
        label_leader: 'LEADER',
        label_follower: 'FOLLOWER',
        leaders: leaders.slice(0, 3),
        followers: followers.slice(0, 3),
        tagline: '',
        finalTie,
      };
      return { kind: 'result', data: out };
    }

    // prelim / semi — 정원 만큼 자동 채움 (passed=true 우선, 부족분은 후순위로 보강)
    const maxPerRole = round === 'prelim' ? contest.prelim_pass_per_role : contest.semi_pass_per_role;
    const { leaders, followers } = await getQualifiersForResult(contestId, round, maxPerRole);
    const overflow = await computeOverflowInfo(contestId, round, maxPerRole);
    const resultTitle = round === 'prelim' ? 'QUALIFIED' : 'FINALISTS';
    const resultSubtitle = round === 'prelim' ? 'ADVANCING TO SEMI-FINAL' : 'ADVANCING TO GRAND FINAL';
    const out: ResultData = {
      festival_header: festivalHeader,
      result_title: resultTitle,
      result_subtitle: resultSubtitle,
      label_leader: 'LEADER',
      label_follower: 'FOLLOWER',
      leaders: leaders.slice(0, maxPerRole),
      followers: followers.slice(0, maxPerRole),
      tagline: '',
      overflow,
    };
    return { kind: 'result', data: out };
  }

  // ── Ceremony (final 만) ──
  if (step === 'ceremony') {
    if (round !== 'final') throw new StepNotAvailableError(round, step);
    const { leaders, followers } = await getFinalResults(contestId);
    const out: CeremonyData = {
      festival_header: festivalHeader,
      ceremony_title: 'CHAMPIONS',
      ceremony_subtitle: '',
      label_leader: 'LEADER',
      label_follower: 'FOLLOWER',
      leaders: leaders.slice(0, 3),
      followers: followers.slice(0, 3),
      tagline: '',
      sponsor_logos: Array.isArray(contest.sponsor_logos) ? contest.sponsor_logos : [],
      sponsor_logo_opacities: Array.isArray(contest.sponsor_logo_opacities) ? contest.sponsor_logo_opacities : [],
    };
    return { kind: 'ceremony', data: out };
  }

  // ── Judges Intro (prelim 만) ──
  if (step === 'judgesIntro') {
    return buildJudgesIntro(contestId, roundLabel, festivalHeader, tagline);
  }

  // ── Static ──
  // PREP / OPEN / LIVE / CALC(wrapup) / CLOSE 모두 하단 6슬롯 광고 노출 — sponsor 데이터 공통 전달.
  const sponsorLogos = Array.isArray(contest.sponsor_logos) ? contest.sponsor_logos : [];
  const sponsorOpacities = Array.isArray(contest.sponsor_logo_opacities) ? contest.sponsor_logo_opacities : [];
  switch (step) {
    case 'prep':
      return staticPrep(roundLabel, festivalHeader, tagline, sponsorLogos, sponsorOpacities);
    case 'open':
      return staticOpen(roundLabel, festivalHeader, tagline, sponsorLogos, sponsorOpacities);
    case 'live':
      return staticLive(roundLabel, festivalHeader, tagline, sponsorLogos, sponsorOpacities);
    case 'wrapup': {
      const base = staticWrapup(roundLabel, festivalHeader, tagline, sponsorLogos, sponsorOpacities);
      if (base.kind === 'wrapup') {
        if (round === 'final') {
          base.data.finalTie = await computeFinalTieInfo(contestId);
        } else {
          const maxPerRole = round === 'prelim' ? contest.prelim_pass_per_role : contest.semi_pass_per_role;
          base.data.overflow = await computeOverflowInfo(contestId, round, maxPerRole);
        }
      }
      return base;
    }
    case 'close':
      return staticClose(roundLabel, festivalHeader, tagline, sponsorLogos, sponsorOpacities);
  }

  throw new StepNotAvailableError(round, step);
}

// 호환: sheets adapter 의 invalidateSheetCache 자리. DB 는 캐시가 없어 no-op.
export function invalidateContestCache(_contestId: string): void {
  void _contestId;
  // intentionally no-op
}
