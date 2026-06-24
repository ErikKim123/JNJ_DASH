// DB 테이블 타입. db/migrations/*.sql 와 일치.
// 수동 작성 (supabase gen types 도 가능하지만 의존성 추가 없이 가볍게 유지).
import type { ScoringItemKey } from './scoring';
export type { ScoringItemKey };

export type ParticipantRole =
  | 'leader'
  | 'follower'
  | 'helper_leader'
  | 'helper_follower';

export type ContestStatus = 'ready' | 'closed' | 'live' | 'done' | 'archived';
/** JOIN APP 톤앤매너 — 기본 배경/텍스트 톤(프리셋의 base mode). */
export type JoinThemeMode = 'light' | 'dark';
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
  /** 페어링 그룹(조)당 커플 수. >0 이면 페어링 목록을 그 수만큼씩 끊어 A·B·C… 그룹으로 표시. 0 이면 그룹 미사용. */
  prelim_group_size: number;
  semi_group_size: number;
  status: ContestStatus;
  /** 라운드별 진행 상태 — 시트의 라운드 드롭다운 대체. 표출 화면 step 흐름과 매칭. */
  prelim_status: RoundStatus;
  semi_status: RoundStatus;
  final_status: RoundStatus;
  legacy_spreadsheet_id: string | null;
  /**
   * JOIN APP 의 그룹 폴더 키. 같은 값을 가진 대회들이 한 폴더에 묶임.
   * 빈 문자열은 "미분류(Other)" 로 분류.
   */
  group_name: string;
  /** 결승 채점 활성 항목 키 배열. 기본값: ['fundamentals','connection','musicality']. */
  scoring_items: ScoringItemKey[];
  /** PREP 화면 하단 광고/스폰서 로고 (최대 6개 public URL). */
  sponsor_logos: string[];
  /** sponsor_logos 와 1:1 매칭되는 슬롯별 투명도 (0-100). 값 미설정 시 100. */
  sponsor_logo_opacities: number[];
  /** 대회별 커스텀 배경 이미지 public URL. 비어있으면 디자인 템플릿 기본 배경. */
  background_image: string;
  /** 커스텀 배경 투명도 (0-100). 100 불투명 기본. */
  background_opacity: number;
  /** JOIN APP 톤앤매너 프리셋 키 (lib/join/theme.ts JOIN_PRESETS). 예 'dark','midnight','cream'. */
  join_theme: string;
  /** JOIN APP 포인트 색상 hex (예 '#007D48'). 빈 문자열이면 톤 기본 잉크색. */
  join_accent: string;
  /** SNS 방(오픈채팅/커뮤니티) 링크. */
  sns_url: string;
  /** SNS 방 참여 버튼 노출 여부. false 면 done 화면에서 버튼을 렌더하지 않음. */
  sns_enabled: boolean;
  /** 참가비 결제 페이지 링크. 비어있으면 done 화면·메일에서 결제 버튼을 숨김. */
  payment_url: string;
  /** 결제 버튼 노출 여부. false 면 done 화면·메일에서 버튼을 렌더하지 않음. */
  payment_enabled: boolean;
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
  /** 심사위원 프로필 사진 URL (Supabase Storage public CDN). 비어있으면 미등록. */
  photo_url: string;
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
