"""confidence 판정 검증 — rubric §6 / 절대 원칙 2.

이 게이트가 잘못 동작하면 신뢰할 수 없는 지표가 사용자에게 표시된다.
Plan §4.1 의 사이클1 완료 기준이자 Check 단계 필수 항목이다.
"""

import pytest

from worker import confidence as C
from worker import thresholds as T
from worker.pose import PoseSeries


# ── low 조건 3가지 (rubric §6) ───────────────────────────────────
def test_low_when_pose_success_below_80():
    r = C.compute_confidence(success_ratio=0.75, out_of_frame_ratio=0.0,
                             id_switch_detected=False)
    assert r.level == "low"
    assert r.reasons == ["pose_success_low"]
    assert r.is_low is True


def test_low_when_id_switch_detected():
    r = C.compute_confidence(success_ratio=0.99, out_of_frame_ratio=0.0,
                             id_switch_detected=True)
    assert r.level == "low"
    assert r.reasons == ["id_switch_detected"]


def test_low_when_out_of_frame_above_10():
    r = C.compute_confidence(success_ratio=0.99, out_of_frame_ratio=0.15,
                             id_switch_detected=False)
    assert r.level == "low"
    assert r.reasons == ["out_of_frame_high"]


def test_low_reports_all_reasons():
    r = C.compute_confidence(success_ratio=0.5, out_of_frame_ratio=0.5,
                             id_switch_detected=True)
    assert r.level == "low"
    assert set(r.reasons) == set(T.LOW_REASONS)


# ── 경계값 ───────────────────────────────────────────────────────
def test_exactly_80_percent_is_not_low():
    """< 80% 가 low. 정확히 80% 는 low 가 아니다."""
    r = C.compute_confidence(0.80, 0.0, False)
    assert r.level == "medium"   # 90% 미만이므로 medium


def test_exactly_10_percent_out_of_frame_is_not_low():
    """> 10% 가 low. 정확히 10% 는 low 가 아니다."""
    r = C.compute_confidence(0.99, 0.10, False)
    assert r.level == "medium"   # 5% 초과이므로 medium


# ── medium / high ────────────────────────────────────────────────
def test_medium_when_pose_between_80_and_90():
    assert C.compute_confidence(0.85, 0.0, False).level == "medium"


def test_medium_when_out_of_frame_between_5_and_10():
    assert C.compute_confidence(0.99, 0.07, False).level == "medium"


def test_high_when_clean():
    r = C.compute_confidence(0.98, 0.01, False)
    assert r.level == "high"
    assert r.reasons == []
    assert r.is_low is False


def test_high_boundary():
    assert C.compute_confidence(0.90, 0.05, False).level == "high"


# ── PoseSeries 연동 ──────────────────────────────────────────────
def test_from_series_uses_series_fields():
    s = PoseSeries(fps=30.0, persons=2)
    s.success_ratio = 0.95
    s.out_of_frame_ratio = 0.02
    s.id_switch_detected = True
    assert C.from_series(s).level == "low"


def test_from_series_high():
    s = PoseSeries(fps=30.0, persons=1)
    s.success_ratio = 0.97
    s.out_of_frame_ratio = 0.01
    assert C.from_series(s).level == "high"


# ── 안내 문구 ────────────────────────────────────────────────────
def test_every_low_reason_has_guide():
    """low 사유는 모두 재촬영 안내 문구를 가져야 한다 (rubric §6)."""
    for reason in T.LOW_REASONS:
        assert reason in C.LOW_REASON_GUIDE
        assert C.LOW_REASON_GUIDE[reason].strip()


def test_confidence_levels_are_exactly_three():
    """DB CHECK 제약과 일치해야 한다."""
    levels = {
        C.compute_confidence(0.5, 0.0, False).level,
        C.compute_confidence(0.85, 0.0, False).level,
        C.compute_confidence(0.99, 0.0, False).level,
    }
    assert levels == {"low", "medium", "high"}
