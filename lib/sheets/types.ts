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
//   semi/final: Prep → Pairing → Open → Live → Calculate Total → Close → Result
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
  semi: ['prep', 'pairing', 'open', 'live', 'wrapup', 'close', 'result'],
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
   */
  overflow?: {
    maxPerRole: number;
    leaderTotal: number;
    followerTotal: number;
    leaderOverflow: number;
    followerOverflow: number;
  };
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

export interface ContestMeta {
  contestId: string;
  name: string;
  designTemplateNumber: number;
  rounds: Record<RoundKey, { label: string; steps: ReadonlyArray<StepKey> }>;
  festivalHeader: string;
  tagline: string;
}
