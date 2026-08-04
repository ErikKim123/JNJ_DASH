"""지표 산출 — 온비트율(점수) + 참고 지표.

⚠️ 절대 원칙 1 (rubric §1.2):
   이 모듈이 만드는 **점수는 onbeat_ratio 하나뿐**이다.
   sync_index / activity_index 는 참고 지표이며 순위·합불에 쓰지 않는다.
   Technique/Teamwork/Musicality 에 대응하는 수치는 여기서 만들지 않는다.

핵심 함수는 전부 순수 함수로 두어 영상 없이 합성 데이터로 테스트한다.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import numpy as np

from . import thresholds as T
from .pose import MOTION_LANDMARKS, PoseSeries

log = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────
# 1) 동작 온셋 — 관절 속도의 국소 최대점
# ─────────────────────────────────────────────────────────────────
def joint_speed(landmarks: list[np.ndarray | None], fps: float) -> np.ndarray:
    """프레임별 관절 속도 크기(정규화 좌표/초). 미검출 프레임은 0.

    사지+골반(MOTION_LANDMARKS)의 평균 속도를 쓴다.
    """
    n = len(landmarks)
    speed = np.zeros(n, dtype=np.float64)
    idx = list(MOTION_LANDMARKS)
    for t in range(1, n):
        a, b = landmarks[t - 1], landmarks[t]
        if a is None or b is None:
            continue
        d = np.linalg.norm(b[idx, :2] - a[idx, :2], axis=1)
        speed[t] = float(np.mean(d)) * fps
    return speed


def find_motion_onsets(speed: np.ndarray, fps: float,
                       min_gap_sec: float = 0.12) -> np.ndarray:
    """속도 시계열의 국소 최대점 = 동작 온셋. 시각(초) 배열을 돌려준다.

    min_gap_sec: 같은 동작이 여러 번 잡히지 않도록 하는 최소 간격.

    피크 검출은 scipy.signal.find_peaks 를 쓴다. 직접 구현하면
    평탄역(같은 값이 연속되는 구간)에서 국소 최대를 놓친다 —
    3프레임 평활화가 짧은 스파이크를 평탄역으로 바꾸기 때문에 실제로 발생한다.
    """
    if speed.size < 3:
        return np.zeros(0)

    from scipy.signal import find_peaks

    # 잡음 억제 — 3프레임 이동평균
    s = np.convolve(speed, np.ones(3) / 3.0, mode="same")
    if not np.any(s > 0):
        return np.zeros(0)

    # 전체 평균 이상인 피크만 = '평소보다 큰 움직임'.
    # 양수 평균이 아니라 전체 평균을 쓴다(정지 구간이 많을수록 문턱이 낮아져야 한다).
    height = float(np.mean(s))
    distance = max(1, int(round(min_gap_sec * fps)))
    peaks, _ = find_peaks(s, height=height, distance=distance)
    return peaks.astype(np.float64) / fps


# ─────────────────────────────────────────────────────────────────
# 2) 오프셋 — rubric §2.1
# ─────────────────────────────────────────────────────────────────
def signed_offsets_ms(onsets_sec: np.ndarray, beats_sec: np.ndarray) -> np.ndarray:
    """각 동작 온셋 → 최근접 비트까지의 부호 있는 시차(ms).

    `+` = 비트보다 늦음(lag), `-` = 비트보다 빠름(rush)  — rubric §2.1
    """
    if onsets_sec.size == 0 or beats_sec.size == 0:
        return np.zeros(0)
    beats = np.sort(np.asarray(beats_sec, dtype=np.float64))
    idx = np.searchsorted(beats, onsets_sec)
    idx = np.clip(idx, 1, len(beats) - 1)
    left, right = beats[idx - 1], beats[idx]
    # 더 가까운 쪽을 고른다
    nearest = np.where(
        np.abs(onsets_sec - left) <= np.abs(right - onsets_sec), left, right
    )
    return (onsets_sec - nearest) * 1000.0


# ─────────────────────────────────────────────────────────────────
# 3) 온비트율 — rubric §2.3. 이 제품의 유일한 점수.
# ─────────────────────────────────────────────────────────────────
def onbeat_ratio(offsets_ms: np.ndarray, bpm: float) -> float:
    """|offset| <= T_onbeat 인 온셋의 비율(%)."""
    if offsets_ms.size == 0:
        return 0.0
    t_on = T.t_onbeat_ms(bpm)
    return float(np.count_nonzero(np.abs(offsets_ms) <= t_on) / offsets_ms.size * 100.0)


def offset_stats(offsets_ms: np.ndarray) -> dict:
    if offsets_ms.size == 0:
        return {"mean": 0.0, "median": 0.0, "p90": 0.0, "std": 0.0}
    a = np.abs(offsets_ms)
    return {
        "mean": round(float(np.mean(a)), 1),
        "median": round(float(np.median(a)), 1),
        "p90": round(float(np.percentile(a, 90)), 1),
        "std": round(float(np.std(offsets_ms)), 1),
    }


# ─────────────────────────────────────────────────────────────────
# 4) 참고 지표 — 점수가 아니다
# ─────────────────────────────────────────────────────────────────
def sync_index(speed_a: np.ndarray, speed_b: np.ndarray, fps: float,
               max_lag_sec: float = 0.6) -> tuple[float, float]:
    """리더-팔로워 동작 시차 상관. (일치도 0~100, 시차 ms)

    시차 부호는 호출부에서 leader_side 로 해석한다.
    ⚠️ 참고 지표다. 점수가 아니며 순위·합불에 쓰지 않는다.
    """
    n = min(speed_a.size, speed_b.size)
    if n < 4:
        return 0.0, 0.0
    a = speed_a[:n] - np.mean(speed_a[:n])
    b = speed_b[:n] - np.mean(speed_b[:n])
    denom = np.linalg.norm(a) * np.linalg.norm(b)
    if denom < 1e-9:
        return 0.0, 0.0

    max_lag = max(1, int(round(max_lag_sec * fps)))
    lags = np.arange(-max_lag, max_lag + 1)
    best_corr, best_lag = -1.0, 0
    for lag in lags:
        if lag < 0:
            x, y = a[-lag:], b[: n + lag]
        elif lag > 0:
            x, y = a[: n - lag], b[lag:]
        else:
            x, y = a, b
        if x.size < 4:
            continue
        c = float(np.dot(x, y) / denom)
        if c > best_corr:
            best_corr, best_lag = c, int(lag)

    index = float(np.clip(best_corr, 0.0, 1.0) * 100.0)
    return round(index, 2), round(best_lag / fps * 1000.0, 1)


def activity_index(speed: np.ndarray, fps: float,
                   rms: np.ndarray, rms_times: np.ndarray) -> float:
    """음악 반응도 — 관절 속도 포락선과 음악 RMS 포락선의 상관(0~100).

    ⚠️ 참고 지표다. 점수가 아니며 순위·합불에 쓰지 않는다.
    """
    if speed.size < 4 or rms.size < 4:
        return 0.0
    speed_times = np.arange(speed.size, dtype=np.float64) / fps
    # 음악 시간축으로 리샘플해 길이를 맞춘다
    resampled = np.interp(rms_times, speed_times, speed)
    a = resampled - np.mean(resampled)
    b = rms - np.mean(rms)
    denom = np.linalg.norm(a) * np.linalg.norm(b)
    if denom < 1e-9:
        return 0.0
    corr = float(np.dot(a, b) / denom)
    return round(float(np.clip(corr, 0.0, 1.0) * 100.0), 2)


# ─────────────────────────────────────────────────────────────────
# 5) 통합
# ─────────────────────────────────────────────────────────────────
@dataclass
class Metrics:
    onbeat_ratio: float                 # [SCORE] 유일한 점수
    offsets_ms: np.ndarray
    onsets_sec: np.ndarray
    speeds: list[np.ndarray]            # 인물별 관절 속도
    sync_index: float | None            # [REFERENCE] 커플만
    sync_lag_ms: float | None
    activity_index: float               # [REFERENCE]
    bpm: float

    def timing_json(self) -> dict:
        return {
            "onbeat_ratio": round(self.onbeat_ratio, 2),
            "offset_ms": offset_stats(self.offsets_ms),
            "beat_offsets_ms": [round(float(x), 1) for x in self.offsets_ms],
        }

    def reference_json(self) -> dict:
        """참고 지표. 키 이름에 score 를 쓰지 않는다(절대 원칙 1)."""
        return {
            "sync_index": self.sync_index,
            "sync_lag_ms": self.sync_lag_ms,
            "activity_index": self.activity_index,
        }


def compute(series: PoseSeries, beat, leader_side: str = "") -> Metrics:
    """포즈 시계열 + 비트 분석 → 지표."""
    fps = series.fps
    per_person = [
        joint_speed([f[p] for f in series.landmarks], fps)
        for p in range(series.persons)
    ]

    # 온셋은 대표 인물(커플이면 리더) 기준으로 계산한다.
    lead_idx = 0
    if series.persons == 2 and leader_side == "right":
        lead_idx = 1
    onsets = find_motion_onsets(per_person[lead_idx], fps)
    offsets = signed_offsets_ms(onsets, beat.beats_sec)
    ratio = onbeat_ratio(offsets, beat.bpm)

    sync_val: float | None = None
    sync_lag: float | None = None
    if series.persons == 2:
        sync_val, sync_lag = sync_index(per_person[0], per_person[1], fps)
        # leader_side='right' 면 시차 부호를 뒤집어 '리더 기준' 으로 통일한다.
        if leader_side == "right" and sync_lag is not None:
            sync_lag = -sync_lag

    activity = activity_index(per_person[lead_idx], fps, beat.rms, beat.frame_times)

    log.info(
        "metrics: onbeat=%.1f%% onsets=%d sync=%s activity=%.1f",
        ratio, onsets.size, sync_val, activity,
    )
    return Metrics(
        onbeat_ratio=ratio, offsets_ms=offsets, onsets_sec=onsets,
        speeds=per_person, sync_index=sync_val, sync_lag_ms=sync_lag,
        activity_index=activity, bpm=beat.bpm,
    )
