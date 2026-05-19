// DB 테이블 타입. db/migrations/*.sql 와 일치.
// 수동 작성 (supabase gen types 도 가능하지만 의존성 추가 없이 가볍게 유지).
import type { ScoringItemKey } from './scoring';
export type { ScoringItemKey };

export type ParticipantRole =
  | 'leader'
  | 'follower'
  | 'helper_leader'
  | 'helper_follower';

export type ContestStatus = 'ready' | 'live' | 'done' | 'archived';
export type RoundStatus = 'prep' | 'pairing' | 'open' | 'live' | 'calculate' | 'close' | 'result';
export type PairingRoundDb = 'prelim' | 'semi';
export type PairingStatus = 'draft' | 'confirmed';
export type QualifierRoundDb = 'prelim' | 'semi';
export type FinalRole = 'leader' | 'follower';
export type JudgingRound = 'prelim' | 'semi' | 'final';
export type VoteMark = 'O' | 'X';

export interface ContestRow {
  id: string;
  name: string;
  host_org: string;
  period_start: string | null;
  period_end: string | null;
  design_template_number: number;
  festival_header: string;
  tagline: string;
  prelim_pass_per_role: number;
  semi_pass_per_role: number;
  status: ContestStatus;
  /** 라운드별 진행 상태 — 시트의 라운드 드롭다운 대체. 표출 화면 step 흐름과 매칭. */
  prelim_status: RoundStatus;
  semi_status: RoundStatus;
  final_status: RoundStatus;
  legacy_spreadsheet_id: string | null;
  /** 결승 채점 활성 항목 키 배열. 기본값: ['fundamentals','connection','musicality']. */
  scoring_items: ScoringItemKey[];
  created_at: string;
  updated_at: string;
}

export interface ParticipantRow {
  id: string;
  contest_id: string;
  num: string;
  team_name: string;
  representative: string;
  role: ParticipantRole;
  photo_url: string;
  meta: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface PairingRow {
  id: string;
  contest_id: string;
  round: PairingRoundDb;
  pair_idx: number;
  leader_num: string;
  leader_name: string;
  follower_num: string;
  follower_name: string;
  status: PairingStatus;
  shuffled_at: string;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface QualifierRow {
  id: string;
  contest_id: string;
  round: QualifierRoundDb;
  participant_num: string;
  team_name: string;
  representative: string;
  role: ParticipantRole;
  photo_url: string;
  passed: boolean;
  votes: number;
  display_order: number;
  meta: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface FinalResultRow {
  id: string;
  contest_id: string;
  participant_num: string;
  team_name: string;
  role: FinalRole;
  final_rank: number | null;
  total_score: number | null;
  average: number | null;
  photo_url: string;
  meta: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type JudgeTargetRole = 'leader' | 'follower' | 'both';

export interface JudgeRow {
  id: string;
  contest_id: string;
  round: JudgingRound;
  display_order: number;
  name: string;
  alias: string;
  specialty: string;
  target_role: JudgeTargetRole;
  career: string;
  phone: string;
  email: string;
  memo: string;
  /** 이 라운드에서 줄 수 있는 최대 O 표 수. null = 제한 없음. */
  max_votes: number | null;
  created_at: string;
  updated_at: string;
}

export interface JudgeVoteRow {
  id: string;
  judge_id: string;
  participant_num: string;
  vote_mark: VoteMark | null;
  // 결승 채점 6 항목 — DB 컬럼은 historical 명명.
  basic_score: number | null;          // fundamentals
  connectivity_score: number | null;   // connection
  musicality_score: number | null;     // musicality
  creativity_score: number | null;     // creativity
  crowd_reaction_score: number | null; // crowd_reaction
  showmanship_score: number | null;    // showmanship
  updated_at: string;
}
