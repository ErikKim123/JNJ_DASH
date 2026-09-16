// 공개 결과 페이지(/results/<대회ID>)가 읽는 데이터 한 벌.
//
// 화면이 필요한 모양으로 여기서 다 빚어서 넘긴다 — 페이지 컴포넌트는 표만 그린다.
// 게시 여부 판단도 여기 있다: 공개 페이지와 관리 화면이 서로 다른 기준으로
// '게시됐다' 를 판정하면 운영자가 켠 것 같은데 안 보이는 상황이 생긴다.
import {
  getContest,
  listFinalResults,
  listQualifiers,
  listParticipants,
} from '@/lib/db/queries';
import type { FinalRole, QualifierRoundDb } from '@/lib/db/types';

/** 결승 표 한 줄 — RANK / NO / DANCER / TOTAL / AVG. */
export interface PublicFinalRow {
  rank: number | null;
  num: string;
  name: string;
  country: string;
  photoUrl: string;
  total: number | null;
  average: number | null;
}

/** 예선·본선 표 한 줄 — 통과 여부만 밝힌다(점수는 라운드 성격상 순위가 아니다). */
export interface PublicQualifierRow {
  num: string;
  name: string;
  country: string;
  photoUrl: string;
  votes: number;
  passed: boolean;
}

/** 참가자 명단 한 줄 — 결과가 아니라 '누가 나오는지' 만 밝힌다. */
export interface PublicParticipantRow {
  num: string;
  name: string;
  country: string;
  photoUrl: string;
}

export interface PublicRoundBlock<T> {
  leaders: T[];
  followers: T[];
}

export interface PublicResults {
  contestId: string;
  contestName: string;
  hostOrg: string;
  /** 표출용 헤더 문구. 비어 있으면 대회명을 쓴다. */
  header: string;
  tagline: string;
  periodStart: string | null;
  periodEnd: string | null;
  iconUrl: string;
  publishedAt: string | null;
  /** 섹션별 게시 여부 — 꺼진 섹션은 아래 블록이 비어 있고 화면에도 나오지 않는다. */
  sections: {
    participants: boolean;
    prelim: boolean;
    semi: boolean;
    final: boolean;
  };
  participants: PublicRoundBlock<PublicParticipantRow>;
  final: PublicRoundBlock<PublicFinalRow>;
  semi: PublicRoundBlock<PublicQualifierRow>;
  prelim: PublicRoundBlock<PublicQualifierRow>;
  /** 시상대 — 리더/팔로워 각각 1~3위. 없으면 빈 배열. */
  podium: PublicRoundBlock<PublicFinalRow>;
}

/** 'leader'/'helper_leader' 를 결승 역할 두 갈래로 접는다. */
function toFinalRole(role: string): FinalRole {
  return role.includes('follower') ? 'follower' : 'leader';
}

function num(x: unknown): number | null {
  if (x == null || x === '') return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

/**
 * 게시된 대회의 결과를 읽는다.
 *
 * 게시가 꺼져 있으면 null — 호출부는 이걸 그대로 404 로 옮긴다. 채점이 끝나기 전에
 * 주소를 찍어 봐도 중간 순위가 새지 않게 하는 것이 이 함수의 핵심 계약이다.
 */
export async function getPublicResults(contestId: string): Promise<PublicResults | null> {
  const contest = await getContest(contestId);
  if (!contest) return null;

  const sections = {
    participants: contest.participants_published === true,
    prelim: contest.prelim_published === true,
    semi: contest.semi_published === true,
    final: contest.results_published === true,
  };
  // 네 섹션이 모두 꺼져 있으면 주소 자체를 닫는다 — 채점 중 링크가 새도 아무것도 보이지 않는다.
  if (!sections.participants && !sections.prelim && !sections.semi && !sections.final) return null;

  const [finals, semi, prelim, participants] = await Promise.all([
    listFinalResults(contestId),
    listQualifiers(contestId, 'semi' as QualifierRoundDb),
    listQualifiers(contestId, 'prelim' as QualifierRoundDb),
    listParticipants(contestId),
  ]);

  // 국가·사진은 참가자 명단이 가장 최신이다 — 결과 행에 복사돼 있는 값은
  // 확정 시점의 스냅샷이라 그 뒤 사진을 바꿔도 따라오지 않는다.
  const byNum = new Map(participants.map((p) => [p.num, p]));
  const meta = (n: string) => {
    const p = byNum.get(n);
    return { country: p?.representative ?? '', photo: p?.photo_url ?? '' };
  };

  const finalRows = finals.map((f) => {
    const m = meta(f.participant_num);
    const row: PublicFinalRow = {
      rank: f.final_rank ?? null,
      num: f.participant_num,
      name: f.team_name || f.participant_num,
      country: m.country,
      photoUrl: f.photo_url || m.photo,
      total: num(f.total_score),
      average: num(f.average),
    };
    return { role: f.role, row };
  });

  // 순위 없는 행(점수만 넣고 아직 순위를 안 매긴 경우)은 뒤로 보낸다.
  const byRank = (a: PublicFinalRow, b: PublicFinalRow) =>
    (a.rank ?? 9999) - (b.rank ?? 9999) || a.num.localeCompare(b.num);

  const pickRole = (role: FinalRole) =>
    finalRows.filter((x) => x.role === role).map((x) => x.row).sort(byRank);

  const finalBlock: PublicRoundBlock<PublicFinalRow> = {
    leaders: pickRole('leader'),
    followers: pickRole('follower'),
  };

  const qualBlock = (rows: typeof semi): PublicRoundBlock<PublicQualifierRow> => {
    const map = (r: (typeof rows)[number]): PublicQualifierRow => {
      const m = meta(r.participant_num);
      return {
        num: r.participant_num,
        name: r.team_name || r.participant_num,
        country: r.representative || m.country,
        photoUrl: r.photo_url || m.photo,
        votes: r.votes ?? 0,
        passed: r.passed === true,
      };
    };
    return {
      leaders: rows.filter((r) => toFinalRole(r.role) === 'leader').map(map),
      followers: rows.filter((r) => toFinalRole(r.role) === 'follower').map(map),
    };
  };

  const top3 = (rows: PublicFinalRow[]) => rows.filter((r) => r.rank != null && r.rank <= 3).slice(0, 3);

  // 참가자 명단 — 헬퍼(운영 보조)는 빼고 리더/팔로워만. 번호순.
  const participantRow = (p: (typeof participants)[number]): PublicParticipantRow => ({
    num: p.num,
    name: p.team_name || p.last_name || p.num,
    country: p.representative ?? '',
    photoUrl: p.photo_url ?? '',
  });
  const dancers = participants.filter((p) => !p.role.startsWith('helper'));
  const participantBlock: PublicRoundBlock<PublicParticipantRow> = {
    leaders: dancers.filter((p) => p.role === 'leader').map(participantRow),
    followers: dancers.filter((p) => p.role === 'follower').map(participantRow),
  };

  const empty = <T,>(): PublicRoundBlock<T> => ({ leaders: [], followers: [] });

  // 게시 시각 — 켜져 있는 섹션 중 가장 최근에 켠 시각을 쓴다.
  const publishedAt =
    [
      sections.participants ? contest.participants_published_at : null,
      sections.prelim ? contest.prelim_published_at : null,
      sections.semi ? contest.semi_published_at : null,
      sections.final ? contest.results_published_at : null,
    ]
      .filter((v): v is string => typeof v === 'string' && v.length > 0)
      .sort()
      .pop() ?? null;

  return {
    contestId: contest.id,
    contestName: contest.name,
    hostOrg: contest.host_org ?? '',
    header: contest.festival_header || contest.name,
    tagline: contest.tagline ?? '',
    periodStart: contest.period_start,
    periodEnd: contest.period_end,
    iconUrl: contest.icon_image ?? '',
    publishedAt,
    sections,
    participants: sections.participants ? participantBlock : empty<PublicParticipantRow>(),
    final: sections.final ? finalBlock : empty<PublicFinalRow>(),
    semi: sections.semi ? qualBlock(semi) : empty<PublicQualifierRow>(),
    prelim: sections.prelim ? qualBlock(prelim) : empty<PublicQualifierRow>(),
    podium: sections.final
      ? { leaders: top3(finalBlock.leaders), followers: top3(finalBlock.followers) }
      : empty<PublicFinalRow>(),
  };
}
