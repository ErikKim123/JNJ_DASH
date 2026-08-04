"""비트 분석 검증 — 합성 오디오(soundfile). ffmpeg 불필요.

BPM 을 알고 있는 클릭 트랙을 만들어 librosa 추출 결과와 대조한다.
실패 조건(무음/비트 없음)은 rubric 결정에 따라 AudioExtractFailed 로 떨어져야
웹앱이 원곡 업로드 폴백을 띄울 수 있다.
"""

import numpy as np
import pytest
import soundfile as sf

from worker import beat as B
from worker import thresholds as T
from worker.errors import AudioExtractFailed

SR = B.SR


def write_click_track(path, bpm: float, seconds: float = 20.0,
                      tone_amp: float = 0.08, click_amp: float = 0.9):
    """지속음 + 일정 간격 클릭. 지속음이 있어야 무음 판정에 걸리지 않는다."""
    n = int(SR * seconds)
    t = np.arange(n) / SR
    y = tone_amp * np.sin(2 * np.pi * 220.0 * t)

    interval = 60.0 / bpm
    click_len = int(0.01 * SR)
    env = np.exp(-np.linspace(0, 8, click_len))
    for k in range(int(seconds / interval)):
        i = int(k * interval * SR)
        if i + click_len <= n:
            y[i:i + click_len] += click_amp * env * np.sin(
                2 * np.pi * 1800.0 * t[:click_len]
            )
    sf.write(str(path), y.astype(np.float32), SR)
    return path


@pytest.fixture(scope="module")
def click_120(tmp_path_factory):
    return write_click_track(tmp_path_factory.mktemp("audio") / "c120.wav", 120.0)


# ── 정상 경로 ────────────────────────────────────────────────────
def test_detects_known_bpm(click_120):
    a = B.analyze(click_120)
    # librosa 는 배음 오탐(60/240)을 낼 수 있어 허용폭을 둔다
    assert a.bpm == pytest.approx(120.0, rel=0.06)


def test_beat_count_is_reasonable(click_120):
    a = B.analyze(click_120)
    # 20초 × 120BPM = 40비트 근처
    assert 30 <= len(a.beats_sec) <= 50


def test_beat_interval_ms_matches_bpm(click_120):
    a = B.analyze(click_120)
    assert a.beat_interval_ms == pytest.approx(60_000.0 / a.bpm)


def test_envelopes_share_time_axis(click_120):
    a = B.analyze(click_120)
    assert a.rms.size == a.frame_times.size
    assert a.frame_times[0] == pytest.approx(0.0, abs=0.05)


def test_as_json_shape(click_120):
    j = B.analyze(click_120).as_json()
    assert set(j) == {"source", "bpm", "beat_count"}
    assert j["source"] == "video_track"


# ── 곡 구조 (rubric §3.2 / §3.3) ─────────────────────────────────
def test_break_mask_marks_low_rms_portion(click_120):
    a = B.analyze(click_120)
    mask = a.break_mask()
    assert mask.size == a.rms.size
    frac = mask.mean()
    # 하위 20% 백분위 기준이므로 대략 그 근처여야 한다
    assert 0.10 <= frac <= 0.35, frac


def test_break_mask_empty_rms():
    a = B.BeatAnalysis(bpm=120, beats_sec=np.zeros(0), onset_env=np.zeros(0),
                       rms=np.zeros(0), frame_times=np.zeros(0))
    assert a.break_mask().size == 0


def test_chorus_entry_times_returns_times(click_120):
    a = B.analyze(click_120)
    times = a.chorus_entry_times()
    assert times.ndim == 1
    assert np.all(times >= 0)


# ── 실패 조건 → 원곡 업로드 폴백 ─────────────────────────────────
def test_silent_audio_raises(tmp_path):
    p = tmp_path / "silent.wav"
    sf.write(str(p), np.zeros(SR * 5, dtype=np.float32), SR)
    with pytest.raises(AudioExtractFailed) as ei:
        B.analyze(p)
    assert ei.value.detail["reason"] == "silent_audio"
    assert ei.value.code == "AUDIO_EXTRACT_FAILED"


def test_near_silent_below_threshold_raises(tmp_path):
    """AUDIO_SILENCE_RMS 미만이면 무음으로 본다."""
    p = tmp_path / "quiet.wav"
    t = np.arange(SR * 5) / SR
    y = (T.AUDIO_SILENCE_RMS * 0.2) * np.sin(2 * np.pi * 220 * t)
    sf.write(str(p), y.astype(np.float32), SR)
    with pytest.raises(AudioExtractFailed):
        B.analyze(p)


def test_too_short_for_beats_raises(tmp_path):
    """비트가 4개 미만이면 분석 불가."""
    p = tmp_path / "short.wav"
    t = np.arange(int(SR * 0.4)) / SR
    sf.write(str(p), (0.3 * np.sin(2 * np.pi * 220 * t)).astype(np.float32), SR)
    with pytest.raises(AudioExtractFailed):
        B.analyze(p)
