"""단건 분석 CLI — 사이클 1 완료 기준의 검증 도구.

로컬 영상 1개를 넣어 reports JSON 이 정상 산출되는지 확인한다. UI 불필요.

사용:
    python -m worker.cli --video worker/samples/solo_ok.mp4 --role leader
    python -m worker.cli --video worker/samples/couple_ok.mp4 --role couple --leader-side left
    python -m worker.cli --video ... --save --user-id <uuid>    # DB 에도 기록

--save 없이는 DB 에 쓰지 않고 worker/out/<이름>.json 으로만 떨어뜨린다.
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

from .config import WORKER_DIR, get_config
from .errors import WorkerError
from .pipeline import run
from .queue import Job, JobQueue


def _force_utf8() -> None:
    for s in (sys.stdout, sys.stderr):
        try:
            s.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, OSError):
            pass


def _fake_job(video: Path, role: str, leader_side: str, user_id: str) -> Job:
    """DB 없이 파이프라인을 돌리기 위한 임시 Job."""
    return Job(
        id=str(uuid.uuid4()),
        user_id=user_id or str(uuid.UUID(int=0)),
        video_path=str(video),
        audio_path="",
        role=role,
        status="pose",
        leader_side=leader_side,
        song_title="",
        contest_id=None,
        attempts=1,
        created_at=datetime.now(timezone.utc),
    )


def main(argv: list[str] | None = None) -> int:
    _force_utf8()
    p = argparse.ArgumentParser(description="AI Judge 단건 분석")
    p.add_argument("--video", required=True, type=Path)
    p.add_argument("--role", default="leader", choices=["leader", "follower", "couple"])
    p.add_argument("--leader-side", default="", choices=["", "left", "right"])
    p.add_argument("--song", default="", help="원곡 파일 경로 (오디오 추출 실패 시)")
    p.add_argument("--save", action="store_true", help="DB(reports)에도 기록")
    p.add_argument("--user-id", default="", help="--save 시 필요한 auth.users UUID")
    p.add_argument("-v", "--verbose", action="store_true")
    args = p.parse_args(argv)

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
        stream=sys.stdout,
    )

    if not args.video.exists():
        print(f"✗ 영상을 찾을 수 없습니다: {args.video}")
        return 2
    if args.role == "couple" and not args.leader_side:
        print("✗ role=couple 이면 --leader-side left|right 가 필요합니다.")
        return 2
    if args.save and not args.user_id:
        print("✗ --save 에는 --user-id 가 필요합니다 (auth.users UUID).")
        return 2

    cfg = get_config()
    job = _fake_job(args.video, args.role, args.leader_side, args.user_id)
    if args.song:
        job = Job(**{**job.__dict__, "audio_path": args.song})

    try:
        result = run(job, queue=JobQueue(cfg) if args.save else None,
                     cfg=cfg, save=args.save)
    except WorkerError as e:
        print(f"\n✗ 실패 [{e.code}] {e.message}")
        if e.detail:
            print(f"  detail: {e.detail}")
        return 1

    # ── 결과 요약 ────────────────────────────────────────────────
    conf = result.confidence
    print("\n" + "=" * 62)
    print(f"  신뢰도       : {conf.level}" + (f"  {conf.reasons}" if conf.reasons else ""))
    if conf.is_low:
        print("  ⚠ 분석 불가 — 지표를 표시하지 않습니다 (rubric §6)")
    else:
        ref = result.metrics_json["reference"]
        print(f"  온비트율     : {result.onbeat_ratio:.1f}%   ← 유일한 점수")
        print(f"  파트너 싱크로: {ref['sync_index']}   (참고 지표)")
        print(f"  음악 반응도  : {ref['activity_index']}   (참고 지표)")
        print(f"  오프비트 구간: {len(result.metrics_json['offbeat_segments'])}개")
        trig = [s for s in result.metrics_json["offbeat_segments"] if s["penalty_trigger"]]
        print(f"  감점 트리거  : {len(trig)}개 {[c for s in trig for c in s['penalty_codes']]}")
        print(f"  코멘트       : {'생성됨' if result.comments_json else '없음'}")
    if result.report_id:
        print(f"  report_id    : {result.report_id}")
    print("=" * 62)

    out_dir = WORKER_DIR / "out"
    out_dir.mkdir(parents=True, exist_ok=True)
    out = out_dir / f"{args.video.stem}.json"
    out.write_text(
        json.dumps(
            {"confidence": conf.level, "low_reasons": conf.reasons,
             "onbeat_ratio": result.onbeat_ratio,
             "metrics_json": result.metrics_json,
             "comments_json": result.comments_json,
             "usage_json": result.usage_json},
            ensure_ascii=False, indent=2,
        ),
        encoding="utf-8",
    )
    print(f"  → {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
