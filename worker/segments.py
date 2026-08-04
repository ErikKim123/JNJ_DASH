"""오프비트 구간 태깅 — rubric §3, §4.

구간 = 부호가 같고 |offset| > T_onbeat 인 동작 온셋이 연속 SEGMENT_MIN_ONSETS 개 이상.
각 구간에 유형(lag/rush/break_ignored), 원인 추정 context, 감점 트리거를 붙인다.

⚠️ 감점 트리거는 '이 구간을 보라'는 표시일 뿐이다 (rubric §4).
   onbeat_ratio 를 차감하지 않고, 순위·합불 판정에도 쓰지 않는다.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

import numpy as np

from . import thresholds as T
from .pose import L_HIP, L_SHOULDER, R_HIP, R_SHOULDER, PoseSeries

log = logging.getLogger(__name__)


def format_tc(seconds: float) -> str:
    """초 → HH:MM:SS.mmm 타임코드."""
    if seconds < 0:
        seconds = 0.0
    total_ms = int(round(seconds * 1000))
    h, rem = divmod(total_ms, 3_600_000)
    m, rem = divmod(rem, 60_000)
    s, ms = divmod(rem, 1000)
    return f"{h:02d}:{m:02d}:{s:02d}.{ms:03d}"


@dataclass
class Segment:
    start_sec: float
    end_sec: float
    type: str                      # lag | rush | break_ignored
    avg_offset_ms: float
    beat_offsets_ms: list[float]
    context: str = "general"       # post_turn | music_break | chorus_entry | general
    penalty_codes: list[str] = field(default_factory=list)

    @property
    def penalty_trigger(self) -> bool:
        return bool(self.penalty_codes)

    def as_json(self) -> dict:
        return {
            "start_tc": format_tc(self.start_sec),
            "end_tc": format_tc(self.end_sec),
            "type": self.type,
            "avg_offset_ms": round(self.avg_offset_ms, 1),
            "beat_offsets_ms": [round(float(x), 1) for x in self.beat_offsets_ms],
            "context": self.context,
            "penalty_trigger": self.penalty_trigger,
            "penalty_codes": list(self.penalty_codes),
        }


# ─────────────────────────────────────────────────────────────────
# 턴 감지 — rubric §3.3 post_turn
# ─────────────────────────────────────────────────────────────────
def body_orientation_deg(lm: np.ndarray) -> float:
    """몸통이 향한 방향(도).

    어깨 벡터를 (x, z) 평면에 투영해 각도를 낸다. 화면 좌표만으로는 수직축
    회전을 알 수 없으므로 MediaPipe 가 주는 z(깊이)를 함께 쓴다.
    """
    lx, lz = float(lm[L_SHOULDER, 0]), float(lm[L_SHOULDER, 2])
    rx, rz = float(lm[R_SHOULDER, 0]), float(lm[R_SHOULDER, 2])
    return float(np.degrees(np.arctan2(rz - lz, rx - lx)))


def cumulative_rotation_deg(landmarks: list[np.ndarray | None]) -> np.ndarray:
    """프레임별 누적 회전량(도). 미검출 구간은 직전 값을 유지한다."""
    n = len(landmarks)
    out = np.zeros(n, dtype=np.float64)
    angles: list[float | None] = [
        body_orientation_deg(lm) if lm is not None else None for lm in landmarks
    ]
    prev: float | None = None
    acc = 0.0
    for i, a in enumerate(angles):
        if a is not None and prev is not None:
            d = a - prev
            # -180~180 으로 감아 급격한 부호 반전(래핑)을 상쇄
            d = (d + 180.0) % 360.0 - 180.0
            acc += abs(d)
        if a is not None:
            prev = a
        out[i] = acc
    return out


def turn_times(landmarks: list[np.ndarray | None], fps: float) -> np.ndarray:
    """턴이 완료된 시각(초). 누적 회전이 TURN_ROTATION_DEG 를 넘을 때마다 1회."""
    cum = cumulative_rotation_deg(landmarks)
    if cum.size == 0:
        return np.zeros(0)
    times: list[float] = []
    marker = T.TURN_ROTATION_DEG
    for i, v in enumerate(cum):
        while v >= marker:
            times.append(i / fps)
            marker += T.TURN_ROTATION_DEG
    return np.asarray(times, dtype=np.float64)


def has_hips(lm: np.ndarray | None) -> bool:
    return lm is not None and not np.allclose(lm[[L_HIP, R_HIP], :2], 0.0)


# ─────────────────────────────────────────────────────────────────
# 구간 생성 — rubric §3.1, §3.2
# ─────────────────────────────────────────────────────────────────
def build_segments(onsets_sec: np.ndarray, offsets_ms: np.ndarray,
                   bpm: float) -> list[Segment]:
    """부호가 같고 |offset| > T_onbeat 인 연속 온셋을 구간으로 묶는다."""
    if onsets_sec.size == 0 or onsets_sec.size != offsets_ms.size:
        return []

    t_on = T.t_onbeat_ms(bpm)
    segments: list[Segment] = []
    run_idx: list[int] = []
    run_sign = 0

    def flush() -> None:
        nonlocal run_idx, run_sign
        if len(run_idx) >= T.SEGMENT_MIN_ONSETS:
            vals = offsets_ms[run_idx]
            segments.append(Segment(
                start_sec=float(onsets_sec[run_idx[0]]),
                end_sec=float(onsets_sec[run_idx[-1]]),
                type="lag" if float(np.mean(vals)) > 0 else "rush",
                avg_offset_ms=float(np.mean(vals)),
                beat_offsets_ms=[float(v) for v in vals],
            ))
        run_idx = []
        run_sign = 0

    for i, off in enumerate(offsets_ms):
        if abs(off) <= t_on:
            flush()
            continue
        sign = 1 if off > 0 else -1
        if run_sign and sign != run_sign:
            flush()
        run_sign = sign
        run_idx.append(i)
    flush()
    return segments


def mark_break_ignored(segments: list[Segment], beat, speeds: np.ndarray,
                       fps: float) -> None:
    """rubric §3.2 — 브레이크 구간인데 활동량이 줄지 않은 구간을 break_ignored 로."""
    mask = beat.break_mask()
    if mask.size == 0 or speeds.size == 0:
        return
    for seg in segments:
        overlap = _break_overlap(seg, beat, mask)
        if overlap < T.BREAK_OVERLAP_RATIO:
            continue
        during = _slice_speed(speeds, fps, seg.start_sec, seg.end_sec)
        before = _slice_speed(speeds, fps, seg.start_sec - (seg.end_sec - seg.start_sec),
                              seg.start_sec)
        if during.size == 0 or before.size == 0:
            continue
        # 브레이크인데 직전 대비 활동량이 줄지 않았다 = 음악을 안 따라감
        if float(np.mean(during)) >= float(np.mean(before)) * 0.9:
            seg.type = "break_ignored"


def _break_overlap(seg: Segment, beat, mask: np.ndarray) -> float:
    """구간이 브레이크 마스크와 겹치는 비율."""
    times = beat.frame_times
    sel = (times >= seg.start_sec) & (times <= seg.end_sec)
    if not np.any(sel):
        return 0.0
    return float(np.mean(mask[sel]))


def _slice_speed(speeds: np.ndarray, fps: float, t0: float, t1: float) -> np.ndarray:
    i0 = max(0, int(round(t0 * fps)))
    i1 = min(speeds.size, int(round(t1 * fps)))
    return speeds[i0:i1] if i1 > i0 else np.zeros(0)


# ─────────────────────────────────────────────────────────────────
# context — rubric §3.3
# ─────────────────────────────────────────────────────────────────
def tag_context(segments: list[Segment], beat, turns_sec: np.ndarray) -> None:
    mask = beat.break_mask()
    chorus = beat.chorus_entry_times()

    for seg in segments:
        # 우선순위: post_turn > music_break > chorus_entry > general
        if turns_sec.size and np.any(
            (turns_sec <= seg.start_sec)
            & (turns_sec >= seg.start_sec - T.POST_TURN_WINDOW_SEC)
        ):
            seg.context = "post_turn"
            continue
        if mask.size and _break_overlap(seg, beat, mask) >= T.BREAK_OVERLAP_RATIO:
            seg.context = "music_break"
            continue
        if chorus.size and np.any(
            np.abs(chorus - seg.start_sec) <= T.CHORUS_ENTRY_WINDOW_SEC
        ):
            seg.context = "chorus_entry"
            continue
        seg.context = "general"


# ─────────────────────────────────────────────────────────────────
# 감점 트리거 — rubric §4
# ─────────────────────────────────────────────────────────────────
def apply_penalties(segments: list[Segment], bpm: float) -> None:
    """P-1 ~ P-4 를 판정해 penalty_codes 를 채운다.

    ⚠️ 점수를 차감하지 않는다. 표시용 플래그다.
    """
    t_minor = T.t_minor_ms(bpm)
    beat_ms = T.beat_interval_ms(bpm)

    for seg in segments:
        codes: list[str] = []

        # P-1 연속 오프비트: |offset| > T_minor 인 온셋 연속 4개 이상
        run = best = 0
        for v in seg.beat_offsets_ms:
            run = run + 1 if abs(v) > t_minor else 0
            best = max(best, run)
        if best >= T.PENALTY_P1_CONSECUTIVE:
            codes.append("P-1")

        # P-2 심한 이탈: 구간 평균 |offset| > 0.35 × 비트간격
        if abs(seg.avg_offset_ms) > T.PENALTY_P2_RATIO_OF_BEAT * beat_ms:
            codes.append("P-2")

        # P-3 브레이크 무시
        if seg.type == "break_ignored":
            codes.append("P-3")

        seg.penalty_codes = codes

    # P-4 반복 패턴: 동일 type 구간이 3회 이상이면 해당 type 전체에 부여
    for kind in ("lag", "rush", "break_ignored"):
        same = [s for s in segments if s.type == kind]
        if len(same) >= T.PENALTY_P4_REPEAT_COUNT:
            for s in same:
                if "P-4" not in s.penalty_codes:
                    s.penalty_codes.append("P-4")


# ─────────────────────────────────────────────────────────────────
# 통합
# ─────────────────────────────────────────────────────────────────
def analyze(metrics, series: PoseSeries, beat, leader_side: str = "") -> list[Segment]:
    """지표 + 포즈 + 비트 → 태깅 완료된 오프비트 구간 목록."""
    segments = build_segments(metrics.onsets_sec, metrics.offsets_ms, beat.bpm)
    if not segments:
        return []

    lead_idx = 1 if (series.persons == 2 and leader_side == "right") else 0
    speeds = metrics.speeds[lead_idx] if metrics.speeds else np.zeros(0)

    mark_break_ignored(segments, beat, speeds, series.fps)
    turns = turn_times([f[lead_idx] for f in series.landmarks], series.fps)
    tag_context(segments, beat, turns)
    apply_penalties(segments, beat.bpm)

    log.info(
        "segments: %d개 (감점 트리거 %d개, 턴 %d회)",
        len(segments), sum(1 for s in segments if s.penalty_trigger), turns.size,
    )
    return segments
