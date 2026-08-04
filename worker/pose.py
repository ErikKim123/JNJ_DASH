"""포즈 추출 — MediaPipe Tasks PoseLandmarker.

커플 모드(num_poses=2)는 MediaPipe 가 프레임 간 인물 순서를 보장하지 않으므로
워커가 직접 트래킹(슬롯 배정)을 하고, 배정이 모호한 구간을 ID 스위칭으로 감지한다.
ID 스위칭이 감지되면 confidence=low 가 되어 싱크로 지표를 내보내지 않는다(rubric §6).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np

from . import thresholds as T
from .assets import pose_model_path
from .errors import PersonCountMismatch, PoseExtractFailed
from .media import iter_frames

log = logging.getLogger(__name__)

# MediaPipe Pose 33 랜드마크 인덱스
NOSE = 0
L_SHOULDER, R_SHOULDER = 11, 12
L_WRIST, R_WRIST = 15, 16
L_HIP, R_HIP = 23, 24
L_KNEE, R_KNEE = 25, 26
L_ANKLE, R_ANKLE = 27, 28

#: 전신 판정에 쓰는 랜드마크. 하나라도 화면 밖/미검출이면 그 프레임은 전신 이탈.
FULL_BODY_LANDMARKS = (NOSE, L_SHOULDER, R_SHOULDER, L_HIP, R_HIP, L_ANKLE, R_ANKLE)
#: 동작 온셋 계산에 쓰는 관절 (사지 + 골반)
MOTION_LANDMARKS = (L_WRIST, R_WRIST, L_ANKLE, R_ANKLE, L_HIP, R_HIP)


@dataclass
class PoseSeries:
    """프레임별 포즈 시계열.

    landmarks[t][p] : (33, 4) float32 [x, y, z, visibility] 또는 None(미검출).
    x, y 는 0~1 정규화 좌표 (화면 밖이면 범위를 벗어난다).
    """

    fps: float
    persons: int
    landmarks: list[list[np.ndarray | None]] = field(default_factory=list)
    success_ratio: float = 0.0
    out_of_frame_ratio: float = 0.0
    id_switch_detected: bool = False

    @property
    def frame_count(self) -> int:
        return len(self.landmarks)

    def timestamps_sec(self) -> np.ndarray:
        return np.arange(self.frame_count, dtype=np.float64) / self.fps

    def as_json(self) -> dict:
        return {
            "success_ratio": round(self.success_ratio, 4),
            "out_of_frame_ratio": round(self.out_of_frame_ratio, 4),
            "id_switch_detected": self.id_switch_detected,
            "persons": self.persons,
        }

    def track_payload(self, target_fps: float = 10.0) -> dict:
        """리포트 화면의 스켈레톤 오버레이용 랜드마크 트랙.

        전 프레임(3분 30fps = 5400프레임 × 33개)을 그대로 담으면 수 MB 가 되므로
        10fps 로 솎고 x/y 만 소수 3자리로 남긴다. 오버레이는 이 정도면 충분하다.
        metrics_json 에 넣지 않고 Storage 에 별도 파일로 올린다(jsonb 비대화 방지).
        """
        step = max(1, int(round(self.fps / target_fps)))
        frames: list[list[list[list[float]] | None]] = []
        for i in range(0, self.frame_count, step):
            people = self.landmarks[i]
            frames.append([
                None if lm is None
                else [[round(float(p[0]), 3), round(float(p[1]), 3)] for p in lm]
                for lm in people
            ])
        return {
            "schema_version": 1,
            "fps": round(self.fps / step, 3),
            "persons": self.persons,
            "frames": frames,
        }


# ── 판정 헬퍼 (순수 함수 — 테스트 대상) ─────────────────────────────
def is_full_body_visible(lm: np.ndarray | None) -> bool:
    """전신이 화면 안에 잡혔는지. 하나라도 화면 밖/저신뢰면 False."""
    if lm is None:
        return False
    pts = lm[list(FULL_BODY_LANDMARKS)]
    if np.any(pts[:, 3] < T.LANDMARK_VISIBILITY_MIN):
        return False
    xy = pts[:, :2]
    return bool(np.all((xy >= 0.0) & (xy <= 1.0)))


def hip_center(lm: np.ndarray) -> np.ndarray:
    """골반 중심 (x, y). 인물 매칭의 기준점."""
    return (lm[L_HIP, :2] + lm[R_HIP, :2]) / 2.0


def torso_size(lm: np.ndarray) -> float:
    """어깨 중심 ~ 골반 중심 거리. 매칭 임계값의 스케일 기준."""
    sh = (lm[L_SHOULDER, :2] + lm[R_SHOULDER, :2]) / 2.0
    return float(np.linalg.norm(sh - hip_center(lm)))


def assign_two(prev: list[np.ndarray | None],
               cur: list[np.ndarray]) -> tuple[list[np.ndarray], float, float]:
    """2인 슬롯 배정.

    Returns:
        (재정렬된 cur, 항등 배정 비용, 교차 배정 비용)
        비용은 골반 중심 유클리드 거리의 합. prev 가 비어 있으면 항등.
    """
    if len(cur) != 2 or prev[0] is None or prev[1] is None:
        return cur, 0.0, 0.0

    p0, p1 = hip_center(prev[0]), hip_center(prev[1])
    c0, c1 = hip_center(cur[0]), hip_center(cur[1])

    cost_identity = float(np.linalg.norm(p0 - c0) + np.linalg.norm(p1 - c1))
    cost_swap = float(np.linalg.norm(p0 - c1) + np.linalg.norm(p1 - c0))

    if cost_swap < cost_identity:
        return [cur[1], cur[0]], cost_identity, cost_swap
    return cur, cost_identity, cost_swap


def is_ambiguous(cost_identity: float, cost_swap: float, scale: float) -> bool:
    """두 배정의 비용 차가 작으면(=두 사람이 겹치면) 추적이 신뢰할 수 없다.

    scale 은 상체 길이. 사람 크기 대비 상대 판정을 한다.
    """
    if scale <= 1e-6:
        return True
    diff = abs(cost_identity - cost_swap)
    best = min(cost_identity, cost_swap)
    # 두 배정이 비슷하거나(구분 불가), 최선 배정조차 상체 길이만큼 튀었으면 모호.
    return (diff / scale) < 0.35 or (best / scale) > 1.5


# ── 추출 ─────────────────────────────────────────────────────────
def extract(video: Path, role: str, *, fps: float | None = None,
            progress_every: int = 300) -> PoseSeries:
    """영상 전체에서 포즈 시계열을 뽑는다.

    role='couple' 이면 2인, 그 외 1인.
    fps 를 주지 않으면 영상 메타에서 읽는다.
    """
    import mediapipe as mp
    from mediapipe.tasks.python import BaseOptions
    from mediapipe.tasks.python.vision import (
        PoseLandmarker,
        PoseLandmarkerOptions,
        RunningMode,
    )

    if fps is None:
        from .media import probe

        fps = probe(video).fps

    n_persons = 2 if role == "couple" else 1
    options = PoseLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=str(pose_model_path())),
        running_mode=RunningMode.VIDEO,
        num_poses=n_persons,
        min_pose_detection_confidence=0.5,
        min_pose_presence_confidence=0.5,
        min_tracking_confidence=0.5,
        output_segmentation_masks=False,
    )

    series = PoseSeries(fps=fps, persons=n_persons)
    detected_frames = 0
    out_of_frame_frames = 0
    ambiguous_run = 0
    prev: list[np.ndarray | None] = [None] * n_persons
    total = 0

    with PoseLandmarker.create_from_options(options) as landmarker:
        for idx, ts_ms, frame_bgr in iter_frames(video):
            total = idx + 1
            rgb = frame_bgr[:, :, ::-1]  # BGR → RGB
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(rgb))
            result = landmarker.detect_for_video(mp_image, ts_ms)

            people = _to_arrays(result)
            if len(people) < n_persons:
                # 필요한 인원을 못 찾은 프레임 — 미검출로 기록.
                # prev 는 유지한다(재검출 시 마지막 위치와 매칭해야 슬롯이 안 뒤집힌다).
                series.landmarks.append([None] * n_persons)
                if progress_every and idx % progress_every == 0:
                    log.info("pose %d프레임 처리 (검출 %d)", total, detected_frames)
                continue

            people = people[:n_persons]
            if n_persons == 2:
                people, c_id, c_sw = assign_two(prev, people)
                scale = max(torso_size(people[0]), torso_size(people[1]))
                if prev[0] is not None and is_ambiguous(c_id, c_sw, scale):
                    ambiguous_run += 1
                    if ambiguous_run >= 3:
                        series.id_switch_detected = True
                else:
                    ambiguous_run = 0

            series.landmarks.append(list(people))
            prev = list(people)
            detected_frames += 1
            if not all(is_full_body_visible(p) for p in people):
                out_of_frame_frames += 1

            if progress_every and idx % progress_every == 0:
                log.info("pose %d프레임 처리 (검출 %d)", total, detected_frames)

    if total == 0:
        raise PoseExtractFailed("영상에서 프레임을 읽지 못했습니다.")

    series.success_ratio = detected_frames / total
    series.out_of_frame_ratio = out_of_frame_frames / total

    if series.success_ratio < T.POSE_HARD_FAIL_RATIO:
        raise PoseExtractFailed(
            "영상에서 사람을 거의 인식하지 못했습니다. 밝은 곳에서 전신이 나오게 다시 촬영해 주세요.",
            success_ratio=series.success_ratio,
        )
    if n_persons == 2 and detected_frames == 0:
        raise PersonCountMismatch("커플 모드인데 두 사람을 찾지 못했습니다.")

    log.info(
        "pose 완료: %d프레임, 검출률 %.1f%%, 전신이탈 %.1f%%, ID스위칭=%s",
        total, series.success_ratio * 100, series.out_of_frame_ratio * 100,
        series.id_switch_detected,
    )
    return series


def _to_arrays(result) -> list[np.ndarray]:
    """PoseLandmarkerResult → [(33,4) ndarray, ...]"""
    out: list[np.ndarray] = []
    for person in (result.pose_landmarks or []):
        arr = np.array(
            [[lm.x, lm.y, lm.z, getattr(lm, "visibility", 1.0)] for lm in person],
            dtype=np.float32,
        )
        out.append(arr)
    return out
