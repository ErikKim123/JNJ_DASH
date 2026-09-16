// 결승 시상대(1~3위) → Wolf 우승자관리(jnj_winners) 게시.
//
// Wolf 와 J&J Dash 는 **같은 Supabase 프로젝트**를 쓴다. 그래서 바깥으로 나가는 API 없이
// 이 앱의 service_role 클라이언트로 Wolf 테이블에 바로 쓴다.
//
// 지금까지 이 일은 Wolf 어드민의 [J&J 결과 가져오기] 가 맡았다(가져오는 방향).
// 그러면 결과를 확정한 사람과 게시하는 사람이 다른 화면에 있어, 확정 후 누군가
// Wolf 에 들어가 한 번 더 눌러야 시상대가 뜬다. 여기서 밀어 넣으면 확정한 자리에서 끝난다.
//
// 넣는 값·규칙은 Wolf 의 가져오기와 한 글자도 다르면 안 된다 — 같은 대회를 어느 쪽으로
// 넣었느냐에 따라 점수나 국기가 달라지면 그게 더 나쁜 버그다. 아래 weightedTotal /
// normalizePhotoUrl / NO_IMAGE_URL / replace 범위는 모두 Wolf 쪽 구현을 그대로 옮긴 것이다.
//   참고: wolf/apps/admin/src/lib/queries/jnj-import.ts
import { getSupabaseAdmin } from '@/lib/db/client';
import { computeFinalScores, exportScore } from '@/lib/judging/final-score';
import { toCountryCode } from './country';

/** 시상대는 1~3위까지만. 4위 이하 전체 성적표는 Wolf 의 'J&J 점수관리'(jnj_scores)가 맡는다. */
export const PODIUM_RANK = 3;

/** 사진 없는 우승자에 대신 넣는 'NO IMAGE' 플레이스홀더 — Wolf 와 같은 고정 경로. */
export const NO_IMAGE_URL =
  `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''}/storage/v1/object/public/jnj/_placeholder/no-image.png`;

export interface WolfEdition {
  id: string;
  year: number;
  label: string;
}

export interface WolfDivision {
  editionId: string;
  code: string;
  label: string;
}

export interface WinnerEntry {
  /** 선택 식별용 — 역할+참가번호. */
  key: string;
  role: 'leader' | 'follower';
  rank: number;
  num: string;
  name: string;
  /** ISO2. 못 알아본 값은 null 이고 원문은 countryRaw 로 화면에 남긴다. */
  country: string | null;
  countryRaw: string;
  photoUrl: string;
  totalScore: number | null;
  avgScore: number | null;
}

/**
 * Google Drive 공유 링크는 hotlink 가 막혀 lh3 CDN 으로 바꿔야 고객몰에서 뜬다.
 * (Wolf 가져오기와 같은 규칙 — 한쪽만 바꾸면 사진이 한쪽에서만 깨진다.)
 */
export function normalizePhotoUrl(raw: string | null | undefined): string {
  const v = (raw ?? '').trim();
  if (!v) return '';
  if (v.includes('drive.google.com')) {
    const m = v.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ?? v.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (m) return `https://lh3.googleusercontent.com/d/${m[1]}`;
  }
  return /^https?:\/\//i.test(v) ? v : '';
}

/** Wolf 에디션 목록 — 게시 대상 대회(연도 행사)를 고르는 드롭다운용. */
export async function listWolfEditions(): Promise<WolfEdition[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('jnj_editions')
    .select('id, year, title_i18n, sort_order')
    .order('year', { ascending: false })
    .order('sort_order', { ascending: true });
  // Wolf 테이블이 아직 없는 환경(로컬 등)에서는 조용히 빈 목록 — 게시 버튼이 비활성으로 보인다.
  if (error) return [];
  return (data ?? []).map((e) => {
    const t = (e.title_i18n ?? {}) as { en?: string; ko?: string };
    return { id: e.id as string, year: e.year as number, label: t.ko || t.en || String(e.year) };
  });
}

/** Wolf 부문 목록 — 에디션별. 0053 미적용 환경이면 빈 목록. */
export async function listWolfDivisions(): Promise<WolfDivision[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('jnj_divisions')
    .select('edition_id, code, title_i18n, sort_order')
    .order('sort_order', { ascending: true });
  if (error) return [];
  return (data ?? []).map((d) => {
    const t = (d.title_i18n ?? {}) as { en?: string; ko?: string };
    return { editionId: d.edition_id as string, code: d.code as string, label: t.ko || t.en || (d.code as string) };
  });
}

/**
 * 대회의 채점 항목 코드 목록(contests.scoring_items) — 대회마다 다르다.
 * '최종(가중)' 환산의 항목 수이자, 결승 채점 상세(criteria)의 열 순서다.
 * 못 읽으면 빈 배열(= 환산 없이 raw 사용 · 상세 없음).
 */
export async function scoringItems(contestId: string): Promise<string[]> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from('contests')
    .select('scoring_items')
    .eq('id', contestId)
    .maybeSingle();
  const items = (data?.scoring_items ?? []) as unknown;
  return Array.isArray(items) ? items.filter((v): v is string => typeof v === 'string') : [];
}

/** 이 대회의 시상대(리더·팔로워 1~3위) — Wolf 에 넣기 전 미리보기와 실제 게시가 같은 값을 쓴다. */
export async function buildPodiumEntries(contestId: string): Promise<WinnerEntry[]> {
  const sb = getSupabaseAdmin();
  const [fin, parts, scores] = await Promise.all([
    sb
      .from('final_results')
      .select('participant_num, team_name, role, final_rank, total_score, average, photo_url')
      .eq('contest_id', contestId)
      .gte('final_rank', 1)
      .lte('final_rank', PODIUM_RANK)
      .order('role', { ascending: true })
      .order('final_rank', { ascending: true }),
    sb.from('participants').select('num, team_name, representative, photo_url').eq('contest_id', contestId),
    // 관리 화면의 '최종(가중)' 과 같은 산출 — 저장된 스냅샷을 그대로 믿으면 확정 후
    // 점수를 고쳤을 때 화면과 다른 숫자가 고객몰로 나간다.
    computeFinalScores(contestId),
  ]);
  if (fin.error) throw new Error(`buildPodiumEntries: ${fin.error.message}`);

  // 참가자 명단은 폴백일 뿐이라 못 읽어도 결과만으로 진행한다.
  type P = { num: string; team_name: string | null; representative: string | null; photo_url: string | null };
  const byNum = new Map(((parts.data ?? []) as P[]).map((p) => [p.num, p]));

  type F = {
    participant_num: string; team_name: string | null; role: 'leader' | 'follower';
    final_rank: number; total_score: number | null; average: number | null; photo_url: string | null;
  };
  return ((fin.data ?? []) as F[]).map((r) => {
    const p = byNum.get(r.participant_num);
    const countryRaw = (p?.representative ?? '').trim();
    const { totalScore, avgScore } = exportScore(
      scores.breakdown[r.participant_num],
      { total_score: r.total_score, average: r.average },
      scores.itemCount,
    );
    return {
      key: `${r.role}-${r.participant_num}`,
      role: r.role,
      rank: r.final_rank,
      num: r.participant_num,
      name: (r.team_name ?? '').trim() || (p?.team_name ?? '').trim() || r.participant_num,
      country: toCountryCode(countryRaw),
      countryRaw,
      photoUrl: normalizePhotoUrl(r.photo_url) || normalizePhotoUrl(p?.photo_url),
      totalScore,
      avgScore,
    };
  });
}

/** 대상 에디션·부문에 이미 들어 있는 시상대 행 수 — 덮어쓰기 안내에 쓴다. */
export async function countExistingWinners(editionId: string, division: string): Promise<number> {
  const sb = getSupabaseAdmin();
  const { count, error } = await sb
    .from('jnj_winners')
    .select('id', { count: 'exact', head: true })
    .eq('edition_id', editionId)
    .eq('division', division)
    .in('role', ['leader', 'follower'])
    .lte('rank', PODIUM_RANK);
  if (error) return 0;
  return count ?? 0;
}

/**
 * 시상대를 Wolf 에 넣는다.
 *
 * replace=true 면 같은 에디션·부문의 리더/팔로워 1~3위를 먼저 지운다. 지우는 범위를
 * 딱 그만큼으로 좁힌 이유는, 운영자가 손으로 넣은 커플 시상(role='couple')이나
 * 4위 이하 행까지 쓸어 가면 안 되기 때문이다(Wolf 가져오기와 같은 범위).
 */
export async function publishWinnersToWolf(args: {
  editionId: string;
  division: string;
  entries: WinnerEntry[];
  replace: boolean;
}): Promise<{ inserted: number; removed: number }> {
  const sb = getSupabaseAdmin();
  let removed = 0;
  if (args.replace) {
    const { data, error } = await sb
      .from('jnj_winners')
      .delete()
      .eq('edition_id', args.editionId)
      .eq('division', args.division)
      .in('role', ['leader', 'follower'])
      .lte('rank', PODIUM_RANK)
      .select('id');
    if (error) throw new Error(`publishWinnersToWolf(delete): ${error.message}`);
    removed = (data ?? []).length;
  }
  if (args.entries.length === 0) return { inserted: 0, removed };

  const rows = args.entries.map((e) => ({
    edition_id: args.editionId,
    division: args.division,
    role: e.role,
    rank: e.rank,
    entry_no: e.num,
    total_score: e.totalScore,
    avg_score: e.avgScore,
    name: e.name,
    country: e.country,
    // 사진이 없으면 빈 칸 대신 NO IMAGE — 시상대에 이름만 덜렁 남지 않게 한다.
    photo_url: e.photoUrl || NO_IMAGE_URL,
    is_active: true,
  }));
  const { data, error } = await sb.from('jnj_winners').insert(rows).select('id');
  if (error) throw new Error(`publishWinnersToWolf(insert): ${error.message}`);
  return { inserted: (data ?? []).length, removed };
}
