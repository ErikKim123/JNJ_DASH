"""구간 태깅 · 감점 트리거 검증 — rubric §3, §4."""

import numpy as np
import pytest

from worker import segments as S
from worker import thresholds as T
from worker.pose import L_SHOULDER, R_SHOULDER


# ── 타임코드 ─────────────────────────────────────────────────────
@pytest.mark.parametrize("sec,tc", [
    (0.0, "00:00:00.000"),
    (21.4, "00:00:21.400"),
    (61.25, "00:01:01.250"),
    (3661.5, "01:01:01.500"),
    (-5.0, "00:00:00.000"),
])
def test_format_tc(sec, tc):
    assert S.format_tc(sec) == tc


# ── 구간 생성 (rubric §3.1) ──────────────────────────────────────
def _onsets(n):
    return np.arange(n, dtype=np.float64) * 0.5   # 120 BPM 간격


def test_no_segment_when_all_onbeat():
    off = np.zeros(6)
    assert S.build_segments(_onsets(6), off, 120.0) == []


def test_needs_min_consecutive_onsets():
    """연속 2개는 구간이 안 된다 (SEGMENT_MIN_ONSETS=3)."""
    off = np.array([200.0, 200.0, 0.0, 0.0, 0.0, 0.0])
    assert S.build_segments(_onsets(6), off, 120.0) == []


def test_three_consecutive_makes_segment():
    off = np.array([200.0, 210.0, 190.0, 0.0, 0.0, 0.0])
    segs = S.build_segments(_onsets(6), off, 120.0)
    assert len(segs) == 1
    assert segs[0].type == "lag"
    assert segs[0].avg_offset_ms == pytest.approx(200.0)
    assert len(segs[0].beat_offsets_ms) == 3


def test_rush_type_for_negative_offsets():
    off = np.array([-200.0, -210.0, -190.0, 0.0, 0.0, 0.0])
    segs = S.build_segments(_onsets(6), off, 120.0)
    assert segs[0].type == "rush"


def test_sign_change_splits_segments():
    """부호가 바뀌면 다른 구간이다."""
    off = np.array([200.0, 200.0, 200.0, -200.0, -200.0, -200.0])
    segs = S.build_segments(_onsets(6), off, 120.0)
    assert [s.type for s in segs] == ["lag", "rush"]


def test_onbeat_onset_breaks_the_run():
    off = np.array([200.0, 200.0, 0.0, 200.0, 200.0, 200.0])
    segs = S.build_segments(_onsets(6), off, 120.0)
    assert len(segs) == 1   # 앞의 2개는 미달, 뒤의 3개만 구간


def test_segment_times_come_from_onsets():
    off = np.array([200.0, 200.0, 200.0])
    segs = S.build_segments(np.array([1.0, 1.5, 2.0]), off, 120.0)
    assert segs[0].start_sec == 1.0 and segs[0].end_sec == 2.0
    assert segs[0].as_json()["start_tc"] == "00:00:01.000"


def test_empty_and_mismatched_inputs():
    assert S.build_segments(np.zeros(0), np.zeros(0), 120.0) == []
    assert S.build_segments(np.zeros(3), np.zeros(2), 120.0) == []


# ── 감점 트리거 (rubric §4) ──────────────────────────────────────
def _seg(offsets, type_="lag"):
    return S.Segment(start_sec=0.0, end_sec=2.0, type=type_,
                     avg_offset_ms=float(np.mean(offsets)),
                     beat_offsets_ms=list(offsets))


def test_p1_needs_four_consecutive_over_minor():
    """120 BPM → T_minor 100ms."""
    seg = _seg([150.0, 150.0, 150.0])          # 3개
    S.apply_penalties([seg], 120.0)
    assert "P-1" not in seg.penalty_codes

    seg4 = _seg([150.0, 150.0, 150.0, 150.0])  # 4개
    S.apply_penalties([seg4], 120.0)
    assert "P-1" in seg4.penalty_codes


def test_p2_severe_deviation():
    """구간 평균 |offset| > 0.35 × 비트간격(500ms) = 175ms."""
    seg = _seg([180.0, 180.0, 180.0])
    S.apply_penalties([seg], 120.0)
    assert "P-2" in seg.penalty_codes

    mild = _seg([120.0, 120.0, 120.0])
    S.apply_penalties([mild], 120.0)
    assert "P-2" not in mild.penalty_codes


def test_p3_break_ignored():
    seg = _seg([120.0, 120.0, 120.0], type_="break_ignored")
    S.apply_penalties([seg], 120.0)
    assert "P-3" in seg.penalty_codes


def test_p4_repeated_pattern():
    """동일 type 이 3회 이상이면 전부에 P-4."""
    segs = [_seg([120.0, 120.0, 120.0]) for _ in range(3)]
    S.apply_penalties(segs, 120.0)
    assert all("P-4" in s.penalty_codes for s in segs)


def test_p4_not_applied_below_threshold():
    segs = [_seg([120.0, 120.0, 120.0]) for _ in range(2)]
    S.apply_penalties(segs, 120.0)
    assert all("P-4" not in s.penalty_codes for s in segs)


def test_penalty_trigger_reflects_codes():
    seg = _seg([120.0, 120.0, 120.0])
    S.apply_penalties([seg], 120.0)
    assert seg.penalty_trigger == bool(seg.penalty_codes)


def test_penalty_codes_are_from_rubric_set():
    segs = [_seg([200.0] * 5, type_="break_ignored") for _ in range(3)]
    S.apply_penalties(segs, 120.0)
    for s in segs:
        assert set(s.penalty_codes) <= set(T.PENALTY_CODES)


def test_penalties_do_not_change_offsets():
    """⚠️ 감점 트리거는 표시용이다. 오프셋/점수를 건드리면 안 된다 (rubric §4)."""
    seg = _seg([200.0, 200.0, 200.0])
    before = list(seg.beat_offsets_ms), seg.avg_offset_ms
    S.apply_penalties([seg], 120.0)
    assert (seg.beat_offsets_ms, seg.avg_offset_ms) == (before[0], before[1])


# ── 턴 감지 (rubric §3.3 post_turn) ──────────────────────────────
def _lm_facing(angle_deg: float) -> np.ndarray:
    """어깨 벡터를 (x,z) 평면에서 angle_deg 만큼 회전시킨 랜드마크."""
    lm = np.zeros((33, 4), dtype=np.float32)
    lm[:, 3] = 1.0
    r = np.radians(angle_deg)
    half = 0.1
    lm[L_SHOULDER] = [-half * np.cos(r), 0.4, -half * np.sin(r), 1.0]
    lm[R_SHOULDER] = [half * np.cos(r), 0.4, half * np.sin(r), 1.0]
    return lm


def test_body_orientation_tracks_rotation():
    assert S.body_orientation_deg(_lm_facing(0.0)) == pytest.approx(0.0, abs=1e-3)
    assert S.body_orientation_deg(_lm_facing(45.0)) == pytest.approx(45.0, abs=1e-3)


def test_cumulative_rotation_accumulates():
    frames = [_lm_facing(a) for a in range(0, 200, 10)]
    cum = S.cumulative_rotation_deg(frames)
    assert cum[-1] == pytest.approx(190.0, abs=1.0)


def test_cumulative_rotation_handles_missing_frames():
    frames = [_lm_facing(0.0), None, _lm_facing(30.0)]
    cum = S.cumulative_rotation_deg(frames)
    assert cum[-1] == pytest.approx(30.0, abs=1.0)


def test_turn_times_fires_at_180_degrees():
    frames = [_lm_facing(a) for a in range(0, 200, 10)]   # 190도 회전
    times = S.turn_times(frames, fps=10.0)
    assert times.size == 1


def test_turn_times_two_turns():
    frames = [_lm_facing(a % 360) for a in range(0, 380, 10)]  # 370도
    times = S.turn_times(frames, fps=10.0)
    assert times.size == 2


def test_turn_times_no_rotation():
    frames = [_lm_facing(0.0) for _ in range(20)]
    assert S.turn_times(frames, fps=10.0).size == 0


# ── as_json ──────────────────────────────────────────────────────
def test_segment_json_shape():
    seg = _seg([200.0, 200.0, 200.0])
    S.apply_penalties([seg], 120.0)
    j = seg.as_json()
    assert set(j) == {
        "start_tc", "end_tc", "type", "avg_offset_ms",
        "beat_offsets_ms", "context", "penalty_trigger", "penalty_codes",
    }
    # 절대 원칙 3 — 순위/합불 키가 없어야 한다
    for banned in ("rank", "pass", "score", "grade", "total"):
        assert not any(banned in k for k in j)
