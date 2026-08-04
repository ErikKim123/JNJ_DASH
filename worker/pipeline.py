"""분석 파이프라인 오케스트레이션 — design §7.1.

claim → 다운로드/메타 → 포즈 → 비트 → 지표 → 구간 태깅 → confidence
     → 키프레임 → 코멘트 → reports 저장 → 이메일

confidence='low' 이면 (rubric §6) 코멘트 생성과 키프레임 업로드를 건너뛴다.
어차피 화면에 지표를 표시하지 않으므로 Claude 비용을 쓸 이유가 없다.
"""

from __future__ import annotations

import json
import logging
import shutil
import tempfile
from dataclasses import dataclass
from pathlib import Path

import numpy as np

from . import beat as beat_mod
from . import comments as comments_mod
from . import media, metrics as metrics_mod, pose, segments as segments_mod
from . import thresholds as T
from .config import Config, get_config
from .confidence import Confidence, from_series
from .errors import AudioExtractFailed, CommentFailed, CommentRefused, WorkerError
from .notify import send_report_ready
from .queue import Job, JobQueue

log = logging.getLogger(__name__)


@dataclass
class Result:
    report_id: str | None
    confidence: Confidence
    onbeat_ratio: float
    metrics_json: dict
    comments_json: dict
    usage_json: dict


def build_metrics_json(meta: media.VideoMeta, series: pose.PoseSeries,
                       beat, m, segs, keyframes: list[dict],
                       track_path: str = "") -> dict:
    """design §3.4 스키마."""
    return {
        "schema_version": 1,
        "video": meta.as_json(),
        "audio": beat.as_json(),
        # track_path: 스켈레톤 오버레이용 랜드마크 트랙(Storage 상대 경로).
        # 용량 때문에 metrics_json 에 직접 담지 않는다.
        "pose": {**series.as_json(), "track_path": track_path},
        "timing": m.timing_json(),
        "reference": m.reference_json(),
        "offbeat_segments": [s.as_json() for s in segs],
        "keyframes": keyframes,
        "thresholds": {
            "onbeat_ms": round(T.t_onbeat_ms(beat.bpm), 1),
            "minor_ms": round(T.t_minor_ms(beat.bpm), 1),
            "rubric_version": T.RUBRIC_VERSION,
        },
    }


def pick_keyframe_times(segs, meta: media.VideoMeta) -> list[tuple[float, str]]:
    """Claude 에 보낼 키프레임 시각을 고른다 (6~10장).

    감점 트리거 구간을 우선하고, 모자라면 영상을 균등 분할해 채운다.
    """
    picks: list[tuple[float, str]] = []
    ordered = sorted(segs, key=lambda s: (not s.penalty_trigger, s.start_sec))
    for i, s in enumerate(ordered):
        if len(picks) >= T.KEYFRAME_MAX:
            break
        picks.append(((s.start_sec + s.end_sec) / 2.0, f"offbeat_segment_{i}"))

    if len(picks) < T.KEYFRAME_MIN and meta.duration_sec > 0:
        need = T.KEYFRAME_MIN - len(picks)
        step = meta.duration_sec / (need + 1)
        for k in range(1, need + 1):
            picks.append((step * k, "sampled"))

    picks.sort(key=lambda x: x[0])
    return picks[: T.KEYFRAME_MAX]


def run(job: Job, *, queue: JobQueue | None = None, cfg: Config | None = None,
        save: bool = True, workdir: Path | None = None) -> Result:
    """한 건을 끝까지 처리한다.

    save=False 면 DB 에 쓰지 않는다(CLI 검증용).
    """
    cfg = cfg or get_config()
    queue = queue or JobQueue(cfg)
    tmp = Path(workdir) if workdir else Path(tempfile.mkdtemp(prefix="ajudge_"))
    tmp.mkdir(parents=True, exist_ok=True)
    owns_tmp = workdir is None

    try:
        # ── 1. 영상 확보 + 메타 ──────────────────────────────────
        local_video = tmp / "video.mp4"
        if Path(job.video_path).exists():
            shutil.copy(job.video_path, local_video)   # CLI: 로컬 경로
        else:
            media.download(job.video_path, local_video, cfg)
        meta = media.probe(local_video)
        log.info("영상 %s %dx%d %.1ffps %.1fs",
                 local_video.name, meta.width, meta.height, meta.fps, meta.duration_sec)

        # ── 2. 포즈 ─────────────────────────────────────────────
        if save:
            queue.set_status(job.id, "pose")
        series = pose.extract(local_video, job.role, fps=meta.fps)

        # ── 3. 비트 ─────────────────────────────────────────────
        if save:
            queue.set_status(job.id, "beat")
        audio = tmp / "audio.wav"
        if job.audio_path:
            # 사용자가 올린 원곡 폴백
            media.download(job.audio_path, tmp / "song_src", cfg)
            beat_src = "uploaded_song"
            audio = media.extract_audio(tmp / "song_src", audio, cfg)
        else:
            beat_src = "video_track"
            audio = media.extract_audio(local_video, audio, cfg)
        beat = beat_mod.analyze(audio, source=beat_src)

        # ── 4. 지표 + 구간 ───────────────────────────────────────
        m = metrics_mod.compute(series, beat, job.leader_side)
        segs = segments_mod.analyze(m, series, beat, job.leader_side)

        # ── 5. confidence (절대 원칙 2) ─────────────────────────
        conf = from_series(series)
        log.info("confidence=%s reasons=%s", conf.level, conf.reasons)

        # ── 6. 키프레임 + 코멘트 ────────────────────────────────
        keyframe_meta: list[dict] = []
        comments: dict = {}
        usage: dict = {}
        track_path = ""

        if conf.is_low:
            log.info("confidence=low → 키프레임/코멘트/트랙 생략 (화면에 지표를 표시하지 않음)")
        else:
            if save:
                queue.set_status(job.id, "comment")

            # 스켈레톤 오버레이용 랜드마크 트랙
            track_file = tmp / "pose.json"
            track_file.write_text(
                json.dumps(series.track_payload(), ensure_ascii=False),
                encoding="utf-8",
            )
            track_path = f"{job.user_id}/{job.id}/pose.json"
            if save:
                media.upload(track_file, track_path, "application/json", cfg)
            log.info("포즈 트랙 %.1f KB", track_file.stat().st_size / 1024)

            picks = pick_keyframe_times(segs, meta)
            paths = media.extract_keyframes(local_video, [t for t, _ in picks], tmp / "frames")
            for (t, reason), p in zip(picks, paths):
                sp = f"{job.user_id}/{job.id}/frames/{p.name}"
                if save:
                    media.upload(p, sp, "image/jpeg", cfg)
                keyframe_meta.append({"t_sec": round(t, 2), "path": sp, "reason": reason})

            metrics_json_for_ai = build_metrics_json(
                meta, series, beat, m, segs, keyframe_meta, track_path
            )
            try:
                comments, usage = comments_mod.generate(metrics_json_for_ai, paths, cfg)
            except (CommentRefused, CommentFailed) as e:
                # 지표는 이미 산출됐다. 잡을 실패시키지 않는다.
                log.warning("코멘트 생략 (%s): %s", e.code, e.message)
                comments, usage = {}, {"error": e.code, "message": e.message}

        metrics_json = build_metrics_json(
            meta, series, beat, m, segs, keyframe_meta, track_path
        )

        # ── 7. 저장 + 알림 ──────────────────────────────────────
        report_id = None
        if save:
            report_id = queue.save_report(
                job,
                onbeat_ratio=m.onbeat_ratio,
                sync_index=m.sync_index,
                activity_index=m.activity_index,
                confidence=conf.level,
                low_reasons=conf.reasons,
                metrics_json=metrics_json,
                comments_json=comments,
                model=usage.get("model", ""),
                usage_json=usage,
                rubric_version=T.RUBRIC_VERSION,
            )
            queue.mark_done(job.id)
            send_report_ready(
                queue.user_email(job.user_id), report_id,
                confidence=conf.level, cfg=cfg,
            )

        return Result(report_id, conf, m.onbeat_ratio, metrics_json, comments, usage)

    finally:
        if owns_tmp:
            shutil.rmtree(tmp, ignore_errors=True)


def run_safely(job: Job, queue: JobQueue, cfg: Config | None = None) -> Result | None:
    """예외를 error_code 로 변환해 잡에 기록한다. 폴링 루프에서 쓴다."""
    try:
        return run(job, queue=queue, cfg=cfg, save=True)
    except AudioExtractFailed as e:
        # 사용자가 원곡을 올리면 웹앱이 다시 queued 로 돌린다.
        queue.mark_failed(job.id, e)
    except WorkerError as e:
        queue.mark_failed(job.id, e)
    except Exception as e:  # noqa: BLE001
        log.exception("예상치 못한 오류 job=%s", job.id[:8])
        queue.mark_failed(job.id, WorkerError(str(e)))
    return None
