// Design Ref: §3.1, §3.2 — 시트 행렬을 도메인 데이터(StepData)로 변환
// 시트 컬럼이 변경되면 schema.ts만 수정. 본 파일은 schema 추상화에 의존.
import { getSheetRange, SheetsApiError } from './client';
import { getServerEnv } from '@/config/env';
import {
  CONTEST_LIST_COLUMNS,
  CONTEST_LIST_HAS_HEADER,
  parseContestPeriod,
  extractSpreadsheetId,
  locatorToRange,
  DEFAULT_PAIRING_COLUMNS,
  PAIRING_HAS_HEADER,
  DEFAULT_QUALIFIER_COLUMNS,
  QUALIFIER_HAS_HEADER,
  QUALIFIER_ROLE_LEADER,
  QUALIFIER_ROLE_FOLLOWER,
  DEFAULT_FINAL_RESULT_COLUMNS,
  FINAL_RESULT_HAS_HEADER,
  DEFAULT_PARTICIPANT_COLUMNS,
  PARTICIPANT_HAS_HEADER,
  pairingLocator,
  resultLocator,
  SHEET_LOCATORS,
} from './schema';
import {
  getPairingSnapshot,
  savePairingSnapshot,
  clearPairingSnapshot,
} from './snapshot';
import type {
  ContestSummary,
  ContestMeta,
  FinalPodiumEntry,
  FinalTieEntry,
  FinalTieInfo,
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
} from './types';
import { STEPS_BY_ROUND } from './types';

// ─── helpers ────────────────────────────────────────────────────────────────

function cell(row: string[] | undefined, idx: number, fallback = ''): string {
  if (!row) return fallback;
  const v = row[idx];
  return typeof v === 'string' ? v.trim() : fallback;
}

function safeInt(v: string, fallback = 0): number {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * 사진 URL 정규화. 운영팀이 다양한 형식으로 붙여넣어도 외부 사이트에서 임베드 가능한 URL로 변환.
 *  - 빈 문자열은 그대로 빈 문자열 반환
 *  - =IMAGE("url") 수식 텍스트가 들어와도 인용부호 안의 URL만 추출
 *  - Google Drive 공유 링크(/file/d/ID/view, ?id=ID, uc?id=ID) → lh3.googleusercontent.com/d/ID
 *    ↑ uc?export=view 는 CORP 헤더(same-site)로 외부 임베드 차단 — googleusercontent CDN이 유일하게 hotlinking 허용
 *  - 그 외 일반 URL은 그대로 반환
 */
function normalizePhotoUrl(raw: string): string {
  if (!raw) return '';
  let v = raw.trim();
  if (!v) return '';

  // =IMAGE("url", ...) 수식이 텍스트로 보이는 경우 (gviz가 수식 원본을 반환할 때)
  const imageFormulaMatch = v.match(/^=IMAGE\(\s*["']([^"']+)["']/i);
  if (imageFormulaMatch) v = imageFormulaMatch[1];

  // Google Drive 다양한 공유 형식 → lh3.googleusercontent.com CDN URL 로 변환
  // 예: https://drive.google.com/file/d/FILE_ID/view?usp=sharing
  // 예: https://drive.google.com/open?id=FILE_ID
  // 예: https://drive.google.com/uc?id=FILE_ID 또는 ?export=view&id=FILE_ID
  // 예: https://drive.google.com/thumbnail?id=FILE_ID
  if (v.includes('drive.google.com')) {
    const fileIdMatch =
      v.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ?? v.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (fileIdMatch) {
      return `https://lh3.googleusercontent.com/d/${fileIdMatch[1]}`;
    }
  }

  // 절대 URL이 아니면 빈 문자열로 — 파일명/잘못된 텍스트가 들어와도 깨진 이미지 placeholder 회피.
  // 허용: http://, https://, data:image
  if (!/^(https?:\/\/|data:image\/)/i.test(v)) return '';

  return v;
}

// ─── Contest list ───────────────────────────────────────────────────────────

/**
 * 대회별 1.대회정보 시트에서 "디자인 템플릿 번호" 셀(A=라벨, B=값) 조회.
 * 운영팀이 시트 본문에서 직접 1/2/3 등 숫자를 입력함. 누락/오류 시 1로 폴백.
 */
async function getContestDesignTemplateNumber(spreadsheetId: string): Promise<number> {
  try {
    const range = locatorToRange(SHEET_LOCATORS.contestInfo);
    const { values } = await getSheetRange(spreadsheetId, range);
    for (const row of values) {
      if (cell(row, 0) === '디자인 템플릿 번호') {
        const n = safeInt(cell(row, 1), 1);
        return n > 0 ? n : 1;
      }
    }
    return 1;
  } catch {
    return 1;
  }
}

/**
 * 대회별 1.대회정보 시트에서 라운드별 통과 인원(역할별) 조회.
 *   - "예선 통과 인원 (역할별)" → prelim Result 화면의 리더/팔로워 각각 표시 수
 *   - "본선 통과 인원 (역할별)" → semi Result 화면의 리더/팔로워 각각 표시 수
 * A열에 라벨, B열에 숫자. 라벨 매칭은 "예선 통과 인원" / "본선 통과 인원" 포함 여부로 느슨하게 비교.
 * 누락/오류 시 기본값(prelim=10, semi=5) 폴백.
 */
async function getQualifiedCount(
  spreadsheetId: string,
  round: RoundKey
): Promise<number> {
  const fallback = round === 'prelim' ? 10 : round === 'semi' ? 5 : 3;
  if (round === 'final') return 3; // 결승은 1·2·3등 고정
  const keyword = round === 'prelim' ? '예선 통과 인원' : '본선 통과 인원';
  try {
    const range = locatorToRange(SHEET_LOCATORS.contestInfo);
    const { values } = await getSheetRange(spreadsheetId, range);
    for (const row of values) {
      const label = String(cell(row, 0) ?? '').trim();
      if (label.indexOf(keyword) >= 0) {
        const n = safeInt(cell(row, 1), fallback);
        return n > 0 ? n : fallback;
      }
    }
    return fallback;
  } catch {
    return fallback;
  }
}

export async function getContestList(): Promise<ContestSummary[]> {
  const env = getServerEnv();
  // gid 우선, 없으면 탭 이름 폴백
  const range = env.CONTEST_LIST_SHEET_GID
    ? `gid:${env.CONTEST_LIST_SHEET_GID}`
    : env.CONTEST_LIST_SHEET_TAB;
  const { values } = await getSheetRange(env.CONTEST_LIST_SHEET_ID, range);

  const rows = CONTEST_LIST_HAS_HEADER ? values.slice(1) : values;
  const base: Array<Omit<ContestSummary, 'designTemplateNumber'>> = [];
  for (const row of rows) {
    // 시트 컬럼 맵: 실제 운영팀 시트에 맞춰 매핑
    const contestSeq = cell(row, CONTEST_LIST_COLUMNS.contestSeq);
    const fileSlug = cell(row, CONTEST_LIST_COLUMNS.fileNameSlug);
    const name = cell(row, CONTEST_LIST_COLUMNS.contestName);
    const masterUrl = cell(row, CONTEST_LIST_COLUMNS.masterFileUrl);

    // 빈 행 또는 행사 정보 헤더 행 스킵
    if (!name || !masterUrl) continue;

    const spreadsheetId = extractSpreadsheetId(masterUrl);
    if (!spreadsheetId) continue;

    // contestId: H열의 파일명(JNJ-001) 우선, 없으면 A열의 일정 번호
    const contestId = fileSlug || contestSeq;
    if (!contestId) continue;

    const { start, end } = parseContestPeriod(cell(row, CONTEST_LIST_COLUMNS.contestPeriod));

    base.push({
      contestId,
      name,
      spreadsheetId,
      startDate: start,
      endDate: end,
      status: undefined,
    });
  }

  // 디자인 템플릿 번호: 각 대회의 1.대회정보 시트에서 직접 조회 (운영팀이 셀에 입력한 값 사용).
  // gviz는 LRU 캐시(TTL 5초) 적용되므로 동일 세션 내 재호출은 캐시 히트.
  const templateNumbers = await Promise.all(
    base.map((c) => getContestDesignTemplateNumber(c.spreadsheetId))
  );

  return base.map((c, i) => ({ ...c, designTemplateNumber: templateNumbers[i] }));
}

export async function getContestSummary(contestId: string): Promise<ContestSummary | null> {
  const list = await getContestList();
  return list.find((c) => c.contestId === contestId) ?? null;
}

/**
 * 3.참가자 시트의 "역할" 컬럼 값을 분류.
 * 실제 시트 표기: "리더", "팔로워", "헬퍼(리더)", "헬퍼(팔로워)" — 전각 괄호/공백/어순 차이도 정규화 후 매칭.
 * "헬퍼"/"도우미" 키워드가 있으면 sub-역할(리더/팔로워)에 따라 helperLeader/helperFollower로 분류 —
 * 일반 리더/팔로워 카운트에는 포함되지 않음. (Apps Script combined.gs:classifyHelperRole과 동일 규칙)
 */
function classifyParticipantRoleCell(
  raw: string
): 'leader' | 'follower' | 'helperLeader' | 'helperFollower' | 'helperAny' | 'other' {
  if (!raw) return 'other';
  const t = raw.replace(/[（]/g, '(').replace(/[）]/g, ')').replace(/\s+/g, '');
  const hasHelper = t.indexOf('헬퍼') >= 0 || t.indexOf('도우미') >= 0;
  const hasLeader = /리더/.test(t);
  const hasFollower = /팔로워/.test(t);
  if (hasHelper) {
    if (hasLeader) return 'helperLeader';
    if (hasFollower) return 'helperFollower';
    return 'helperAny';
  }
  if (hasLeader) return 'leader';
  if (hasFollower) return 'follower';
  return 'other';
}

/**
 * 3.참가자 시트의 "역할" 컬럼을 행 단위로 카운트.
 * 실제 시트 구조: 한 행 = 한 명, 역할 컬럼 값은 "리더"/"팔로워"/"헬퍼(리더)"/"헬퍼(팔로워)" 중 하나.
 *  - 헤더 행은 헤더 텍스트에 "참가번호"가 포함된 행으로 동적 탐지 (다른 안내 텍스트가 함께 들어가도 안전).
 *  - 헬퍼는 일반 리더/팔로워와 분리해서 카운트.
 *  - 시트 조회/파싱 실패 시 0으로 폴백.
 */
async function getParticipantRoleCounts(
  spreadsheetId: string
): Promise<{ leaders: number; followers: number; helperLeaders: number; helperFollowers: number }> {
  const empty = { leaders: 0, followers: 0, helperLeaders: 0, helperFollowers: 0 };
  try {
    const range = locatorToRange(SHEET_LOCATORS.participants);
    const { values } = await getSheetRange(spreadsheetId, range);
    if (!values || values.length === 0) return empty;

    // 헤더 행 탐지 — A열 셀에 "참가번호"라는 단어가 포함된 행 (운영팀이 안내 텍스트를
    // 같은 셀에 함께 넣어두기도 함). 못 찾으면 0번째 행을 헤더로 가정.
    let headerIdx = -1;
    for (let i = 0; i < Math.min(values.length, 10); i++) {
      if (cell(values[i], 0).indexOf('참가번호') >= 0) { headerIdx = i; break; }
    }
    if (headerIdx < 0) headerIdx = 0;

    // 헤더 텍스트는 trim 후 정확 일치로만 매칭.
    // (운영팀이 첫 헤더 셀에 "📋 기본 정보 ⚠️ ... [역할별 (리더/팔로워)] ... 참가번호" 같은
    //  긴 안내 텍스트를 함께 넣어두기 때문에 indexOf로 검사하면 그 셀이 잘못 매칭됨)
    const headers = (values[headerIdx] ?? []).map((h) => String(h ?? '').replace(/^☑\s*/, '').trim());
    let roleIdx = -1;
    for (let i = 0; i < headers.length; i++) {
      if (headers[i] === '역할' || headers[i] === '역활') { roleIdx = i; break; }
    }
    if (roleIdx < 0) return empty;

    let leaders = 0, followers = 0, helperLeaders = 0, helperFollowers = 0, helperAny = 0;
    for (let i = headerIdx + 1; i < values.length; i++) {
      const cat = classifyParticipantRoleCell(cell(values[i], roleIdx));
      if (cat === 'leader') leaders++;
      else if (cat === 'follower') followers++;
      else if (cat === 'helperLeader') helperLeaders++;
      else if (cat === 'helperFollower') helperFollowers++;
      else if (cat === 'helperAny') helperAny++;
    }
    // sub-역할 명시 없는 "헬퍼"만 있는 행이 있으면 — 어느 쪽인지 모르므로 양쪽에 합산.
    // (운영팀이 보통 "헬퍼(리더)"/"헬퍼(팔로워)"로 명시하므로 helperAny는 거의 0)
    if (helperAny > 0) {
      helperLeaders += helperAny;
      helperFollowers += helperAny;
    }
    return { leaders, followers, helperLeaders, helperFollowers };
  } catch {
    return empty;
  }
}

/**
 * 4.예선통과 시트의 실제 역할별 통과자 수.
 * 본선 라운드에서 "참가자 수" = 예선 통과자 수로 사용. 시트 조회 실패 시 0 폴백.
 */
async function getPrelimQualifierCounts(
  spreadsheetId: string
): Promise<{ semiLeaders: number; semiFollowers: number }> {
  try {
    const range = locatorToRange(SHEET_LOCATORS.prelimResult);
    const raw = await getQualifiers(spreadsheetId, range);
    return { semiLeaders: raw.leaders.length, semiFollowers: raw.followers.length };
  } catch {
    return { semiLeaders: 0, semiFollowers: 0 };
  }
}

/**
 * 5.본선통과 시트의 실제 역할별 통과자 수.
 * 결승 라운드에서 "참가자 수" = 본선 통과자 수로 사용. 시트 조회 실패 시 0 폴백.
 */
async function getSemiQualifierCounts(
  spreadsheetId: string
): Promise<{ finalLeaders: number; finalFollowers: number }> {
  try {
    const range = locatorToRange(SHEET_LOCATORS.semiResult);
    const raw = await getQualifiers(spreadsheetId, range);
    return { finalLeaders: raw.leaders.length, finalFollowers: raw.followers.length };
  } catch {
    return { finalLeaders: 0, finalFollowers: 0 };
  }
}

/** 결승 패널에 표출할 최대 순위 (동점자 포함이라 실제 표시 행 수는 더 많을 수 있음). */
const FINAL_PODIUM_MAX_RANK = 7;

/**
 * 6.결승 시트에서 rank ≤ 7인 모든 리더/팔로워를 추출. 동점자도 모두 포함.
 * 반환값은 rank 오름차순, 같은 rank 내에서는 시트 등장 순서 유지.
 */
async function getFinalPodium(
  spreadsheetId: string
): Promise<{ finalLeaderPodium: FinalPodiumEntry[]; finalFollowerPodium: FinalPodiumEntry[] }> {
  try {
    const range = locatorToRange(SHEET_LOCATORS.finalResult);
    const { values } = await getSheetRange(spreadsheetId, range);
    const cols = DEFAULT_FINAL_RESULT_COLUMNS;
    const rows = FINAL_RESULT_HAS_HEADER ? values.slice(1) : values;
    const leaderRe = /리더\s*(\d+)/;
    const followerRe = /팔로워\s*(\d+)/;

    const leaders: FinalPodiumEntry[] = [];
    const followers: FinalPodiumEntry[] = [];

    for (const row of rows) {
      const name = cell(row, cols.teamName);
      const finalRank = cell(row, cols.finalRank);
      const score = cell(row, cols.totalScore);
      if (!finalRank || !name) continue;
      const lm = finalRank.match(leaderRe);
      const fm = finalRank.match(followerRe);
      if (lm) {
        const rank = Number.parseInt(lm[1], 10);
        if (rank >= 1 && rank <= FINAL_PODIUM_MAX_RANK) {
          leaders.push({ rank, name, score });
        }
      } else if (fm) {
        const rank = Number.parseInt(fm[1], 10);
        if (rank >= 1 && rank <= FINAL_PODIUM_MAX_RANK) {
          followers.push({ rank, name, score });
        }
      }
    }
    leaders.sort((a, b) => a.rank - b.rank);
    followers.sort((a, b) => a.rank - b.rank);
    return { finalLeaderPodium: leaders, finalFollowerPodium: followers };
  } catch {
    return { finalLeaderPodium: [], finalFollowerPodium: [] };
  }
}

/**
 * 3.참가자 시트의 라운드별 심사위원 투표수(O 개수)를 참가번호 → votes 맵으로 추출.
 * 컬럼 위치:
 *   - "예선 등수"(prelim) 또는 "본선 등수"(semi) 헤더 셀의 바로 앞 15개 컬럼이 심사위원 투표 (O/X).
 *   - 헤더 위치는 운영팀이 안내 행/컬럼을 추가해도 동적 탐지.
 * 시트/헤더 매칭 실패 시 빈 Map 반환 (overflow에 votes=0으로 표시).
 */
async function getRoundVoteCounts(
  spreadsheetId: string,
  round: Exclude<RoundKey, 'final'>
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  try {
    const range = locatorToRange(SHEET_LOCATORS.participants);
    const { values } = await getSheetRange(spreadsheetId, range);
    if (!values || values.length === 0) return result;

    let headerIdx = -1;
    for (let i = 0; i < Math.min(values.length, 10); i++) {
      if (cell(values[i], 0).indexOf('참가번호') >= 0) { headerIdx = i; break; }
    }
    if (headerIdx < 0) headerIdx = 0;

    const headers = (values[headerIdx] ?? []).map((h) => String(h ?? '').trim());
    const rankHeader = round === 'prelim' ? '예선 등수' : '본선 등수';
    let rankCol = -1;
    for (let i = 0; i < headers.length; i++) {
      if (headers[i] === rankHeader) { rankCol = i; break; }
    }
    if (rankCol < 15) return result; // 등수 컬럼 못 찾거나 앞에 15개 심사위원 컬럼이 부족

    const voteStart = rankCol - 15;
    for (let i = headerIdx + 1; i < values.length; i++) {
      const num = cell(values[i], 0);
      if (!num || !/^\d+$/.test(num)) continue;
      let votes = 0;
      for (let c = voteStart; c < rankCol; c++) {
        if (cell(values[i], c).toUpperCase() === 'O') votes++;
      }
      result.set(num, votes);
    }
    return result;
  } catch {
    return result;
  }
}

async function getParticipantStats(spreadsheetId: string): Promise<ParticipantStats> {
  const [counts, semiCounts, finalCounts, prelimPassCouples, semiPassCouples, podium] =
    await Promise.all([
      getParticipantRoleCounts(spreadsheetId),
      getPrelimQualifierCounts(spreadsheetId),
      getSemiQualifierCounts(spreadsheetId),
      getQualifiedCount(spreadsheetId, 'prelim'),
      getQualifiedCount(spreadsheetId, 'semi'),
      getFinalPodium(spreadsheetId),
    ]);
  return {
    ...counts,
    ...semiCounts,
    ...finalCounts,
    prelimPassCouples,
    semiPassCouples,
    ...podium,
  };
}

// ─── Contest meta ───────────────────────────────────────────────────────────

export async function getContestMeta(contestId: string): Promise<ContestMeta | null> {
  const summary = await getContestSummary(contestId);
  if (!summary) return null;

  // 대회별 contestInfo 시트에서 festival_header / tagline 조회 (best-effort)
  // 운영팀 시트 구조 미확인 → 일단 기본값으로만 진행. 추후 정확한 위치 확인 시 보정.
  const festivalHeader = summary.name;
  const tagline = '';

  // 참가자 통계는 시트 읽기 실패 시 0으로 폴백 (대시보드 진입 자체는 막지 않음).
  const participantStats = await getParticipantStats(summary.spreadsheetId);

  return {
    contestId: summary.contestId,
    name: summary.name,
    designTemplateNumber: summary.designTemplateNumber,
    festivalHeader,
    tagline,
    participantStats,
    rounds: {
      prelim: { label: '예선', steps: STEPS_BY_ROUND.prelim },
      semi: { label: '본선', steps: STEPS_BY_ROUND.semi },
      final: { label: '결승', steps: STEPS_BY_ROUND.final },
    },
  };
}

// ─── Pairing ────────────────────────────────────────────────────────────────

// 한쪽 인원이 비어 있을 때 채울 헬퍼 표기.
// (운영 측에서 리더/팔로워 수가 불일치할 때 자동으로 빈 자리를 채워 화면 깨짐 방지)
const HELPER_NAME = '헬퍼유저';
const HELPER_NUM = '—';

async function getPairs(
  spreadsheetId: string,
  range: string,
  options?: { skipCache?: boolean }
): Promise<Pair[]> {
  const { values } = await getSheetRange(spreadsheetId, range, options);
  const rows = PAIRING_HAS_HEADER ? values.slice(1) : values;
  const pairs: Pair[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const idx = safeInt(cell(row, DEFAULT_PAIRING_COLUMNS.pairIdx), i + 1);
    const leader = cell(row, DEFAULT_PAIRING_COLUMNS.leaderName);
    const follower = cell(row, DEFAULT_PAIRING_COLUMNS.followerName);
    if (!leader && !follower) continue;
    const leaderNum = cell(row, DEFAULT_PAIRING_COLUMNS.leaderNum);
    const followerNum = cell(row, DEFAULT_PAIRING_COLUMNS.followerNum);
    pairs.push({
      idx,
      leader: leader || HELPER_NAME,
      leaderNum: leader ? leaderNum : HELPER_NUM,
      follower: follower || HELPER_NAME,
      followerNum: follower ? followerNum : HELPER_NUM,
    });
  }
  return pairs;
}

// ─── Result ─────────────────────────────────────────────────────────────────

/**
 * 예선/본선 통과자 시트 → leader/follower 명단 분리.
 * 한 행 = 한 사람. role 컬럼으로 분류.
 *
 * 시트 자체가 이미 "통과자 자동 집계" 결과 (3.참가자.AH=TRUE 행만 모임).
 * J열 ☑ 통과는 *다음* 라운드 진출 마킹용이므로 표출 시 필터링 X.
 */
async function getQualifiers(
  spreadsheetId: string,
  range: string
): Promise<{ leaders: ResultEntry[]; followers: ResultEntry[] }> {
  const cols = DEFAULT_QUALIFIER_COLUMNS;
  // 통과자 시트 + 참가자 사진 맵 병렬 조회 (결승과 동일한 폴백 전략)
  const [{ values }, photoMap] = await Promise.all([
    getSheetRange(spreadsheetId, range),
    getParticipantPhotoMap(spreadsheetId),
  ]);
  const rows = QUALIFIER_HAS_HEADER ? values.slice(1) : values;

  const leaders: ResultEntry[] = [];
  const followers: ResultEntry[] = [];
  for (const row of rows) {
    const num = cell(row, cols.num);
    const name = cell(row, cols.teamName);
    const role = cell(row, cols.role);
    if (!num || !name || !role) continue;

    // 1순위: 통과 시트 B열 사진 → 2순위: 3.참가자 시트 사진 → 3순위: 빈 문자열
    const photo =
      normalizePhotoUrl(cell(row, cols.photo)) || photoMap.get(num) || '';

    if (role === QUALIFIER_ROLE_LEADER) {
      leaders.push({ idx: leaders.length + 1, name, num, photo });
    } else if (role === QUALIFIER_ROLE_FOLLOWER) {
      followers.push({ idx: followers.length + 1, name, num, photo });
    }
  }
  return { leaders, followers };
}

/**
 * 3.참가자 시트에서 참가번호 → 사진 URL 맵을 빌드.
 * 시트 사진 컬럼이 비어있거나 셀 안에 박힌 이미지(gviz로 못 읽음)이면 빈 문자열로 폴백.
 * 시트 조회 실패 시 빈 맵 반환 (사진 없이 결과는 정상 표출되도록).
 */
async function getParticipantPhotoMap(spreadsheetId: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const range = locatorToRange(SHEET_LOCATORS.participants);
    const { values } = await getSheetRange(spreadsheetId, range);
    const cols = DEFAULT_PARTICIPANT_COLUMNS;
    const rows = PARTICIPANT_HAS_HEADER ? values.slice(1) : values;
    for (const row of rows) {
      const num = cell(row, cols.num);
      const photo = normalizePhotoUrl(cell(row, cols.photo));
      if (!num) continue;
      // 헤더 행이 데이터 영역에 또 있을 수도 있어, 숫자 형식이 아니면 스킵
      if (!/^\d+$/.test(num)) continue;
      if (photo) map.set(num, photo);
    }
  } catch {
    // 참가자 시트 없거나 권한 문제 — 사진 없이 진행
  }
  return map;
}

/**
 * 결승 시트 → 리더/팔로워 1~3등 추출
 * K열(finalRank) 값 예: "리더 1", "리더 2", "팔로워 1"
 * 사진 URL은 6.결승 B열에 직접 들어있으면 그것을 쓰고, 비어있으면 3.참가자 시트의 같은 참가번호 사진으로 폴백.
 */
async function getFinalResults(
  spreadsheetId: string,
  range: string
): Promise<{ leaders: ResultEntry[]; followers: ResultEntry[] }> {
  const cols = DEFAULT_FINAL_RESULT_COLUMNS;
  // 결승 시트 + 참가자 사진 맵 병렬 조회
  const [{ values }, photoMap] = await Promise.all([
    getSheetRange(spreadsheetId, range),
    getParticipantPhotoMap(spreadsheetId),
  ]);
  const rows = FINAL_RESULT_HAS_HEADER ? values.slice(1) : values;

  const leaders: ResultEntry[] = [];
  const followers: ResultEntry[] = [];
  const leaderRe = /리더\s*(\d+)/;
  const followerRe = /팔로워\s*(\d+)/;

  for (const row of rows) {
    const num = cell(row, cols.num);
    const name = cell(row, cols.teamName);
    // 1순위: 6.결승 B열의 사진 URL → 2순위: 3.참가자 시트의 사진 URL → 3순위: 빈 문자열
    const photo =
      normalizePhotoUrl(cell(row, cols.photo)) || photoMap.get(num) || '';
    const finalRank = cell(row, cols.finalRank);
    if (!finalRank || !num || !name) continue;

    const lm = finalRank.match(leaderRe);
    const fm = finalRank.match(followerRe);
    if (lm) {
      const rank = Number.parseInt(lm[1], 10);
      if (rank >= 1 && rank <= 3 && !leaders.find((x) => x.idx === rank)) {
        leaders.push({ idx: rank, name, num, photo });
      }
    } else if (fm) {
      const rank = Number.parseInt(fm[1], 10);
      if (rank >= 1 && rank <= 3 && !followers.find((x) => x.idx === rank)) {
        followers.push({ idx: rank, name, num, photo });
      }
    }
  }
  leaders.sort((a, b) => a.idx - b.idx);
  followers.sort((a, b) => a.idx - b.idx);
  return { leaders, followers };
}

// ─── Static (non-data) steps ───────────────────────────────────────────────

function staticPrep(roundLabel: string, _totalCount: number, festivalHeader: string, tagline: string): StepDataPayload {
  return {
    kind: 'prep',
    data: {
      festival_header: festivalHeader,
      stage_label: `${roundLabel.toUpperCase()} ROUND`,
      round_title: 'PREPARING',
      round_subtitle: 'Get ready · take your places',
      // 참가자 수 표기 비표시 (디자인 요구)
      participants: '',
      tagline,
    },
  };
}

function staticOpen(roundLabel: string, festivalHeader: string, tagline: string): StepDataPayload {
  return {
    kind: 'open',
    data: {
      festival_header: festivalHeader,
      round_title: `${roundLabel.toUpperCase()} ROUND`,
      open_quote: '"Let the rhythm guide you."',
      open_subline: 'LET THE DANCE BEGIN',
      tagline,
    },
  };
}

function staticLive(roundLabel: string, festivalHeader: string, tagline: string): StepDataPayload {
  return {
    kind: 'live',
    data: {
      festival_header: festivalHeader,
      stage_label: `${roundLabel.toUpperCase()} ROUND`,
      round_title: roundLabel.toUpperCase(),
      live_message: 'The stage belongs to the dancers',
      tagline,
    },
  };
}

function staticWrapup(roundLabel: string, festivalHeader: string, tagline: string): StepDataPayload {
  return {
    kind: 'wrapup',
    data: {
      festival_header: festivalHeader,
      stage_label: `${roundLabel.toUpperCase()} ROUND`,
      wrap_title: 'CALCULATING TOTAL',
      wrap_subtitle: 'IN PROGRESS',
      wrap_message: 'Please stand by — results coming up shortly',
      tagline,
    },
  };
}

function staticClose(roundLabel: string, festivalHeader: string, tagline: string): StepDataPayload {
  return {
    kind: 'close',
    data: {
      festival_header: festivalHeader,
      stage_label: `${roundLabel.toUpperCase()} ROUND`,
      close_title: 'ROUND COMPLETE',
      close_subtitle: `${roundLabel.toUpperCase()} · CLOSED`,
      close_message: 'Thank you to all dancers',
      tagline,
    },
  };
}

// ─── Main entry point ──────────────────────────────────────────────────────

export interface GetStepDataParams {
  contestId: string;
  round: RoundKey;
  step: StepKey;
  /** true면 페어링 스냅샷을 무시하고 시트에서 재로드 후 새 스냅샷 저장 */
  refresh?: boolean;
}

export class StepNotAvailableError extends Error {
  constructor(public round: RoundKey, public step: StepKey) {
    super(`Step "${step}" is not available for round "${round}"`);
    this.name = 'StepNotAvailableError';
  }
}

export class ContestNotFoundError extends Error {
  constructor(public contestId: string) {
    super(`Contest not found: ${contestId}`);
    this.name = 'ContestNotFoundError';
  }
}

const ROUND_LABELS: Record<RoundKey, string> = {
  prelim: 'Preliminary',
  semi: 'Semi-Final',
  final: 'Grand Final',
};

/**
 * 예선/본선 통과자 시트(4.예선통과 / 5.본선통과)와 1.대회정보의 정원을 비교해
 * 동점자 overflow 정보를 계산. RESULT/WRAPUP 단계에서 공통으로 사용.
 * 정원을 초과하지 않으면 undefined. 결승은 1·2·3등 고정이라 항상 undefined.
 *
 * 통과자가 정원을 초과한 경우 통과자 전원의 번호·이름·투표수(3.참가자 시트 심사위원 컬럼의 O 개수)를
 * 함께 채워 운영자가 boundary 동점자를 식별할 수 있도록 함.
 */
/**
 * 6.결승 시트의 1·2·3위 후보를 모두 추출해 같은 rank에 2명 이상이면 동점자 정보를 반환.
 * 운영자가 수동 확정해야 할 boundary를 식별할 수 있도록 번호·이름·순위·총점을 함께 제공.
 * 동점자가 없으면 undefined.
 */
async function computeFinalTieInfo(
  spreadsheetId: string
): Promise<FinalTieInfo | undefined> {
  try {
    const range = locatorToRange(SHEET_LOCATORS.finalResult);
    const { values } = await getSheetRange(spreadsheetId, range);
    const cols = DEFAULT_FINAL_RESULT_COLUMNS;
    const rows = FINAL_RESULT_HAS_HEADER ? values.slice(1) : values;
    const leaderRe = /리더\s*(\d+)/;
    const followerRe = /팔로워\s*(\d+)/;

    const leaderEntries: FinalTieEntry[] = [];
    const followerEntries: FinalTieEntry[] = [];

    for (const row of rows) {
      const num = cell(row, cols.num);
      const name = cell(row, cols.teamName);
      const score = cell(row, cols.totalScore);
      const finalRank = cell(row, cols.finalRank);
      if (!finalRank || !name || !num) continue;
      const lm = finalRank.match(leaderRe);
      const fm = finalRank.match(followerRe);
      if (lm) {
        const rank = Number.parseInt(lm[1], 10);
        if (rank >= 1 && rank <= 3) leaderEntries.push({ num, name, rank, score });
      } else if (fm) {
        const rank = Number.parseInt(fm[1], 10);
        if (rank >= 1 && rank <= 3) followerEntries.push({ num, name, rank, score });
      }
    }

    leaderEntries.sort((a, b) => a.rank - b.rank);
    followerEntries.sort((a, b) => a.rank - b.rank);

    // 같은 rank에 2명 이상 있으면 동점자.
    const leaderRankCounts = new Map<number, number>();
    for (const e of leaderEntries) leaderRankCounts.set(e.rank, (leaderRankCounts.get(e.rank) ?? 0) + 1);
    const followerRankCounts = new Map<number, number>();
    for (const e of followerEntries) followerRankCounts.set(e.rank, (followerRankCounts.get(e.rank) ?? 0) + 1);
    const hasTie =
      [...leaderRankCounts.values()].some((c) => c > 1) ||
      [...followerRankCounts.values()].some((c) => c > 1);

    if (!hasTie) return undefined;
    return { leaderEntries, followerEntries, hasTie };
  } catch {
    return undefined;
  }
}

async function computeOverflowInfo(
  spreadsheetId: string,
  round: RoundKey
): Promise<ResultData['overflow']> {
  if (round === 'final') return undefined;
  try {
    const locator = resultLocator(round);
    const range = locatorToRange(locator);
    const [raw, maxPerRole] = await Promise.all([
      getQualifiers(spreadsheetId, range),
      getQualifiedCount(spreadsheetId, round),
    ]);
    const leaderOverflow = Math.max(0, raw.leaders.length - maxPerRole);
    const followerOverflow = Math.max(0, raw.followers.length - maxPerRole);
    if (leaderOverflow === 0 && followerOverflow === 0) return undefined;

    const voteCounts = await getRoundVoteCounts(spreadsheetId, round);
    const toEntry = (e: ResultEntry): OverflowEntry => ({
      num: e.num,
      name: e.name,
      votes: voteCounts.get(e.num) ?? 0,
    });
    return {
      maxPerRole,
      leaderTotal: raw.leaders.length,
      followerTotal: raw.followers.length,
      leaderOverflow,
      followerOverflow,
      leaderEntries: raw.leaders.map(toEntry).sort((a, b) => b.votes - a.votes),
      followerEntries: raw.followers.map(toEntry).sort((a, b) => b.votes - a.votes),
    };
  } catch {
    return undefined;
  }
}

export async function getStepData(params: GetStepDataParams): Promise<StepDataPayload> {
  const { contestId, round, step, refresh = false } = params;

  // Design §11.1 — 결승 Pairing 등 미존재 조합 차단
  const allowedSteps = STEPS_BY_ROUND[round];
  if (!allowedSteps.includes(step)) {
    throw new StepNotAvailableError(round, step);
  }

  const meta = await getContestMeta(contestId);
  if (!meta) throw new ContestNotFoundError(contestId);
  const summary = await getContestSummary(contestId);
  if (!summary) throw new ContestNotFoundError(contestId);

  const { spreadsheetId } = summary;
  const { festivalHeader, tagline } = meta;
  const roundLabel = ROUND_LABELS[round];

  if (step === 'pairing' || step === 'pairingB' || step === 'pairingC') {
    // 결승: 자동 매핑 없음 — 사람이 직접 매칭, 'PAIRING' 화면만 표출 (설명.txt §결승업무프로세스)
    if (round === 'final') {
      return {
        kind: 'pairing',
        data: {
          festival_header: festivalHeader,
          stage_label: 'GRAND FINAL',
          round_title: 'PAIRING',
          label_leader: 'LEADER',
          label_follower: 'FOLLOWER',
          pairs: [],
          // 페어링 화면은 태그라인 비표시
          tagline: '',
        },
      };
    }

    const locator = pairingLocator(round);
    if (!locator) throw new StepNotAvailableError(round, step);
    const range = locatorToRange(locator);

    // 시트의 RAND() 휘발성 함수가 fetch마다 새로 섞여 시트 화면과 대시보드가
    // 불일치하는 문제를 해결하기 위해 첫 fetch 결과를 스냅샷으로 락.
    // refresh=true면 스냅샷을 무시하고 시트에서 다시 읽어 새 스냅샷으로 갱신.
    // 시트의 RAND() 자동 재계산(매분/F5)으로 값이 계속 바뀌므로 스냅샷 락 사용.
    //   refresh=false (기본): 스냅샷이 있으면 그것을 사용, 없으면 시트에서 fetch 후 저장
    //   refresh=true: 스냅샷 폐기 → 시트에서 즉시 fetch → 새 스냅샷 저장 (사용자 명시 갱신)
    // A/B는 동일 시트·동일 스냅샷을 공유 — A=1~20, B=21~ 슬라이스만 다름.
    let pairs: Pair[];
    if (refresh) {
      await clearPairingSnapshot(contestId, round);
      pairs = await getPairs(spreadsheetId, range, { skipCache: true });
      if (pairs.length > 0) await savePairingSnapshot(contestId, round, pairs);
    } else {
      const snap = await getPairingSnapshot(contestId, round);
      if (snap && snap.pairs.length > 0) {
        pairs = snap.pairs;
      } else {
        pairs = await getPairs(spreadsheetId, range, { skipCache: true });
        if (pairs.length > 0) await savePairingSnapshot(contestId, round, pairs);
      }
    }

    // 페어 분할 — 라운드별 페이지 사이즈와 분할 수가 다름:
    //   예선: A/B/C 3분할, 각 페이지 최대 20페어, 총 60커플 지원
    //     A: idx 1~20, B: idx 21~40, C: idx 41~60
    //   본선: A/B 2분할, 전체 페어를 절반씩 (홀수면 A에 1개 더)
    //     A: idx 1~ceil(N/2), B: idx ceil(N/2)+1~N
    //   결승: 분할 없음 (위에서 처리)
    // 모든 페이지는 placeholder 매칭을 위해 idx를 1부터 재인덱싱.
    const pageLetter = step === 'pairingC' ? 'C' : step === 'pairingB' ? 'B' : 'A';
    const sortedPairs = [...pairs].sort((a, b) => a.idx - b.idx);
    let pagedPairs: Pair[];
    if (round === 'prelim') {
      const PAGE_SIZE = 20;
      const pageNumber = pageLetter === 'C' ? 3 : pageLetter === 'B' ? 2 : 1;
      const lo = (pageNumber - 1) * PAGE_SIZE + 1;
      const hi = pageNumber * PAGE_SIZE;
      pagedPairs = sortedPairs
        .filter((p) => p.idx >= lo && p.idx <= hi)
        .map((p, i) => ({ ...p, idx: i + 1 }));
    } else if (round === 'semi') {
      // 본선 2분할 — 절반 기준은 ceil(N/2). 페어 0개여도 안전.
      const half = Math.ceil(sortedPairs.length / 2);
      const slice = pageLetter === 'B' ? sortedPairs.slice(half) : sortedPairs.slice(0, half);
      pagedPairs = slice.map((p, i) => ({ ...p, idx: i + 1 }));
    } else {
      // final은 위에서 이미 빈 페어로 반환됨 — 도달 불가지만 안전망.
      pagedPairs = sortedPairs;
    }

    // 라벨 suffix — 분할이 있는 라운드만 ` · A` 또는 ` · B`/`· C` 표기.
    const pageSuffix = round === 'prelim' || round === 'semi' ? ` · ${pageLetter}` : '';
    const data: PairingData = {
      festival_header: festivalHeader,
      stage_label: `${roundLabel.toUpperCase()} ROUND${pageSuffix}`,
      round_title: 'RANDOM PAIRING',
      label_leader: 'LEADER',
      label_follower: 'FOLLOWER',
      pairs: pagedPairs,
      // 페어링 화면은 태그라인 비표시 (디자인 요구 — 가운데 PAIR 배지 제거와 함께 통일)
      tagline: '',
    };
    return { kind: 'pairing', data };
  }

  if (step === 'result') {
    const locator = resultLocator(round);
    const range = locatorToRange(locator);
    const raw =
      round === 'final'
        ? await getFinalResults(spreadsheetId, range)
        : await getQualifiers(spreadsheetId, range);

    // 디자인 템플릿이 처리할 수 있는 최대치로 캡.
    // 통과 인원은 1.대회정보 시트의 "예선/본선 통과 인원 (역할별)" 값 사용 (운영팀 입력).
    // 결승은 1·2·3등 고정.
    const maxPerRole: number =
      round === 'final' ? 3 : await getQualifiedCount(spreadsheetId, round);
    const leaders = raw.leaders.slice(0, maxPerRole);
    const followers = raw.followers.slice(0, maxPerRole);
    // 동점자/순위권 overflow 정보는 공용 헬퍼에서 계산 (wrapup 단계와 동일 결과).
    const overflow = await computeOverflowInfo(spreadsheetId, round);
    // 결승은 1·2·3위 안에 동점자(같은 rank에 2명 이상)가 있을 때만 채워짐.
    const finalTie = round === 'final' ? await computeFinalTieInfo(spreadsheetId) : undefined;
    // 디자인 의도 (이미지 2번):
    //   final = CHAMPIONS / JEJU YYYY · GRAND FINAL / Bachata Jack & Jill ... 태그라인
    //   prelim = QUALIFIED / ADVANCING TO SEMI-FINAL
    //   semi = FINALISTS / ADVANCING TO GRAND FINAL
    const yearMatch = (summary.startDate ?? summary.name).match(/\b(\d{4})\b/);
    const year = yearMatch ? yearMatch[1] : new Date().getFullYear().toString();

    let resultTitle: string;
    let resultSubtitle: string;
    let resultTagline: string;
    if (round === 'final') {
      resultTitle = 'CHAMPIONS';
      resultSubtitle = `JEJU ${year} · GRAND FINAL`;
      // 결승 Result 태그라인 비표시 (디자인 요구)
      resultTagline = '';
    } else if (round === 'prelim') {
      resultTitle = 'QUALIFIED';
      resultSubtitle = 'ADVANCING TO SEMI-FINAL';
      // 예선 Result 태그라인 비표시 (디자인 요구)
      resultTagline = '';
    } else {
      resultTitle = 'FINALISTS';
      resultSubtitle = 'ADVANCING TO GRAND FINAL';
      // 본선 Result 태그라인 비표시 (디자인 요구)
      resultTagline = '';
    }

    const data: ResultData = {
      festival_header: festivalHeader,
      result_title: resultTitle,
      result_subtitle: resultSubtitle,
      label_leader: 'LEADER',
      label_follower: 'FOLLOWER',
      leaders,
      followers,
      tagline: tagline || resultTagline,
      overflow,
      finalTie,
    };
    return { kind: 'result', data };
  }

  // Ceremony — 결승 시상식 화면. Result와 같은 데이터(1·2·3등) 사용하되 다른 SVG로 렌더.
  if (step === 'ceremony') {
    if (round !== 'final') throw new StepNotAvailableError(round, step);
    const locator = resultLocator(round);
    const range = locatorToRange(locator);
    const raw = await getFinalResults(spreadsheetId, range);
    const leaders = raw.leaders.slice(0, 3);
    const followers = raw.followers.slice(0, 3);
    const data: CeremonyData = {
      festival_header: festivalHeader,
      ceremony_title: 'CHAMPIONS',
      // 부제목 비표시 (디자인 요구)
      ceremony_subtitle: '',
      label_leader: 'LEADER',
      label_follower: 'FOLLOWER',
      leaders,
      followers,
      tagline: '',
    };
    return { kind: 'ceremony', data };
  }

  // Static steps — 시트 데이터 없이 라벨만 사용 (wrapup은 overflow 정보만 추가로 부착)
  const totalCount = round === 'prelim' ? 60 : round === 'semi' ? 10 : 3;
  switch (step) {
    case 'prep':
      return staticPrep(roundLabel, totalCount, festivalHeader, tagline);
    case 'open':
      return staticOpen(roundLabel, festivalHeader, tagline);
    case 'live':
      return staticLive(roundLabel, festivalHeader, tagline);
    case 'wrapup': {
      const base = staticWrapup(roundLabel, festivalHeader, tagline);
      if (base.kind === 'wrapup') {
        if (round === 'final') {
          // 결승은 1·2·3위 동점자 검토 정보 (overflow는 무의미).
          base.data.finalTie = await computeFinalTieInfo(spreadsheetId);
        } else {
          // 예선/본선은 RESULT와 동일한 정원 초과 동점자 정보.
          base.data.overflow = await computeOverflowInfo(spreadsheetId, round);
        }
      }
      return base;
    }
    case 'close':
      return staticClose(roundLabel, festivalHeader, tagline);
  }
}
