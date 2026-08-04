"""비트/곡 구조 분석 — librosa.

rubric 결정에 따라 **영상의 오디오 트랙**을 그대로 쓴다(음악 인식 API 미도입).
추출 실패 조건(무음/템포 불안정)은 AudioExtractFailed 로 올려 웹앱이
원곡 업로드 폴백을 띄우게 한다.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path

import numpy as np

from . import thresholds as T
from .errors import AudioExtractFailed

log = logging.getLogger(__name__)

SR = 22050
HOP = 512


@dataclass
class BeatAnalysis:
    bpm: float
    beats_sec: np.ndarray        # 비트 타임스탬프
    onset_env: np.ndarray        # 온셋 강도 포락선
    rms: np.ndarray              # 음량 포락선
    frame_times: np.ndarray      # onset_env / rms 의 시간축
    source: str = "video_track"  # video_track | uploaded_song

    @property
    def beat_interval_ms(self) -> float:
        return 60_000.0 / self.bpm

    def as_json(self) -> dict:
        return {
            "source": self.source,
            "bpm": round(self.bpm, 2),
            "beat_count": int(len(self.beats_sec)),
        }

    # ── 곡 구조 (rubric §3.2/§3.3) ────────────────────────────────
    def break_mask(self) -> np.ndarray:
        """음악 RMS 하위 RMS_LOW_PERCENTILE% 구간 = 브레이크."""
        if self.rms.size == 0:
            return np.zeros(0, dtype=bool)
        cutoff = np.percentile(self.rms, T.RMS_LOW_PERCENTILE)
        return self.rms <= cutoff

    def chorus_entry_times(self) -> np.ndarray:
        """온셋 밀도가 급증하는 경계 시각. 코러스 진입 추정."""
        if self.onset_env.size < 3:
            return np.zeros(0)
        # 1초 이동평균의 상승 변화량이 상위 5% 인 지점
        win = max(1, int(round(1.0 / _frame_sec())))
        kernel = np.ones(win) / win
        smooth = np.convolve(self.onset_env, kernel, mode="same")
        delta = np.diff(smooth, prepend=smooth[0])
        if not np.any(delta > 0):
            return np.zeros(0)
        thr = np.percentile(delta, 95)
        idx = np.flatnonzero(delta >= thr)
        if idx.size == 0:
            return np.zeros(0)
        # 인접 인덱스 묶어 대표점만 남긴다
        groups = np.split(idx, np.flatnonzero(np.diff(idx) > win) + 1)
        return np.array([self.frame_times[g[0]] for g in groups])


def _frame_sec() -> float:
    return HOP / SR


def analyze(audio_path: Path, source: str = "video_track") -> BeatAnalysis:
    """오디오에서 비트·온셋·RMS 를 뽑는다."""
    import librosa

    y, sr = librosa.load(str(audio_path), sr=SR, mono=True)
    if y.size == 0:
        raise AudioExtractFailed("오디오가 비어 있습니다.", reason="empty_audio")

    rms = librosa.feature.rms(y=y, hop_length=HOP)[0]
    mean_rms = float(np.mean(rms))
    if mean_rms < T.AUDIO_SILENCE_RMS:
        raise AudioExtractFailed(
            "영상에 음악이 들어 있지 않습니다(무음). 원곡 파일을 올려 주세요.",
            reason="silent_audio", mean_rms=mean_rms,
        )

    onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=HOP)
    tempo, beat_frames = librosa.beat.beat_track(
        onset_envelope=onset_env, sr=sr, hop_length=HOP, units="frames"
    )
    beats_sec = librosa.frames_to_time(beat_frames, sr=sr, hop_length=HOP)
    bpm = float(np.atleast_1d(tempo)[0])

    if beats_sec.size < 4:
        raise AudioExtractFailed(
            "비트를 찾지 못했습니다. 원곡 파일을 올려 주세요.",
            reason="no_beats", beat_count=int(beats_sec.size),
        )

    # 템포 안정성 — 비트 간격 변동계수
    intervals = np.diff(beats_sec)
    cv = float(np.std(intervals) / np.mean(intervals)) if np.mean(intervals) > 0 else 1.0
    if cv > T.AUDIO_TEMPO_CV_MAX:
        raise AudioExtractFailed(
            "박자를 안정적으로 추출하지 못했습니다. 원곡 파일을 올려 주세요.",
            reason="unstable_tempo", tempo_cv=cv,
        )

    frame_times = librosa.frames_to_time(np.arange(len(rms)), sr=sr, hop_length=HOP)
    log.info("beat: bpm=%.1f beats=%d cv=%.3f", bpm, beats_sec.size, cv)
    return BeatAnalysis(
        bpm=bpm, beats_sec=beats_sec, onset_env=onset_env,
        rms=rms, frame_times=frame_times, source=source,
    )
