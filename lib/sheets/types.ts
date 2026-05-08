// Design Ref: §3.2 — 스텝별 데이터 인터페이스. 모든 placeholder는 이 타입에서 평탄화되어
// SVG 문자열의 {{key}}와 매칭됨. 변경 시 SVG 함수의 placeholder 키도 동기화 필요.

export type RoundKey = 'prelim' | 'semi' | 'final';
export type StepKey = 'prep' | 'pairing' | 'open' | 'live' | 'wrapup' | 'close' | 'result';

export const ROUND_KEYS = ['prelim', 'semi', 'final'] as const;
export const STEP_KEYS = ['prep', 'pairing', 'open', 'live', 'wrapup', 'close', 'result'] as const;

// 라운드별 프로세스 (3 라운드 모두 7 steps 동일):
//   Prep → Pairing → Open → Live → Calculate Total → Close → Result
// 결승 Pairing은 자동 매핑 없음 — 사람이 직접 매칭하고 'PAIRING' 화면만 표출.
export const STEPS_BY_ROUND: Record<RoundKey, ReadonlyArray<StepKey>> = {
  prelim: ['prep', 'pairing', 'open', 'live', 'wrapup', 'close', 'result'],
  semi: ['prep', 'pairing', 'open', 'live', 'wrapup', 'close', 'result'],
  final: ['prep', 'pairing', 'open', 'live', 'wrapup', 'close', 'result'],
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
}

export type StepDataPayload =
  | { kind: 'prep'; data: PrepData }
  | { kind: 'pairing'; data: PairingData }
  | { kind: 'open'; data: OpenData }
  | { kind: 'live'; data: LiveData }
  | { kind: 'wrapup'; data: WrapupData }
  | { kind: 'close'; data: CloseData }
  | { kind: 'result'; data: ResultData };

export interface ContestMeta {
  contestId: string;
  name: string;
  designTemplateNumber: number;
  rounds: Record<RoundKey, { label: string; steps: ReadonlyArray<StepKey> }>;
  festivalHeader: string;
  tagline: string;
}
