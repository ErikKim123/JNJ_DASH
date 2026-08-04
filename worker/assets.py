"""분석 모델 자산 확보.

MediaPipe 1.0.0 은 레거시 `mp.solutions` 를 제거했고 Tasks API 만 제공한다.
Tasks API 는 `.task` 모델 파일을 요구하는데 패키지에 번들되어 있지 않으므로
최초 1회 Google 공식 CDN 에서 받아 worker/models/ 에 캐시한다.

오프라인 환경에서는 파일을 직접 넣어두거나 AI_JUDGE_POSE_MODEL 로 경로를 지정한다.
"""

from __future__ import annotations

import logging
import os
import urllib.request
from pathlib import Path

from .config import WORKER_DIR

log = logging.getLogger(__name__)

MODELS_DIR = WORKER_DIR / "models"

#: MediaPipe 공식 배포 URL (float16). lite < full < heavy 순으로 정확도/비용 증가.
POSE_MODEL_URLS = {
    "lite": "https://storage.googleapis.com/mediapipe-models/pose_landmarker/"
            "pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
    "full": "https://storage.googleapis.com/mediapipe-models/pose_landmarker/"
            "pose_landmarker_full/float16/1/pose_landmarker_full.task",
    "heavy": "https://storage.googleapis.com/mediapipe-models/pose_landmarker/"
             "pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task",
}

#: 기본값. 댄스 영상은 팔다리가 빠르게 움직여 lite 는 놓치는 구간이 많고,
#: heavy 는 3분 영상 처리 시간이 과하다.
DEFAULT_POSE_VARIANT = "full"


def pose_model_path(variant: str | None = None, *, download: bool = True) -> Path:
    """포즈 모델 경로를 돌려준다. 없으면 내려받는다.

    우선순위: AI_JUDGE_POSE_MODEL(전체 경로) > worker/models/<variant>.task
    """
    explicit = os.environ.get("AI_JUDGE_POSE_MODEL", "").strip()
    if explicit:
        p = Path(explicit)
        if not p.exists():
            raise FileNotFoundError(f"AI_JUDGE_POSE_MODEL 경로에 파일이 없습니다: {p}")
        return p

    variant = variant or os.environ.get("AI_JUDGE_POSE_VARIANT", DEFAULT_POSE_VARIANT)
    if variant not in POSE_MODEL_URLS:
        raise ValueError(f"unknown pose variant: {variant} (가능: {list(POSE_MODEL_URLS)})")

    dest = MODELS_DIR / f"pose_landmarker_{variant}.task"
    if dest.exists() and dest.stat().st_size > 0:
        return dest

    if not download:
        raise FileNotFoundError(
            f"모델 파일이 없습니다: {dest}\n"
            f"  {POSE_MODEL_URLS[variant]} 에서 받아 위 경로에 두거나,\n"
            f"  AI_JUDGE_POSE_MODEL 환경변수로 경로를 지정하세요."
        )

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    url = POSE_MODEL_URLS[variant]
    tmp = dest.with_suffix(".task.part")
    log.info("포즈 모델 다운로드: %s → %s", url, dest)
    try:
        urllib.request.urlretrieve(url, tmp)  # noqa: S310 (고정 https URL)
        tmp.replace(dest)
    except Exception:
        tmp.unlink(missing_ok=True)
        raise
    log.info("포즈 모델 준비 완료 (%.1f MB)", dest.stat().st_size / 1024 / 1024)
    return dest
