"""영상/오디오 입출력 — Storage 다운로드, 메타 조회, 오디오 추출, 키프레임.

ffmpeg 은 오디오 추출에만 쓴다. 영상 프레임 읽기와 메타 조회는 OpenCV 로 처리해
ffmpeg 미설치 상태에서도 포즈 추출까지는 동작하게 한다.
"""

from __future__ import annotations

import logging
import subprocess
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np

from . import thresholds as T
from .config import Config, get_config
from .errors import AudioExtractFailed, DurationExceeded

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class VideoMeta:
    path: Path
    duration_sec: float
    fps: float
    frame_count: int
    width: int
    height: int

    def as_json(self) -> dict:
        return {
            "duration_sec": round(self.duration_sec, 2),
            "fps": round(self.fps, 3),
            "width": self.width,
            "height": self.height,
        }


# ── Storage ──────────────────────────────────────────────────────
def download(storage_path: str, dest: Path, cfg: Config | None = None) -> Path:
    """Supabase Storage 의 객체를 로컬로 내려받는다.

    storage_path 는 버킷 기준 상대 경로: {user_id}/{job_id}/video.mp4
    """
    cfg = cfg or get_config()
    from supabase import create_client

    sb = create_client(cfg.supabase_url, cfg.service_role_key)
    data = sb.storage.from_(cfg.storage_bucket).download(storage_path)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    log.info("다운로드 %s → %s (%.1f MB)", storage_path, dest, len(data) / 1024 / 1024)
    return dest


def upload(local: Path, storage_path: str, content_type: str,
           cfg: Config | None = None) -> str:
    """로컬 파일을 Storage 에 올린다. 같은 경로가 있으면 덮어쓴다."""
    cfg = cfg or get_config()
    from supabase import create_client

    sb = create_client(cfg.supabase_url, cfg.service_role_key)
    sb.storage.from_(cfg.storage_bucket).upload(
        storage_path,
        local.read_bytes(),
        {"content-type": content_type, "upsert": "true"},
    )
    return storage_path


# ── 메타 ─────────────────────────────────────────────────────────
def probe(path: Path) -> VideoMeta:
    """영상 메타를 읽는다. 3분 초과면 DurationExceeded."""
    cap = cv2.VideoCapture(str(path))
    if not cap.isOpened():
        raise ValueError(f"영상을 열 수 없습니다: {path}")
    try:
        fps = float(cap.get(cv2.CAP_PROP_FPS)) or 0.0
        frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    finally:
        cap.release()

    if fps <= 0:
        raise ValueError(f"fps 를 읽지 못했습니다: {path}")
    duration = frames / fps if frames > 0 else 0.0
    if duration > T.MAX_DURATION_SEC:
        raise DurationExceeded(
            f"영상이 {duration:.0f}초입니다. {T.MAX_DURATION_SEC:.0f}초 이내로 잘라 주세요.",
            duration_sec=duration,
        )
    return VideoMeta(path, duration, fps, frames, width, height)


# ── 오디오 ───────────────────────────────────────────────────────
def extract_audio(video: Path, dest: Path, cfg: Config | None = None) -> Path:
    """영상의 오디오 트랙을 22.05kHz 모노 wav 로 뽑는다 (rubric 기준: 영상 트랙이 기본).

    오디오 스트림이 없으면 AudioExtractFailed → 웹앱이 원곡 업로드 폴백을 띄운다.
    """
    cfg = cfg or get_config()
    if not cfg.ffmpeg_path:
        raise AudioExtractFailed(
            "ffmpeg 이 설치되어 있지 않아 오디오를 추출할 수 없습니다.",
            reason="ffmpeg_missing",
        )

    dest.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        cfg.ffmpeg_path, "-y", "-loglevel", "error",
        "-i", str(video),
        "-vn",                 # 비디오 스트림 제외
        "-ac", "1",            # 모노
        "-ar", "22050",        # librosa 기본 sr
        "-f", "wav", str(dest),
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0 or not dest.exists() or dest.stat().st_size == 0:
        stderr = (proc.stderr or "").strip()
        # ffmpeg 은 오디오 스트림이 없으면 "Output file does not contain any stream" 류를 낸다
        reason = "no_audio_stream" if "does not contain any stream" in stderr else "ffmpeg_failed"
        raise AudioExtractFailed(
            "영상에서 음악을 추출하지 못했습니다.", reason=reason, stderr=stderr[:500]
        )
    return dest


# ── 프레임 ───────────────────────────────────────────────────────
def iter_frames(path: Path):
    """(frame_index, timestamp_ms, BGR ndarray) 를 순차적으로 내보낸다."""
    cap = cv2.VideoCapture(str(path))
    if not cap.isOpened():
        raise ValueError(f"영상을 열 수 없습니다: {path}")
    fps = float(cap.get(cv2.CAP_PROP_FPS)) or 30.0
    try:
        idx = 0
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            yield idx, int(idx * 1000.0 / fps), frame
            idx += 1
    finally:
        cap.release()


def first_frame(path: Path) -> np.ndarray | None:
    """사전 품질 체크(화각)용 첫 프레임."""
    for _, _, frame in iter_frames(path):
        return frame
    return None


def extract_keyframes(video: Path, times_sec: list[float], out_dir: Path) -> list[Path]:
    """지정 시각의 프레임을 jpg 로 저장한다.

    Claude vision 비용을 억제하기 위해 장변을 KEYFRAME_LONG_EDGE_PX 로 줄인다.
    """
    out_dir.mkdir(parents=True, exist_ok=True)
    cap = cv2.VideoCapture(str(video))
    if not cap.isOpened():
        raise ValueError(f"영상을 열 수 없습니다: {video}")

    saved: list[Path] = []
    try:
        for i, t in enumerate(times_sec):
            cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000.0)
            ok, frame = cap.read()
            if not ok:
                log.warning("키프레임 추출 실패: t=%.2fs", t)
                continue
            frame = _downscale(frame, T.KEYFRAME_LONG_EDGE_PX)
            path = out_dir / f"{i:02d}.jpg"
            cv2.imwrite(str(path), frame, [int(cv2.IMWRITE_JPEG_QUALITY), 88])
            saved.append(path)
    finally:
        cap.release()
    return saved


def _downscale(frame: np.ndarray, long_edge: int) -> np.ndarray:
    h, w = frame.shape[:2]
    cur = max(h, w)
    if cur <= long_edge:
        return frame
    scale = long_edge / cur
    return cv2.resize(
        frame, (int(round(w * scale)), int(round(h * scale))), interpolation=cv2.INTER_AREA
    )
