// AI Judge 공용 타입 — design §3.4 / §3.5 의 JSON 구조를 그대로 반영한다.
//
// ⚠️ 절대 원칙 1 (docs/rubric.md §1.2):
//    점수는 onbeatRatio 하나뿐이다. syncIndex / activityIndex 는 '참고 지표'이며
//    ScoredMetric 과 타입을 분리해 화면에서 점수처럼 렌더되지 않게 한다.

export type JobRole = 'leader' | 'follower' | 'couple';
export type JobStatus = 'queued' | 'pose' | 'beat' | 'comment' | 'done' | 'failed';
export type Confidence = 'high' | 'medium' | 'low';
export type LeaderSide = '' | 'left' | 'right';

/** rubric §6 — confidence=low 사유 코드 */
export type LowReason = 'pose_success_low' | 'id_switch_detected' | 'out_of_frame_high';

/** rubric §3.2 */
export type SegmentType = 'lag' | 'rush' | 'break_ignored';
/** rubric §3.3 */
export type SegmentContext = 'post_turn' | 'music_break' | 'chorus_entry' | 'general';
/** rubric §4 */
export type PenaltyCode = 'P-1' | 'P-2' | 'P-3' | 'P-4';

// ─────────────────────────────────────────────────────────────────
// metrics_json — design §3.4
// ─────────────────────────────────────────────────────────────────
export interface OffbeatSegment {
  start_tc: string;
  end_tc: string;
  type: SegmentType;
  avg_offset_ms: number;
  beat_offsets_ms: number[];
  context: SegmentContext;
  penalty_trigger: boolean;
  penalty_codes: PenaltyCode[];
}

export interface Metrics {
  schema_version: number;
  video: { duration_sec: number; fps: number; width: number; height: number };
  audio: { source: 'video_track' | 'uploaded_song'; bpm: number; beat_count: number };
  pose: {
    success_ratio: number;
    out_of_frame_ratio: number;
    id_switch_detected: boolean;
    persons: number;
  };
  timing: {
    /** [SCORE] 이 제품의 유일한 점수 (%) */
    onbeat_ratio: number;
    offset_ms: { mean: number; median: number; p90: number; std: number };
    beat_offsets_ms: number[];
  };
  /** [REFERENCE] 점수가 아니다 */
  reference: {
    sync_index: number | null;
    sync_lag_ms: number | null;
    activity_index: number;
  };
  offbeat_segments: OffbeatSegment[];
  keyframes: { t_sec: number; path: string; reason: string }[];
  thresholds: { onbeat_ms: number; minor_ms: number; rubric_version: string };
}

// ─────────────────────────────────────────────────────────────────
// comments_json — design §3.5
//   숫자 필드가 없다. 이 타입에 number 를 추가하려 할 때는 rubric §1.2 를 먼저 볼 것.
// ─────────────────────────────────────────────────────────────────
export interface AxisComment {
  comment: string;
}
export interface ReferenceAxisComment extends AxisComment {
  /** 항상 true. 화면에 '참고 지표' 배지를 강제한다. */
  reference_only: true;
}

export interface Comments {
  timing: AxisComment;
  musicality: AxisComment;
  technique: ReferenceAxisComment;
  teamwork: ReferenceAxisComment;
  offbeat_pattern_summary: string;
  segment_coaching: { segment_index: number; coaching: string }[];
}

// ─────────────────────────────────────────────────────────────────
// API 응답
// ─────────────────────────────────────────────────────────────────
export interface JobSummary {
  jobId: string;
  status: JobStatus;
  stageIndex: number;
  stageCount: number;
  errorCode: string;
  reportId: string | null;
}

/** confidence=low 일 때 서버가 내려주는 형태 — 지표를 아예 담지 않는다. */
export interface ReportUnavailable {
  id: string;
  confidence: 'low';
  unavailableReasons: LowReason[];
}

export interface ReportAvailable {
  id: string;
  confidence: 'high' | 'medium';
  /** [SCORE] */
  onbeatRatio: number;
  /** [REFERENCE] 커플 모드가 아니면 null */
  syncIndex: number | null;
  /** [REFERENCE] */
  activityIndex: number;
  metrics: Metrics;
  comments: Comments | Record<string, never>;
  createdAt: string;
}

export type Report = ReportAvailable | ReportUnavailable;

export function isUnavailable(r: Report): r is ReportUnavailable {
  return r.confidence === 'low';
}

export interface ReportResponse {
  report: Report;
  job: {
    role: JobRole;
    songTitle: string;
    contestId: string | null;
    leaderSide: LeaderSide;
  };
  media: { videoUrl: string | null; frameUrls: string[] };
}

export interface HistoryResponse {
  items: {
    reportId: string;
    createdAt: string;
    role: JobRole;
    songTitle: string;
    confidence: Confidence;
    /** confidence=low 면 null — 신뢰할 수 없는 값을 목록에도 노출하지 않는다 */
    onbeatRatio: number | null;
  }[];
  series: { t: string; onbeatRatio: number }[];
}
