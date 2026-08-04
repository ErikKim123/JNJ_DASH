"""지표 산출 검증 — 합성 데이터. 영상/ffmpeg 없이 돌아간다."""

import numpy as np
import pytest

from worker import metrics as M
from worker import thresholds as T


# ── 오프셋 (rubric §2.1) ─────────────────────────────────────────
def test_offset_sign_lag_is_positive():
    """비트보다 늦으면 + (lag)."""
    beats = np.array([1.0, 2.0, 3.0])
    onsets = np.array([1.05])  # 50ms 늦음
    off = M.signed_offsets_ms(onsets, beats)
    assert off[0] == pytest.approx(50.0, abs=0.01)


def test_offset_sign_rush_is_negative():
    """비트보다 빠르면 - (rush)."""
    beats = np.array([1.0, 2.0, 3.0])
    onsets = np.array([0.94])  # 60ms 빠름
    off = M.signed_offsets_ms(onsets, beats)
    assert off[0] == pytest.approx(-60.0, abs=0.01)


def test_offset_picks_nearest_beat():
    beats = np.array([1.0, 2.0])
    # 1.6s 는 2.0 에 더 가깝다 → -400ms
    off = M.signed_offsets_ms(np.array([1.6]), beats)
    assert off[0] == pytest.approx(-400.0, abs=0.01)


def test_offset_empty_inputs():
    assert M.signed_offsets_ms(np.zeros(0), np.array([1.0])).size == 0
    assert M.signed_offsets_ms(np.array([1.0]), np.zeros(0)).size == 0


# ── 온비트율 (rubric §2.3) ───────────────────────────────────────
def test_onbeat_ratio_all_on():
    # 96 BPM → T_onbeat 62.5ms
    off = np.array([0.0, 10.0, -20.0, 62.0])
    assert M.onbeat_ratio(off, 96) == 100.0


def test_onbeat_ratio_boundary_is_inclusive():
    """|offset| == T_onbeat 는 온비트에 포함된다."""
    assert M.onbeat_ratio(np.array([62.5]), 96) == 100.0
    assert M.onbeat_ratio(np.array([62.6]), 96) == 0.0


def test_onbeat_ratio_half():
    off = np.array([10.0, 200.0, -30.0, -300.0])
    assert M.onbeat_ratio(off, 96) == 50.0


def test_onbeat_ratio_uses_tempo_relative_threshold():
    """같은 오프셋도 템포에 따라 판정이 달라진다 (rubric §2.2)."""
    off = np.array([70.0])
    assert M.onbeat_ratio(off, 80) == 100.0   # 80 BPM → 75ms 허용
    assert M.onbeat_ratio(off, 120) == 0.0    # 120 BPM → 50ms 허용


def test_onbeat_ratio_empty():
    assert M.onbeat_ratio(np.zeros(0), 96) == 0.0


# ── 오프셋 통계 ──────────────────────────────────────────────────
def test_offset_stats_uses_absolute_values():
    st = M.offset_stats(np.array([-100.0, 100.0]))
    assert st["mean"] == 100.0
    assert st["median"] == 100.0


def test_offset_stats_empty():
    assert M.offset_stats(np.zeros(0))["mean"] == 0.0


# ── 동작 온셋 ────────────────────────────────────────────────────
def test_find_motion_onsets_detects_peaks():
    fps = 30.0
    # 1초 간격으로 속도 스파이크 3개
    speed = np.zeros(120)
    for f in (30, 60, 90):
        speed[f] = 10.0
    onsets = M.find_motion_onsets(speed, fps)
    assert onsets.size == 3
    assert onsets == pytest.approx([1.0, 2.0, 3.0], abs=0.05)


def test_find_motion_onsets_merges_close_peaks():
    """min_gap 안에 있는 피크는 하나로 합쳐진다."""
    fps = 30.0
    speed = np.zeros(60)
    speed[30] = 5.0
    speed[31] = 9.0   # 33ms 뒤 — 같은 동작
    onsets = M.find_motion_onsets(speed, fps)
    assert onsets.size == 1


def test_find_motion_onsets_short_input():
    assert M.find_motion_onsets(np.array([1.0]), 30.0).size == 0


# ── 관절 속도 ────────────────────────────────────────────────────
def _landmark(x: float, y: float) -> np.ndarray:
    lm = np.zeros((33, 4), dtype=np.float32)
    lm[:, 0] = x
    lm[:, 1] = y
    lm[:, 3] = 1.0
    return lm


def test_joint_speed_constant_motion():
    fps = 10.0
    frames = [[_landmark(0.1 * t, 0.0)] for t in range(5)]
    speed = M.joint_speed([f[0] for f in frames], fps)
    # 프레임당 0.1 이동 × 10fps = 1.0/초
    assert speed[1:] == pytest.approx(1.0, abs=1e-6)
    assert speed[0] == 0.0  # 첫 프레임은 이전이 없다


def test_joint_speed_missing_frames_are_zero():
    fps = 10.0
    lms = [_landmark(0, 0), None, _landmark(0.5, 0)]
    speed = M.joint_speed(lms, fps)
    assert speed[1] == 0.0
    assert speed[2] == 0.0  # 이전이 None 이므로 계산 불가


# ── 참고 지표 ────────────────────────────────────────────────────
def test_sync_index_identical_signals_is_100():
    rng = np.random.default_rng(0)
    s = rng.random(200)
    idx, lag = M.sync_index(s, s, fps=30.0)
    assert idx == pytest.approx(100.0, abs=0.5)
    assert lag == 0.0


def test_sync_index_detects_lag():
    rng = np.random.default_rng(1)
    a = rng.random(200)
    shift = 6  # 프레임
    b = np.concatenate([np.zeros(shift), a[:-shift]])
    idx, lag = M.sync_index(a, b, fps=30.0)
    assert idx > 80.0
    assert lag == pytest.approx(shift / 30.0 * 1000.0, abs=35.0)


def test_sync_index_short_input():
    assert M.sync_index(np.zeros(2), np.zeros(2), 30.0) == (0.0, 0.0)


def test_activity_index_correlated():
    fps = 30.0
    t = np.arange(300) / fps
    speed = np.sin(2 * np.pi * 1.0 * t) + 1.0
    rms_times = np.arange(0, 10, 0.05)
    rms = np.sin(2 * np.pi * 1.0 * rms_times) + 1.0
    assert M.activity_index(speed, fps, rms, rms_times) > 90.0


def test_activity_index_uncorrelated_is_clipped_to_zero():
    fps = 30.0
    t = np.arange(300) / fps
    speed = np.sin(2 * np.pi * 1.0 * t)
    rms_times = np.arange(0, 10, 0.05)
    rms = -np.sin(2 * np.pi * 1.0 * rms_times)  # 역상관
    assert M.activity_index(speed, fps, rms, rms_times) == 0.0


# ── 절대 원칙 1 ──────────────────────────────────────────────────
def test_no_score_for_non_timing_axes():
    """Metrics 에 Timing 외 축의 점수 필드가 없어야 한다."""
    import dataclasses

    names = {f.name for f in dataclasses.fields(M.Metrics)}
    for banned in ("technique", "teamwork", "musicality", "total", "rank", "grade"):
        assert not any(banned in n for n in names), f"금칙 필드: {banned}"


def test_reference_json_keys_avoid_score_suffix():
    m = M.Metrics(
        onbeat_ratio=80.0, offsets_ms=np.zeros(0), onsets_sec=np.zeros(0),
        speeds=[], sync_index=70.0, sync_lag_ms=10.0, activity_index=60.0, bpm=96.0,
    )
    for key in m.reference_json():
        assert "score" not in key, f"참고 지표에 score 접미사 금지: {key}"
