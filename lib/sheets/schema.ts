// Design Ref: §3.1 — 시트 탭별 스키마 정의 (단일 진실 원천)
// 실제 운영팀 시트(gid=2102151233)에서 확인한 컬럼 매핑 적용.
//
// 컬럼 인덱스는 0-based. Google Sheets 응답이 2D 배열이므로 row[colIndex]로 접근.

import type { RoundKey } from './types';

// 대회목록시트 (실제 시트 컬럼 구조)
// A 대회일정 고유번호 | B 대회명 | C 대회 일시(start-end 합쳐있음)
// D 주최 | E 담당자 이름 | F 담당자 연락처 | G 담당자 이메일
// H 파일명(JNJ-001 형식) | I 마스터 파일 URL | J 템플릿명
export interface ContestListColumns {
  contestSeq: number;       // A: 일정 고유번호 ("1", "2", ...)
  contestName: number;      // B: 대회명
  contestPeriod: number;    // C: 대회 일시 ("20260601-20260630")
  hostOrg: number;          // D: 주최
  fileNameSlug: number;     // H: 파일명 (JNJ-001) — contestId로 사용
  masterFileUrl: number;    // I: 마스터 파일 URL — spreadsheetId 추출
  templateLabel: number;    // J: 템플릿명 (참고용)
}

export const CONTEST_LIST_COLUMNS: ContestListColumns = {
  contestSeq: 0,
  contestName: 1,
  contestPeriod: 2,
  hostOrg: 3,
  fileNameSlug: 7,
  masterFileUrl: 8,
  templateLabel: 9,
};

// 헤더가 있다고 가정. 첫 행은 스킵.
export const CONTEST_LIST_HAS_HEADER = true;

/** "20260601-20260630" → ["2026-06-01", "2026-06-30"] */
export function parseContestPeriod(s: string): { start?: string; end?: string } {
  if (!s) return {};
  const parts = s.split('-').map((p) => p.trim());
  if (parts.length !== 2) return {};
  const [a, b] = parts;
  const fmt = (raw: string): string | undefined => {
    if (!/^\d{8}$/.test(raw)) return undefined;
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  };
  return { start: fmt(a), end: fmt(b) };
}

/** 마스터 파일 URL에서 spreadsheetId 추출. 추출 실패 시 null. */
export function extractSpreadsheetId(url: string): string | null {
  if (!url) return null;
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]{20,})/);
  return m ? m[1] : null;
}

// 대회별 원본시트 탭의 위치자 (gid 우선, 폴백으로 tabName).
// gid는 운영팀이 마스터 템플릿을 복사할 때 보존되는 시트 고유번호.
// 한글 탭 이름은 gviz가 정확히 매칭 못할 때가 있으니 gid가 더 안전.
export interface SheetLocator {
  /** Google Sheets URL의 #gid=... 부분 */
  gid?: string;
  /** gid 매핑이 없을 때 폴백으로 사용할 탭 이름 */
  tabName?: string;
}

/** gid 우선 → 'gid:N' 식 식별자, 없으면 tabName */
export function locatorToRange(loc: SheetLocator): string {
  if (loc.gid) return `gid:${loc.gid}`;
  if (loc.tabName) return loc.tabName;
  throw new Error('SheetLocator에는 gid 또는 tabName 중 하나가 필요');
}

/**
 * (round, step) → SheetLocator. 운영팀 명명 규칙:
 *   3-1.예선랜덤시트, 4.예선통과시트, 4-1.본선랜덤시트, 5.본선통과시트, 6.결승시트
 * gid는 사용자가 확인해 채워줘야 함. 모르면 tabName 폴백 사용.
 *
 * NOTE: 같은 마스터 템플릿에서 복사된 대회들은 동일한 gid를 가질 수 있음.
 *       다르다면 추후 contest별 매핑 추가.
 */
export const SHEET_LOCATORS = {
  prelimPairing: { gid: '1758057990', tabName: '3-1.예선랜덤' },
  prelimResult: { tabName: '4.예선통과' },
  semiPairing: { tabName: '4-1.본선랜덤' },
  semiResult: { tabName: '5.본선통과' },
  finalResult: { tabName: '6.결승' },
  contestInfo: { gid: '1162828405', tabName: '1.대회정보' },
  /** 참가자 명단(3.참가자) — 사진 URL의 단일 출처. 참가번호로 조회. */
  participants: { tabName: '3.참가자' },
} as const satisfies Record<string, SheetLocator>;

// 참가자 명단 시트 (3.참가자)
// A 참가번호 | C 팀명/참가자명 | D 대표자 | E 인원수 | ... | O 사진(텍스트 URL)
// 사진 컬럼은 운영팀 시트 개편으로 B → O 이동(2026-05).
export interface ParticipantSheetColumns {
  num: number;    // A
  photo: number;  // O
}

export const DEFAULT_PARTICIPANT_COLUMNS: ParticipantSheetColumns = {
  num: 0,
  photo: 14,
};

export const PARTICIPANT_HAS_HEADER = true;

// Pairing 시트 컬럼 (실제 시트 구조에 맞춤)
// A: 페어 번호 | B: 리더 참가번호 | C: 리더 팀명 | D: 리더 대표자
// E: 팔로워 참가번호 | F: 팔로워 팀명 | G: 팔로워 대표자 | H: 비고
export interface PairingSheetColumns {
  pairIdx: number;
  leaderNum: number;
  leaderName: number;        // 디자인 템플릿의 큰 글씨 자리 → "팀명"
  leaderRepresentative: number; // (선택) 대표자명 — 현재 미사용
  followerNum: number;
  followerName: number;      // 디자인 템플릿의 큰 글씨 자리 → "팀명"
  followerRepresentative: number;
}

export const DEFAULT_PAIRING_COLUMNS: PairingSheetColumns = {
  pairIdx: 0,
  leaderNum: 1,
  leaderName: 2,
  leaderRepresentative: 3,
  followerNum: 4,
  followerName: 5,
  followerRepresentative: 6,
};

export const PAIRING_HAS_HEADER = true;

// 통과자 명단 시트 (4.예선통과, 5.본선통과)
// 한 행 = 한 사람. 역할 컬럼으로 리더/팔로워 분류, 통과 컬럼(TRUE)만 포함.
// A 참가# | B 사진 | C 팀명/참가자명 | D 대표자명 | E 장르 | F 부문 | G 연령대 | H 소속 | I 역할 | J ☑통과
export interface QualifierSheetColumns {
  num: number;          // A: 참가번호
  photo: number;        // B: 사진 URL (비어있으면 3.참가자 시트로 폴백)
  teamName: number;     // C: 팀명/참가자명
  representative: number; // D: 대표자
  role: number;         // I: "리더" / "팔로워"
  passed: number;       // J: TRUE/FALSE
}

export const DEFAULT_QUALIFIER_COLUMNS: QualifierSheetColumns = {
  num: 0,
  photo: 1,
  teamName: 2,
  representative: 3,
  role: 8,
  passed: 9,
};

export const QUALIFIER_HAS_HEADER = true;
export const QUALIFIER_PASSED_TRUE = 'TRUE';
export const QUALIFIER_ROLE_LEADER = '리더';
export const QUALIFIER_ROLE_FOLLOWER = '팔로워';

// 결승 시트 (6.결승) — 같은 시트에 리더/팔로워 섞여있음
// A 참가# | B 사진 | C 팀명 | D 장르 | E 부문 | F~H 점수 합계(기본기/연결성/음악성) | I 총점 | J 평균 | K 최종순위
// K열 값 예: "리더 1", "리더 2", "팔로워 1" — 정규식으로 분류 + 순위 추출
export interface FinalResultSheetColumns {
  num: number;        // A
  photo: number;      // B
  teamName: number;   // C
  totalScore: number; // I: 총점
  average: number;    // J: 평균
  finalRank: number;  // K
}

export const DEFAULT_FINAL_RESULT_COLUMNS: FinalResultSheetColumns = {
  num: 0,
  photo: 1,
  teamName: 2,
  totalScore: 8,
  average: 9,
  finalRank: 10,
};

export const FINAL_RESULT_HAS_HEADER = true;

/** 라운드 → 페어링 시트 locator (결승은 페어링 시트 없음) */
export function pairingLocator(round: RoundKey): SheetLocator | null {
  if (round === 'prelim') return SHEET_LOCATORS.prelimPairing;
  if (round === 'semi') return SHEET_LOCATORS.semiPairing;
  return null;
}

/** 라운드 → 결과 시트 locator */
export function resultLocator(round: RoundKey): SheetLocator {
  if (round === 'prelim') return SHEET_LOCATORS.prelimResult;
  if (round === 'semi') return SHEET_LOCATORS.semiResult;
  return SHEET_LOCATORS.finalResult;
}
