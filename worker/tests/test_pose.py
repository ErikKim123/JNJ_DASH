"""포즈 판정 순수 함수 검증 — 영상/MediaPipe 없이 돌아간다.

특히 ID 스위칭 감지는 rubric §6 의 confidence=low 조건이므로
잘못 동작하면 커플 모드 싱크로 지표가 신뢰할 수 없게 된다.
"""

import numpy as np
import pytest

from worker import pose as P
from worker import thresholds as T


def make_person(hip_x: float, hip_y: float = 0.5, *,
                torso: float = 0.2, visible: float = 1.0,
                full_body: bool = True) -> np.ndarray:
    """테스트용 33 랜드마크. 골반 중심을 (hip_x, hip_y) 에 둔다."""
    lm = np.zeros((33, 4), dtype=np.float32)
    lm[:, 0] = hip_x
    lm[:, 1] = hip_y
    lm[:, 3] = visible

    lm[P.L_HIP] = [hip_x - 0.05, hip_y, 0, visible]
    lm[P.R_HIP] = [hip_x + 0.05, hip_y, 0, visible]
    lm[P.L_SHOULDER] = [hip_x - 0.05, hip_y - torso, 0, visible]
    lm[P.R_SHOULDER] = [hip_x + 0.05, hip_y - torso, 0, visible]
    lm[P.NOSE] = [hip_x, hip_y - torso - 0.1, 0, visible]
    ankle_y = hip_y + 0.35 if full_body else 1.4   # full_body=False 면 화면 밖
    lm[P.L_ANKLE] = [hip_x - 0.04, ankle_y, 0, visible]
    lm[P.R_ANKLE] = [hip_x + 0.04, ankle_y, 0, visible]
    return lm


# ── 전신 판정 ────────────────────────────────────────────────────
def test_full_body_visible_ok():
    assert P.is_full_body_visible(make_person(0.5)) is True


def test_full_body_none_is_false():
    assert P.is_full_body_visible(None) is False


def test_full_body_ankle_below_frame():
    """발목이 화면 아래로 벗어나면 전신 이탈."""
    assert P.is_full_body_visible(make_person(0.5, full_body=False)) is False


def test_full_body_low_visibility():
    low = T.LANDMARK_VISIBILITY_MIN - 0.1
    assert P.is_full_body_visible(make_person(0.5, visible=low)) is False


def test_full_body_x_out_of_frame():
    lm = make_person(0.5)
    lm[P.L_SHOULDER, 0] = 1.2   # 오른쪽으로 벗어남
    assert P.is_full_body_visible(lm) is False


# ── 기하 헬퍼 ────────────────────────────────────────────────────
def test_hip_center():
    c = P.hip_center(make_person(0.3, 0.6))
    assert c == pytest.approx([0.3, 0.6], abs=1e-6)


def test_torso_size():
    assert P.torso_size(make_person(0.5, torso=0.25)) == pytest.approx(0.25, abs=1e-6)


# ── 2인 슬롯 배정 ────────────────────────────────────────────────
def test_assign_two_keeps_order_when_separated():
    prev = [make_person(0.3), make_person(0.7)]
    cur = [make_person(0.32), make_person(0.72)]
    out, c_id, c_sw = P.assign_two(prev, cur)
    assert P.hip_center(out[0])[0] == pytest.approx(0.32)
    assert c_id < c_sw


def test_assign_two_swaps_when_detections_reversed():
    """MediaPipe 가 인물 순서를 뒤집어 내놔도 슬롯은 유지돼야 한다."""
    prev = [make_person(0.3), make_person(0.7)]
    cur = [make_person(0.72), make_person(0.32)]   # 순서 반대
    out, c_id, c_sw = P.assign_two(prev, cur)
    assert P.hip_center(out[0])[0] == pytest.approx(0.32)   # 슬롯0 = 왼쪽 사람 유지
    assert c_sw < c_id


def test_assign_two_passthrough_when_no_prev():
    cur = [make_person(0.3), make_person(0.7)]
    out, c_id, c_sw = P.assign_two([None, None], cur)
    assert out is cur and c_id == 0.0 and c_sw == 0.0


# ── 모호성(=ID 스위칭 위험) 판정 ─────────────────────────────────
def test_ambiguous_when_costs_are_close():
    """두 배정 비용이 비슷하면 = 두 사람이 겹친 상태 → 추적 불신."""
    assert P.is_ambiguous(cost_identity=0.10, cost_swap=0.11, scale=0.2) is True


def test_not_ambiguous_when_clearly_separated():
    assert P.is_ambiguous(cost_identity=0.02, cost_swap=0.40, scale=0.2) is False


def test_ambiguous_when_best_cost_jumps():
    """최선 배정조차 상체 길이의 1.5배 넘게 튀면 추적 실패로 본다."""
    assert P.is_ambiguous(cost_identity=0.35, cost_swap=0.90, scale=0.2) is True


def test_ambiguous_with_degenerate_scale():
    assert P.is_ambiguous(0.1, 0.5, scale=0.0) is True


# ── PoseSeries ───────────────────────────────────────────────────
def test_pose_series_json_shape():
    s = P.PoseSeries(fps=30.0, persons=2)
    s.landmarks = [[make_person(0.3), make_person(0.7)]]
    s.success_ratio = 0.95
    s.out_of_frame_ratio = 0.02
    s.id_switch_detected = False
    j = s.as_json()
    assert set(j) == {"success_ratio", "out_of_frame_ratio", "id_switch_detected", "persons"}
    assert s.frame_count == 1


def test_pose_series_timestamps():
    s = P.PoseSeries(fps=10.0, persons=1)
    s.landmarks = [[make_person(0.5)] for _ in range(5)]
    assert s.timestamps_sec() == pytest.approx([0.0, 0.1, 0.2, 0.3, 0.4])
