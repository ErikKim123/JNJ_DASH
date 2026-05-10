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
  Pair,
  PairingData,
  ResultData,
  ResultEntry,
  RoundKey,
  StepKey,
  StepDataPayload,
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

// ─── Contest meta ───────────────────────────────────────────────────────────

export async function getContestMeta(contestId: string): Promise<ContestMeta | null> {
  const summary = await getContestSummary(contestId);
  if (!summary) return null;

  // 대회별 contestInfo 시트에서 festival_header / tagline 조회 (best-effort)
  // 운영팀 시트 구조 미확인 → 일단 기본값으로만 진행. 추후 정확한 위치 확인 시 보정.
  const festivalHeader = summary.name;
  const tagline = '';

  return {
    contestId: summary.contestId,
    name: summary.name,
    designTemplateNumber: summary.designTemplateNumber,
    festivalHeader,
    tagline,
    rounds: {
      prelim: { label: '예선', steps: STEPS_BY_ROUND.prelim },
      semi: { label: '본선', steps: STEPS_BY_ROUND.semi },
      final: { label: '결승', steps: STEPS_BY_ROUND.final },
    },
  };
}

// ─── Pairing ────────────────────────────────────────────────────────────────

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
    pairs.push({
      idx,
      leader,
      leaderNum: cell(row, DEFAULT_PAIRING_COLUMNS.leaderNum),
      follower,
      followerNum: cell(row, DEFAULT_PAIRING_COLUMNS.followerNum),
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
  const { values } = await getSheetRange(spreadsheetId, range);
  const rows = QUALIFIER_HAS_HEADER ? values.slice(1) : values;

  const leaders: ResultEntry[] = [];
  const followers: ResultEntry[] = [];
  for (const row of rows) {
    const num = cell(row, cols.num);
    const name = cell(row, cols.teamName);
    const role = cell(row, cols.role);
    if (!num || !name || !role) continue;

    if (role === QUALIFIER_ROLE_LEADER) {
      leaders.push({ idx: leaders.length + 1, name, num });
    } else if (role === QUALIFIER_ROLE_FOLLOWER) {
      followers.push({ idx: followers.length + 1, name, num });
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

function staticPrep(roundLabel: string, totalCount: number, festivalHeader: string, tagline: string): StepDataPayload {
  return {
    kind: 'prep',
    data: {
      festival_header: festivalHeader,
      stage_label: `${roundLabel.toUpperCase()} ROUND`,
      round_title: 'PREPARING',
      round_subtitle: 'Get ready · take your places',
      participants: `${totalCount} LEADERS  ·  ${totalCount} FOLLOWERS`,
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

  if (step === 'pairing') {
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
          tagline: tagline || '✦ Manual Matching · Grand Final ✦',
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

    const data: PairingData = {
      festival_header: festivalHeader,
      stage_label: `${roundLabel.toUpperCase()} ROUND`,
      round_title: 'RANDOM PAIRING',
      label_leader: 'LEADER',
      label_follower: 'FOLLOWER',
      pairs,
      tagline: tagline || `✦ Random Draw · ${roundLabel} Pairing ✦`,
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
    // 예선: 10/10 (총 20명) · 본선: 5/5 (총 10명) · 결승: 3/3 (총 6명)
    const maxPerRole: number = round === 'prelim' ? 10 : round === 'semi' ? 5 : 3;
    const leaders = raw.leaders.slice(0, maxPerRole);
    const followers = raw.followers.slice(0, maxPerRole);
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
      resultTagline = `✦ Bachata Jack & Jill · Pro Division · Champions of Jeju ${year} ✦`;
    } else if (round === 'prelim') {
      resultTitle = 'QUALIFIED';
      resultSubtitle = 'ADVANCING TO SEMI-FINAL';
      resultTagline = '✦ See you at the Semi-Final ✦';
    } else {
      resultTitle = 'FINALISTS';
      resultSubtitle = 'ADVANCING TO GRAND FINAL';
      resultTagline = '✦ See you at the Grand Final ✦';
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
    };
    return { kind: 'result', data };
  }

  // Static steps — 시트 데이터 없이 라벨만 사용
  const totalCount = round === 'prelim' ? 20 : round === 'semi' ? 10 : 3;
  switch (step) {
    case 'prep':
      return staticPrep(roundLabel, totalCount, festivalHeader, tagline);
    case 'open':
      return staticOpen(roundLabel, festivalHeader, tagline);
    case 'live':
      return staticLive(roundLabel, festivalHeader, tagline);
    case 'wrapup':
      return staticWrapup(roundLabel, festivalHeader, tagline);
    case 'close':
      return staticClose(roundLabel, festivalHeader, tagline);
  }
}
