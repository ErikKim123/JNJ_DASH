"""워커 환경설정.

우선순위: 실제 환경변수 > worker/.env > 저장소 루트 .env.local

루트 .env.local 을 그대로 재사용하므로(웹앱과 같은 Supabase 프로젝트),
로컬 개발에서는 별도 설정 없이 바로 동작한다.
"""

from __future__ import annotations

import os
import re
import shutil
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
WORKER_DIR = Path(__file__).resolve().parent

_ENV_LINE = re.compile(r"^\s*([A-Z0-9_]+)\s*=\s*(.*)$")
_PROJECT_REF = re.compile(r"^https?://([a-z0-9]{20,})\.supabase\.co", re.I)


def _load_env_file(path: Path) -> None:
    """dotenv 파일을 읽어 아직 없는 키만 os.environ 에 넣는다."""
    try:
        raw = path.read_text(encoding="utf-8-sig")  # BOM 방어
    except FileNotFoundError:
        return
    for line in raw.splitlines():
        m = _ENV_LINE.match(line)
        if not m:
            continue
        key, val = m.group(1), m.group(2).strip()
        if len(val) >= 2 and val[0] == val[-1] and val[0] in "\"'":
            val = val[1:-1]
        os.environ.setdefault(key, val)


def _resolve_ffmpeg() -> str:
    """ffmpeg 실행 파일 경로.

    우선순위: AI_JUDGE_FFMPEG > worker/bin/ffmpeg(.exe) > PATH
    시스템 드라이브에 설치할 수 없는 환경(용량 부족 등)을 위해
    worker/bin/ 에 압축을 풀어두기만 해도 동작하게 한다.
    """
    explicit = os.environ.get("AI_JUDGE_FFMPEG", "").strip()
    if explicit:
        return explicit
    bundled = WORKER_DIR / "bin" / ("ffmpeg.exe" if os.name == "nt" else "ffmpeg")
    if bundled.exists():
        return str(bundled)
    return shutil.which("ffmpeg") or ""


def _require(key: str) -> str:
    val = os.environ.get(key, "").strip()
    if not val:
        raise RuntimeError(
            f"환경변수 {key} 가 필요합니다. "
            f"worker/.env 또는 {REPO_ROOT / '.env.local'} 에 설정하세요."
        )
    return val


@dataclass(frozen=True)
class Config:
    supabase_url: str
    service_role_key: str
    db_password: str
    db_pooler_host: str
    project_ref: str

    anthropic_api_key: str
    resend_api_key: str

    #: 빈 문자열이면 미설치. S2(오디오 추출)부터 필요하다.
    ffmpeg_path: str

    worker_id: str
    poll_seconds: int
    stale_after_minutes: int

    storage_bucket: str = "ai-judge-media"

    @property
    def dsn(self) -> str:
        """psycopg 접속 문자열 (Supabase pooler, session mode).

        db:migrate 스크립트와 동일한 경로를 쓴다.
        """
        return (
            f"postgresql://postgres.{self.project_ref}:{self.db_password}"
            f"@{self.db_pooler_host}:5432/postgres?sslmode=require"
        )

    def masked_dsn(self) -> str:
        return (
            f"postgresql://postgres.{self.project_ref}:***"
            f"@{self.db_pooler_host}:5432/postgres"
        )


@lru_cache(maxsize=1)
def get_config() -> Config:
    _load_env_file(WORKER_DIR / ".env")
    _load_env_file(REPO_ROOT / ".env.local")

    url = _require("NEXT_PUBLIC_SUPABASE_URL")
    m = _PROJECT_REF.match(url)
    if not m:
        raise RuntimeError(f"Supabase URL 에서 project ref 추출 실패: {url}")

    return Config(
        supabase_url=url,
        service_role_key=_require("SUPABASE_SERVICE_ROLE_KEY"),
        db_password=_require("SUPABASE_DB_PASSWORD"),
        db_pooler_host=os.environ.get(
            "SUPABASE_DB_POOLER_HOST", "aws-0-ap-northeast-1.pooler.supabase.com"
        ),
        project_ref=m.group(1),
        # 코멘트/알림은 사이클 1 후반에 필요. 없어도 기동은 되게 둔다.
        anthropic_api_key=os.environ.get("ANTHROPIC_API_KEY", ""),
        resend_api_key=os.environ.get("RESEND_API_KEY", ""),
        ffmpeg_path=_resolve_ffmpeg(),
        worker_id=os.environ.get("AI_JUDGE_WORKER_ID", f"worker-{os.getpid()}"),
        poll_seconds=int(os.environ.get("AI_JUDGE_POLL_SECONDS", "10")),
        stale_after_minutes=int(os.environ.get("AI_JUDGE_STALE_MINUTES", "30")),
    )
