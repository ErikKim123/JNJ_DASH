"""작업 큐 — ai_judge.jobs 폴링 및 상태 전이.

설계 데비에이션 D-1 (design §2.3):
  워커는 supabase-py 가 아니라 psycopg 로 Postgres 에 직접 접속한다.
    · PostgREST 의 "Exposed schemas" 설정(대시보드 수동 작업)에 의존하지 않는다.
    · FOR UPDATE SKIP LOCKED 기반 claim 을 그대로 쓸 수 있다.
  Storage(영상 다운로드/키프레임 업로드)는 계속 Supabase SDK 를 쓴다.

큐 규칙:
  · claim 은 ai_judge.claim_job(worker_id) 이 원자적으로 수행한다(중복 처리 불가).
  · 워커가 죽어 중간 상태로 남은 잡은 기동 시 requeue_stale_jobs() 로 회수한다.
  · attempts >= 3 인 잡은 자동 회수하지 않는다(무한 재시도 방지).
"""

from __future__ import annotations

import logging
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Iterator

import psycopg
from psycopg.rows import dict_row

from .config import Config, get_config
from .errors import NON_FATAL_CODES, WorkerError

log = logging.getLogger(__name__)

#: jobs.status 진행 순서. 분석 대기 화면(스펙 4.2)의 5단계와 대응한다.
STAGE_ORDER = ("queued", "pose", "beat", "comment", "done")


@dataclass(frozen=True)
class Job:
    id: str
    user_id: str
    video_path: str
    audio_path: str
    role: str
    status: str
    leader_side: str
    song_title: str
    contest_id: str | None
    attempts: int
    created_at: datetime

    @property
    def is_couple(self) -> bool:
        return self.role == "couple"

    @classmethod
    def from_row(cls, row: dict[str, Any]) -> "Job":
        return cls(
            id=str(row["id"]),
            user_id=str(row["user_id"]),
            video_path=row["video_path"],
            audio_path=row["audio_path"],
            role=row["role"],
            status=row["status"],
            leader_side=row["leader_side"],
            song_title=row["song_title"],
            contest_id=row["contest_id"],
            attempts=row["attempts"],
            created_at=row["created_at"],
        )


class JobQueue:
    """ai_judge.jobs 에 대한 얇은 래퍼."""

    def __init__(self, cfg: Config | None = None):
        self.cfg = cfg or get_config()

    @contextmanager
    def _conn(self) -> Iterator[psycopg.Connection]:
        with psycopg.connect(self.cfg.dsn, row_factory=dict_row, autocommit=True) as conn:
            yield conn

    # ── 기동 ─────────────────────────────────────────────────────
    def requeue_stale(self) -> int:
        """중간 상태로 방치된 잡을 queued 로 되돌린다. 회수 건수를 반환."""
        interval = f"{self.cfg.stale_after_minutes} minutes"
        with self._conn() as conn:
            row = conn.execute(
                "select ai_judge.requeue_stale_jobs(%s::interval) as n", (interval,)
            ).fetchone()
        n = int(row["n"])
        if n:
            log.info("stale 잡 %d건을 큐로 회수했습니다 (%s 이상 방치)", n, interval)
        return n

    # ── claim ────────────────────────────────────────────────────
    def claim(self) -> Job | None:
        """대기 잡 1건을 원자적으로 가져온다. 없으면 None.

        반환 시 status 는 이미 'pose' 이고 claimed_by/attempts 가 갱신돼 있다.
        """
        with self._conn() as conn:
            row = conn.execute(
                "select * from ai_judge.claim_job(%s)", (self.cfg.worker_id,)
            ).fetchone()
        if row is None:
            return None
        job = Job.from_row(row)
        log.info("claim job=%s role=%s attempts=%d", job.id[:8], job.role, job.attempts)
        return job

    # ── 상태 전이 ─────────────────────────────────────────────────
    def set_status(self, job_id: str, status: str) -> None:
        """진행 상태를 갱신한다(pose → beat → comment)."""
        if status not in STAGE_ORDER and status != "failed":
            raise ValueError(f"unknown status: {status}")
        with self._conn() as conn:
            conn.execute(
                "update ai_judge.jobs set status = %s::ai_judge.job_status, updated_at = now() "
                "where id = %s",
                (status, job_id),
            )
        log.info("job=%s → %s", job_id[:8], status)

    def mark_done(self, job_id: str) -> None:
        with self._conn() as conn:
            conn.execute(
                "update ai_judge.jobs set status='done', error_code='', error_message='', "
                "finished_at = now(), updated_at = now() where id = %s",
                (job_id,),
            )
        log.info("job=%s → done", job_id[:8])

    def mark_failed(self, job_id: str, err: WorkerError | Exception) -> None:
        """실패 기록.

        CommentRefused/CommentFailed 처럼 지표가 이미 산출된 경우는
        파이프라인이 mark_done 을 부르므로 여기로 오지 않는다(NON_FATAL_CODES).
        """
        code = getattr(err, "code", "INTERNAL")
        if code in NON_FATAL_CODES:
            raise AssertionError(
                f"{code} 는 잡을 실패시키지 않습니다. 리포트를 저장하고 mark_done 을 호출하세요."
            )
        message = str(getattr(err, "message", err))[:2000]
        with self._conn() as conn:
            conn.execute(
                "update ai_judge.jobs set status='failed', error_code=%s, error_message=%s, "
                "finished_at = now(), updated_at = now() where id = %s",
                (code, message, job_id),
            )
        log.warning("job=%s → failed (%s) %s", job_id[:8], code, message)

    def requeue_for_song(self, job_id: str) -> None:
        """오디오 추출 실패 → 사용자가 원곡을 올리면 웹앱이 다시 queued 로 돌린다.

        워커는 실패로 기록만 하고(AUDIO_EXTRACT_FAILED) 큐 복귀는 웹앱이 담당한다.
        이 메서드는 CLI 재현용이다.
        """
        with self._conn() as conn:
            conn.execute(
                "update ai_judge.jobs set status='queued', error_code='', error_message='', "
                "claimed_by='', claimed_at=null, updated_at = now() where id = %s",
                (job_id,),
            )

    # ── 리포트 저장 ───────────────────────────────────────────────
    def save_report(self, job: Job, *, onbeat_ratio: float, confidence: str,
                    low_reasons: list[str], metrics_json: dict,
                    comments_json: dict | None = None,
                    sync_index: float | None = None,
                    activity_index: float | None = None,
                    model: str = "", usage_json: dict | None = None,
                    rubric_version: str = "") -> str:
        """reports 에 결과를 쓴다. job 당 1건(unique)이므로 재실행 시 갱신한다.

        ⚠️ 점수형 인자는 onbeat_ratio 하나뿐이다(절대 원칙 1).
           sync_index / activity_index 는 참고 지표이며 NULL 을 허용한다.
        """
        import json as _json

        with self._conn() as conn:
            row = conn.execute(
                """
                insert into ai_judge.reports
                  (job_id, user_id, onbeat_ratio, sync_index, activity_index,
                   confidence, low_reasons, metrics_json, comments_json,
                   model, usage_json, rubric_version)
                values (%s,%s,%s,%s,%s,%s,%s,%s::jsonb,%s::jsonb,%s,%s::jsonb,%s)
                on conflict (job_id) do update set
                  onbeat_ratio   = excluded.onbeat_ratio,
                  sync_index     = excluded.sync_index,
                  activity_index = excluded.activity_index,
                  confidence     = excluded.confidence,
                  low_reasons    = excluded.low_reasons,
                  metrics_json   = excluded.metrics_json,
                  comments_json  = excluded.comments_json,
                  model          = excluded.model,
                  usage_json     = excluded.usage_json,
                  rubric_version = excluded.rubric_version
                returning id
                """,
                (
                    job.id, job.user_id, round(float(onbeat_ratio), 2),
                    None if sync_index is None else round(float(sync_index), 2),
                    None if activity_index is None else round(float(activity_index), 2),
                    confidence, low_reasons,
                    _json.dumps(metrics_json, ensure_ascii=False),
                    _json.dumps(comments_json or {}, ensure_ascii=False),
                    model, _json.dumps(usage_json or {}, ensure_ascii=False),
                    rubric_version,
                ),
            ).fetchone()
        report_id = str(row["id"])
        log.info("report 저장 job=%s report=%s confidence=%s",
                 job.id[:8], report_id[:8], confidence)
        return report_id

    # ── 조회 ─────────────────────────────────────────────────────
    def user_email(self, user_id: str) -> str:
        """알림 발송용. auth.users 가 원본이다."""
        with self._conn() as conn:
            row = conn.execute(
                "select coalesce(email,'') as email from auth.users where id = %s",
                (user_id,),
            ).fetchone()
        return row["email"] if row else ""

    def get(self, job_id: str) -> Job | None:
        with self._conn() as conn:
            row = conn.execute(
                "select * from ai_judge.jobs where id = %s", (job_id,)
            ).fetchone()
        return Job.from_row(row) if row else None

    def counts_by_status(self) -> dict[str, int]:
        with self._conn() as conn:
            rows = conn.execute(
                "select status::text as status, count(*)::int as n "
                "from ai_judge.jobs group by 1 order by 1"
            ).fetchall()
        return {r["status"]: r["n"] for r in rows}
