// 표시용 포맷터 + 상수.
//
// ⚠️ 여기에는 '판정' 로직이 없다. 온비트/경미/오프비트 구분, confidence, 감점 트리거는
//    모두 워커가 이미 결정해 저장한 값이다 (design D1). 이 파일은 렌더링만 돕는다.

import type {
  LowReason,
  PenaltyCode,
  SegmentContext,
  SegmentType,
} from './types';

/** "00:00:21.400" → 21.4 (플레이어 seek 용) */
export function tcToSeconds(tc: string): number {
  const m = /^(\d{2}):(\d{2}):(\d{2})\.(\d{3})$/.exec(tc);
  if (!m) return 0;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4]) / 1000;
}

/** 21.4 → "0:21" (짧은 표시용) */
export function shortTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** +137 → "+137ms 밀림" */
export function offsetLabel(ms: number): string {
  const rounded = Math.round(ms);
  if (rounded === 0) return '정확';
  return rounded > 0 ? `+${rounded}ms 밀림` : `${rounded}ms 당김`;
}

export const SEGMENT_TYPE_LABEL: Record<SegmentType, string> = {
  lag: '밀림',
  rush: '당김',
  break_ignored: '브레이크 무시',
};

export const SEGMENT_CONTEXT_LABEL: Record<SegmentContext, string> = {
  post_turn: '턴 직후',
  music_break: '음악 브레이크',
  chorus_entry: '코러스 진입',
  general: '일반 구간',
};

/** rubric §3.3 — context 별 코칭 방향. Claude 코멘트가 없을 때의 폴백. */
export const CONTEXT_COACHING: Record<SegmentContext, string> = {
  post_turn: '턴 마무리 시점의 축과 시선 처리를 점검해 보세요.',
  music_break: '브레이크에서는 멈추거나 악센트에 반응해 보세요.',
  chorus_entry: '코러스 진입에서 카운트를 다시 맞춰 보세요.',
  general: '해당 구간의 반복 패턴을 확인해 보세요.',
};

/** rubric §4 */
export const PENALTY_LABEL: Record<PenaltyCode, string> = {
  'P-1': '연속 오프비트',
  'P-2': '심한 이탈',
  'P-3': '브레이크 무시',
  'P-4': '반복 패턴',
};

/** rubric §6 — confidence=low 사유별 재촬영 안내. worker/confidence.py 와 동일 문구. */
export const LOW_REASON_GUIDE: Record<LowReason, string> = {
  pose_success_low:
    '조명이 어둡거나 인물이 가려졌습니다. 밝은 곳에서 정면으로 다시 촬영해 주세요.',
  id_switch_detected:
    '두 사람이 자주 겹쳐 개별 추적에 실패했습니다. 카메라를 더 멀리 두고 촬영해 주세요.',
  out_of_frame_high:
    '전신이 화면을 벗어나는 구간이 많습니다. 머리부터 발끝까지 들어오도록 촬영해 주세요.',
};

/**
 * 오프셋 → 타임라인 색상 구분.
 * 임계값은 워커가 metrics.thresholds 에 기록해 둔 값을 그대로 쓴다.
 * (여기서 다시 계산하면 rubric 과 어긋날 수 있다)
 */
export type BeatGrade = 'onbeat' | 'minor' | 'offbeat';

export function gradeOffset(
  offsetMs: number,
  thresholds: { onbeat_ms: number; minor_ms: number }
): BeatGrade {
  const a = Math.abs(offsetMs);
  if (a <= thresholds.onbeat_ms) return 'onbeat';
  if (a <= thresholds.minor_ms) return 'minor';
  return 'offbeat';
}

export const GRADE_COLOR: Record<BeatGrade, string> = {
  onbeat: 'bg-emerald-500',
  minor: 'bg-amber-400',
  offbeat: 'bg-red-500',
};

export const ROLE_LABEL = {
  leader: '리더',
  follower: '팔로워',
  couple: '커플',
} as const;

/** 분석 대기 화면의 5단계 (스펙 4.2) */
export const STAGES = [
  { key: 'queued', label: '대기' },
  { key: 'pose', label: '포즈 추출' },
  { key: 'beat', label: '비트 분석' },
  { key: 'comment', label: '코멘트 생성' },
  { key: 'done', label: '완료' },
] as const;

export function stageIndex(status: string): number {
  const i = STAGES.findIndex((s) => s.key === status);
  return i < 0 ? 0 : i;
}
