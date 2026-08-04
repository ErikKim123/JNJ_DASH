"""thresholds.py 가 docs/rubric.md v1.0 을 정확히 반영하는지 검증.

rubric 이 개정되면 이 테스트가 먼저 깨져야 한다.
"""

import pytest

from worker import thresholds as T


def test_rubric_version():
    assert T.RUBRIC_VERSION == "1.0"


@pytest.mark.parametrize(
    # rubric §2.2 표를 그대로 옮긴 것. 표는 반올림하지 않은 정확값이므로 float 로 비교한다.
    "bpm,interval,onbeat,minor",
    [
        (80, 750.0, 75.0, 150.0),
        (96, 625.0, 62.5, 125.0),
        (120, 500.0, 50.0, 100.0),
        (140, 428.6, 50.0, 100.0),
    ],
)
def test_rubric_2_2_table(bpm, interval, onbeat, minor):
    assert T.beat_interval_ms(bpm) == pytest.approx(interval, abs=0.05)
    assert T.t_onbeat_ms(bpm) == pytest.approx(onbeat, abs=0.05)
    assert T.t_minor_ms(bpm) == pytest.approx(minor, abs=0.05)


def test_absolute_floor_applies_at_fast_tempo():
    """빠른 곡에서는 비율이 아니라 절대 하한이 적용된다."""
    # 120 BPM 이상이면 0.10 × 500ms = 50ms 이하이므로 하한이 이긴다
    assert T.t_onbeat_ms(160) == T.ONBEAT_FLOOR_MS
    assert T.t_minor_ms(160) == T.MINOR_FLOOR_MS


def test_ratio_applies_at_slow_tempo():
    """느린 곡에서는 비율이 적용된다."""
    assert T.t_onbeat_ms(60) == pytest.approx(100.0)  # 0.10 × 1000ms
    assert T.t_minor_ms(60) == pytest.approx(200.0)


def test_onbeat_is_stricter_than_minor():
    for bpm in (60, 80, 96, 120, 140, 180):
        assert T.t_onbeat_ms(bpm) < T.t_minor_ms(bpm)


def test_invalid_bpm_rejected():
    with pytest.raises(ValueError):
        T.beat_interval_ms(0)
    with pytest.raises(ValueError):
        T.beat_interval_ms(-1)


@pytest.mark.parametrize(
    "ratio,tone",
    [(100, "maintain"), (90, "maintain"), (89.9, "refine"), (75, "refine"),
     (74.9, "focus"), (60, "focus"), (59.9, "foundation"), (0, "foundation")],
)
def test_comment_tone_bands(ratio, tone):
    """rubric §2.4 — 등급이 아니라 코멘트 어조 선택용."""
    assert T.comment_tone(ratio) == tone


def test_penalty_codes_match_rubric_4():
    assert T.PENALTY_CODES == ("P-1", "P-2", "P-3", "P-4")
    assert T.PENALTY_P1_CONSECUTIVE == 4
    assert T.PENALTY_P2_RATIO_OF_BEAT == 0.35
    assert T.PENALTY_P4_REPEAT_COUNT == 3


def test_confidence_thresholds_match_rubric_6():
    assert T.CONF_POSE_SUCCESS_LOW == 0.80
    assert T.CONF_OUT_OF_FRAME_LOW == 0.10
    assert set(T.LOW_REASONS) == {
        "pose_success_low", "id_switch_detected", "out_of_frame_high"
    }


def test_no_scoring_constants_for_non_timing_axes():
    """절대 원칙 1 — Timing 외 축의 점수 관련 상수가 있으면 안 된다."""
    banned = ("TECHNIQUE_SCORE", "TEAMWORK_SCORE", "MUSICALITY_SCORE",
              "RANK", "PASS_", "TOTAL_SCORE", "WINNER")
    names = [n for n in dir(T) if n.isupper()]
    for n in names:
        for b in banned:
            assert b not in n, f"금칙 상수: {n}"
