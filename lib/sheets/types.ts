// Design Ref: §3.2 — 스텝별 데이터 인터페이스. 모든 placeholder는 이 타입에서 평탄화되어
// SVG 문자열의 {{key}}와 매칭됨. 변경 시 SVG 함수의 placeholder 키도 동기화 필요.

export type RoundKey = 'prelim' | 'semi' | 'final';
export type StepKey =
  | 'prep'
  | 'pairing'
  | 'pairingB'
  | 'pairingC'
  | 'open'
  | 'live'
  | 'wrapup'
  | 'close'
  | 'result'
  | 'ceremony';

export const ROUND_KEYS = ['prelim', 'semi', 'final'] as const;
export const STEP_KEYS = [
  'prep',
  'pairing',
  'pairingB',
  'pairingC',
  'open',
  'live',
  'wrapup',
  'close',
  'result',
  'ceremony',
] as const;

// 라운드별 프로세스:
//   prelim: Prep → Pairing A → Pairing B → Pairing C → Open → Live → Calculate Total → Close → Result
//     (예선은 최대 60페어까지 A/B/C 각 20씩 분할 표출)
//   semi: Prep → Pairing A → Pairing B → Open → Live → Calculate Total → Close → Result
//     (본선은 페어 전체를 절반씩 A/B로 분할 표출)
//   final: Prep → Pairing → Open → Live → Calculate Total → Close → Result → Ceremony
// 결승 Pairing은 자동 매핑 없음 — 사람이 직접 매칭하고 'PAIRING' 화면만 표출.
export const STEPS_BY_ROUND: Record<RoundKey, ReadonlyArray<StepKey>> = {
  prelim: [
    'prep',
    'pairing',
    'pairingB',
    'pairingC',
    'open',
    'live',
    'wrapup',
    'close',
    'result',
  ],
  semi: ['prep', 'pairing', 'pairingB', 'open', 'live', 'wrapup', 'close', 'result'],
  final: ['prep', 'pairing', 'open', 'live', 'wrapup', 'close', 'result', 'ceremony'],
};

export interface ContestSummary {
  contestId: string;
  name: string;
  spreadsheetId: string;
  designTemplateNumber: number;
  startDate?: string;
  endDate?: string;
  status?: 'ready' | 'live' | 'done' | string;
}

// Design §3.2 — 스텝 데이터 인터페이스
export interface PrepData {
  festival_header: string;
  stage_label: string;
  round_title: string;
  round_subtitle: string;
  participants: string;
  tagline: string;
  /** 하단 광고/스폰서 로고 public URL 배열 (최대 6개). */
  sponsor_logos?: string[];
  /** 슬롯별 투명도 (0-100). 미설정 슬롯은 100 으로 간주. */
  sponsor_logo_opacities?: number[];
}

export interface Pair {
  idx: number;
  leader: string;
  leaderNum: string;
  follower: string;
  followerNum: string;
}

export interface PairingData {
  festival_header: string;
  round_title: string;
  stage_label: string;
  label_leader: string;
  label_follower: string;
  pairs: Pair[];
  tagline: string;
}

export interface OpenData {
  festival_header: string;
  round_title: string;
  open_quote: string;
  open_subline: string;
  tagline: string;
}

export interface LiveData {
  festival_header: string;
  stage_label: string;
  round_title: string;
  live_message: string;
  tagline: string;
}

export interface WrapupData {
  festival_header: string;
  stage_label: string;
  wrap_title: string;
  wrap_subtitle: string;
  wrap_message: string;
  tagline: string;
  /**
   * CALC TOTAL 단계에서도 RESULT와 동일한 동점자/순위권 정보를 운영자에게 노출.
   * 시트 자동 통과 인원이 정원을 초과한 경우에만 채워짐 (그 외엔 undefined).
   * 구조는 ResultData.overflow와 동일.
   */
  overflow?: ResultData['overflow'];
  /** 결승 라운드 한정 — 1·2·3위 안에 동점자가 있을 때 채워짐. */
  finalTie?: FinalTieInfo;
}

export interface CloseData {
  festival_header: string;
  stage_label: string;
  close_title: string;
  close_subtitle: string;
  close_message: string;
  tagline: string;
}

export interface ResultEntry {
  idx: number;
  name: string;
  num: string;
  /** 참가자 사진 URL — 시트 사진 컬럼에서 읽음. 비어있으면 빈 문자열. */
  photo?: string;
}

export interface ResultData {
  festival_header: string;
  result_title: string;
  result_subtitle: string;
  label_leader: string;
  label_follower: string;
  leaders: ResultEntry[];
  followers: ResultEntry[];
  tagline: string;
  /**
   * 운영자 알림용 — 시트의 자동 통과 인원이 설정한 인원(maxPerRole)을 초과한 경우.
   * 동점자 처리를 운영자가 수동으로 결정해야 함을 알림.
   *   maxPerRole: 1.대회정보 시트에 설정된 통과 정원
   *   leaderTotal/followerTotal: 시트에서 실제 TRUE인 총 인원수
   *   leaderOverflow/followerOverflow: 정원 초과분 (>0이면 동점자 검토 필요)
   *   leaderEntries/followerEntries: 통과자 전원의 번호·이름·투표수 (운영자 검토용, votes 내림차순)
   */
  overflow?: {
    maxPerRole: number;
    leaderTotal: number;
    followerTotal: number;
    leaderOverflow: number;
    followerOverflow: number;
    leaderEntries?: OverflowEntry[];
    followerEntries?: OverflowEntry[];
  };
  /** 결승 라운드 한정 — 1·2·3위 안에 동점자가 있을 때 채워짐. */
  finalTie?: FinalTieInfo;
}

/** OverflowAlert에 표출할 한 명의 정보 — 번호·이름·투표수. */
export interface OverflowEntry {
  num: string;
  name: string;
  votes: number;
}

/** 결승 1·2·3위 후보 — 번호·이름·순위·총점. 동점자가 있을 때 OverflowAlert 형태로 노출. */
export interface FinalTieEntry {
  num: string;
  name: string;
  rank: number;
  score: string;
}

/**
 * 결승 동점자 정보. 같은 rank에 2명 이상 들어와 운영자가 수동 확정해야 할 때 채워짐.
 *   leaderEntries/followerEntries: 1·2·3위 모든 후보 (동점자 포함, rank 오름차순)
 *   hasTie: 둘 중 어느 쪽이라도 동점자가 있을 때 true
 */
export interface FinalTieInfo {
  leaderEntries: FinalTieEntry[];
  followerEntries: FinalTieEntry[];
  hasTie: boolean;
}

// Ceremony: 결승 시상식 — Result와 같은 데이터(1·2·3등 리더/팔로워)지만
// 화면 디자인이 다름(중앙 1위 + 좌·우 2·3위, 색종이 효과).
export interface CeremonyData {
  festival_header: string;
  ceremony_title: string;
  ceremony_subtitle: string;
  label_leader: string;
  label_follower: string;
  leaders: ResultEntry[];
  followers: ResultEntry[];
  tagline: string;
}

export type StepDataPayload =
  | { kind: 'prep'; data: PrepData }
  | { kind: 'pairing'; data: PairingData }
  | { kind: 'open'; data: OpenData }
  | { kind: 'live'; data: LiveData }
  | { kind: 'wrapup'; data: WrapupData }
  | { kind: 'close'; data: CloseData }
  | { kind: 'result'; data: ResultData }
  | { kind: 'ceremony'; data: CeremonyData };

/**
 * 대회 참가자 통계 — 대시보드 예선/본선 라운드 상단의 요약 패널에 표시.
 *   leaders/followers: 3.참가자 시트의 "역할" 컬럼에서 "리더" / "팔로워" 행 카운트
 *   helperLeaders/helperFollowers: "헬퍼(리더)" / "헬퍼(팔로워)" 행 카운트 (헬퍼는 리더/팔로워 카운트에서 제외)
 *   prelimPassCouples: 1.대회정보 시트의 "예선 통과 인원 (역할별)" 값
 *   semiPassCouples: 1.대회정보 시트의 "본선 통과 인원 (역할별)" 값
 */
/** 결승 한 명의 순위·이름·총점. 6.결승 시트에서 rank ≤ 7인 행을 모두 추출. */
export interface FinalPodiumEntry {
  rank: number;
  /** 참가번호 (e.g. '001'). 시상대 표시와 일치시키기 위해 함께 노출. */
  num: string;
  name: string;
  score: string;
}

export interface ParticipantStats {
  leaders: number;
  followers: number;
  helperLeaders: number;
  helperFollowers: number;
  /** 본선 참가자 수 (= 예선 통과자 수). 4.예선통과 시트의 실제 역할별 행 카운트. */
  semiLeaders: number;
  semiFollowers: number;
  /** 결승 참가자 수 (= 본선 통과자 수). 5.본선통과 시트의 실제 역할별 행 카운트. */
  finalLeaders: number;
  finalFollowers: number;
  prelimPassCouples: number;
  semiPassCouples: number;
  /** 결승 리더 순위 1~7위 리스트 (동점 포함, rank 오름차순). 6.결승 시트에서 추출. */
  finalLeaderPodium: FinalPodiumEntry[];
  /** 결승 팔로워 순위 1~7위 리스트 (동점 포함, rank 오름차순). 6.결승 시트에서 추출. */
  finalFollowerPodium: FinalPodiumEntry[];
}

export interface ContestMeta {
  contestId: string;
  name: string;
  designTemplateNumber: number;
  rounds: Record<RoundKey, { label: string; steps: ReadonlyArray<StepKey> }>;
  festivalHeader: string;
  tagline: string;
  /** 참가자 통계. 시트 읽기 실패 시 0으로 폴백. */
  participantStats: ParticipantStats;
}
