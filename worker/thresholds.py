"""판정 임계값 — docs/rubric.md v1.0 의 유일한 코드 측 소유자.

⚠️ 이 파일 밖에서 임계값을 하드코딩하지 말 것.
   rubric.md 가 개정되면 RUBRIC_VERSION 을 올리고 이 파일만 고친다.
   reports.rubric_version 에 기록되므로 과거 리포트의 판정 근거를 재현할 수 있다.
"""

from __future__ import annotations

RUBRIC_VERSION = "1.0"

# ─────────────────────────────────────────────────────────────────
# rubric §2.2 — Timing 판정 임계값 (템포 상대 기준)
#   절대값 고정은 빠른 곡에서 지나치게 관대해지므로
#   "비트 간격 비율" 과 "절대 하한" 중 큰 값을 쓴다.
# ─────────────────────────────────────────────────────────────────
ONBEAT_RATIO_OF_BEAT = 0.10
ONBEAT_FLOOR_MS = 50.0
MINOR_RATIO_OF_BEAT = 0.20
MINOR_FLOOR_MS = 100.0


def beat_interval_ms(bpm: float) -> float:
    """BPM → 비트 간격(ms)."""
    if bpm <= 0:
        raise ValueError(f"bpm must be positive, got {bpm}")
    return 60_000.0 / bpm


def t_onbeat_ms(bpm: float) -> float:
    """온비트(초록) 상한. |offset| <= 이 값이면 온비트."""
    return max(ONBEAT_FLOOR_MS, ONBEAT_RATIO_OF_BEAT * beat_interval_ms(bpm))


def t_minor_ms(bpm: float) -> float:
    """경미(노랑) 상한. 초과하면 오프비트(빨강)."""
    return max(MINOR_FLOOR_MS, MINOR_RATIO_OF_BEAT * beat_interval_ms(bpm))


# ─────────────────────────────────────────────────────────────────
# rubric §3 — 오프비트 구간 분류
# ─────────────────────────────────────────────────────────────────
SEGMENT_MIN_ONSETS = 3          # §3.1 부호가 같은 온셋 연속 N개 이상이면 구간 성립
RMS_LOW_PERCENTILE = 20         # §3.2 음악 RMS 하위 N% = 브레이크 구간
BREAK_OVERLAP_RATIO = 0.50      # §3.2/§3.3 구간이 브레이크와 N 이상 겹치면 해당
POST_TURN_WINDOW_SEC = 2.0      # §3.3 구간 시작 전 N초 이내 턴이면 post_turn
TURN_ROTATION_DEG = 180.0       # §3.3 턴 판정 — 어깨-골반 orientation 누적 회전
CHORUS_ENTRY_WINDOW_SEC = 1.0   # §3.3 온셋 밀도 급증 경계 ±N초

# ─────────────────────────────────────────────────────────────────
# rubric §4 — 감점 트리거
#   ⚠️ 트리거는 "이 구간을 보라"는 표시일 뿐 onbeat_ratio 를 차감하지 않는다.
#      순위·합불 판정에도 사용하지 않는다.
# ─────────────────────────────────────────────────────────────────
PENALTY_P1_CONSECUTIVE = 4        # P-1 |offset| > T_minor 인 온셋 연속 N개 이상
PENALTY_P2_RATIO_OF_BEAT = 0.35   # P-2 구간 평균 |offset| > N × 비트간격
PENALTY_P4_REPEAT_COUNT = 3       # P-4 동일 type 구간이 영상 내 N회 이상 반복

PENALTY_CODES = ("P-1", "P-2", "P-3", "P-4")

# ─────────────────────────────────────────────────────────────────
# rubric §6 — confidence 기준
#   실제 판정은 confidence.compute_confidence() 단일 함수에서만 수행한다.
# ─────────────────────────────────────────────────────────────────
CONF_POSE_SUCCESS_LOW = 0.80       # 미만이면 low
CONF_POSE_SUCCESS_MEDIUM = 0.90    # 미만이면 medium
CONF_OUT_OF_FRAME_LOW = 0.10       # 초과하면 low
CONF_OUT_OF_FRAME_MEDIUM = 0.05    # 초과하면 medium

LOW_REASONS = ("pose_success_low", "id_switch_detected", "out_of_frame_high")

# ─────────────────────────────────────────────────────────────────
# rubric §2.4 — 코멘트 톤 구간
#   ⚠️ 등급이 아니다. 코칭 문장의 어조를 고르기 위한 참조표일 뿐이며
#      화면에 구간 이름을 표시하지 않고 순위·합불에 사용하지 않는다.
# ─────────────────────────────────────────────────────────────────
COMMENT_TONE_BANDS = (
    (90.0, "maintain"),   # 유지 중심. 세부 구간의 미세 편차만
    (75.0, "refine"),     # 강점 인정 + 반복 패턴 1~2개 지적
    (60.0, "focus"),      # 가장 빈번한 유형 1개에 집중
    (0.0, "foundation"),  # 기초 카운트 연습 권고
)


def comment_tone(onbeat_ratio: float) -> str:
    """온비트율 → 코멘트 어조 키 (등급 아님, rubric §2.4)."""
    for floor, tone in COMMENT_TONE_BANDS:
        if onbeat_ratio >= floor:
            return tone
    return "foundation"


# ─────────────────────────────────────────────────────────────────
# 워커 운영 상수 — rubric 소관이 아님 (기술적 제약)
# ─────────────────────────────────────────────────────────────────
MAX_DURATION_SEC = 180.0        # 스펙 4.1 — 최대 3분
MAX_UPLOAD_BYTES = 500 * 1024 * 1024

AUDIO_SILENCE_RMS = 0.005       # 평균 RMS 가 이 미만이면 무음 취급
AUDIO_TEMPO_CV_MAX = 0.35       # 비트 간격 변동계수 초과 시 템포 불안정 → 추출 실패
POSE_HARD_FAIL_RATIO = 0.30     # 성공 프레임이 이 미만이면 POSE_EXTRACT_FAILED
LANDMARK_VISIBILITY_MIN = 0.5   # 이 미만이면 해당 랜드마크를 미검출로 본다

KEYFRAME_MIN = 6                # Claude vision 에 보낼 키프레임 장수
KEYFRAME_MAX = 10
KEYFRAME_LONG_EDGE_PX = 1280    # 비용 억제를 위한 다운샘플 (design §7.7)
