"""상시 폴링 워커.

ai_judge.jobs 를 AI_JUDGE_POLL_SECONDS(기본 10초) 간격으로 확인한다.
메시지큐는 쓰지 않는다 — 일 수십 건 규모에 과설계다(스펙 6장).

사용:
    python -m worker.main
"""

from __future__ import annotations

import logging
import signal
import sys
import time

from .config import get_config
from .pipeline import run_safely
from .queue import JobQueue

log = logging.getLogger("worker.main")

_stop = False


def _handle_signal(signum, _frame):
    global _stop
    log.info("종료 신호 수신(%s) — 현재 잡을 마치고 멈춥니다", signum)
    _stop = True


def main() -> int:
    for s in (sys.stdout, sys.stderr):
        try:
            s.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, OSError):
            pass

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
        stream=sys.stdout,
    )
    signal.signal(signal.SIGINT, _handle_signal)
    signal.signal(signal.SIGTERM, _handle_signal)

    cfg = get_config()
    queue = JobQueue(cfg)
    log.info("워커 기동: id=%s poll=%ds", cfg.worker_id, cfg.poll_seconds)

    # 이전 실행이 비정상 종료돼 중간 상태로 남은 잡을 회수한다.
    queue.requeue_stale()

    idle_logged = False
    while not _stop:
        try:
            job = queue.claim()
        except Exception:  # noqa: BLE001 — DB 일시 장애로 워커가 죽으면 안 된다
            log.exception("claim 실패 — %ds 후 재시도", cfg.poll_seconds)
            time.sleep(cfg.poll_seconds)
            continue

        if job is None:
            if not idle_logged:
                log.info("대기 중…")
                idle_logged = True
            time.sleep(cfg.poll_seconds)
            continue

        idle_logged = False
        started = time.monotonic()
        result = run_safely(job, queue, cfg)
        elapsed = time.monotonic() - started
        if result:
            log.info("완료 job=%s report=%s confidence=%s (%.1fs)",
                     job.id[:8], (result.report_id or "")[:8],
                     result.confidence.level, elapsed)
        else:
            log.info("실패 job=%s (%.1fs)", job.id[:8], elapsed)

    log.info("워커 종료")
    return 0


if __name__ == "__main__":
    sys.exit(main())
