"""신뢰도 판정 — rubric §6.

⚠️ 절대 원칙 2 (rubric §1.2):
   이 파일의 compute_confidence() 가 confidence 의 **유일한 산출처**다.
   다른 모듈이나 웹앱이 confidence 를 다시 계산하거나 조건을 분기하지 말 것.
   웹앱은 저장된 값을 <ConfidenceGate> 로 렌더 여부만 결정한다.
"""

from __future__ import annotations

from typing import NamedTuple

from . import thresholds as T
from .pose import PoseSeries


class Confidence(NamedTuple):
    level: str            # 'high' | 'medium' | 'low'
    reasons: list[str]    # level='low' 일 때만 채워진다

    @property
    def is_low(self) -> bool:
        return self.level == "low"


#: 사유별 재촬영 안내 (rubric §6 표). 웹앱과 문구를 공유하기 위해 여기에 둔다.
LOW_REASON_GUIDE = {
    "pose_success_low":
        "조명이 어둡거나 인물이 가려졌습니다. 밝은 곳에서 정면으로 다시 촬영해 주세요.",
    "id_switch_detected":
        "두 사람이 자주 겹쳐 개별 추적에 실패했습니다. 카메라를 더 멀리 두고 촬영해 주세요.",
    "out_of_frame_high":
        "전신이 화면을 벗어나는 구간이 많습니다. 머리부터 발끝까지 들어오도록 촬영해 주세요.",
}


def compute_confidence(
    success_ratio: float,
    out_of_frame_ratio: float,
    id_switch_detected: bool,
) -> Confidence:
    """rubric §6 기준으로 신뢰도를 판정한다.

    low 조건 (하나라도 해당):
      · 포즈 추출 성공 프레임 < 80%
      · 인물 ID 스위칭 감지
      · 전신 프레임 이탈 구간 > 10%
    """
    reasons: list[str] = []
    if success_ratio < T.CONF_POSE_SUCCESS_LOW:
        reasons.append("pose_success_low")
    if id_switch_detected:
        reasons.append("id_switch_detected")
    if out_of_frame_ratio > T.CONF_OUT_OF_FRAME_LOW:
        reasons.append("out_of_frame_high")

    if reasons:
        return Confidence("low", reasons)

    if (success_ratio < T.CONF_POSE_SUCCESS_MEDIUM
            or out_of_frame_ratio > T.CONF_OUT_OF_FRAME_MEDIUM):
        return Confidence("medium", [])

    return Confidence("high", [])


def from_series(series: PoseSeries) -> Confidence:
    """PoseSeries 에서 바로 판정한다."""
    return compute_confidence(
        success_ratio=series.success_ratio,
        out_of_frame_ratio=series.out_of_frame_ratio,
        id_switch_detected=series.id_switch_detected,
    )
