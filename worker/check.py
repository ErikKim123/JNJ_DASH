"""기동 점검 — 환경변수 / DB 연결 / claim_job / Storage / ffmpeg.

사용:
    python -m worker.check

S1(사이클1 세션1) 완료 게이트. 실 데이터를 만들지 않는다.
"""

from __future__ import annotations


import subprocess
import sys

from .config import get_config
from .queue import JobQueue
from . import thresholds as T

OK, NG = "  ✓", "  ✗"


def _force_utf8_stdout() -> None:
    """Windows 기본 콘솔은 cp949 라 ✓/— 출력에서 UnicodeEncodeError 가 난다.

    한글 로그도 깨지므로 stdout/stderr 를 UTF-8 로 고정한다.
    """
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, OSError):  # 파이프/리다이렉트 등
            pass


def main() -> int:
    _force_utf8_stdout()
    failures = 0

    def check(label: str, cond: bool, extra: str = "") -> None:
        nonlocal failures
        print(f"{OK if cond else NG} {label}" + (f" — {extra}" if extra else ""))
        if not cond:
            failures += 1

    print("▶ 1. 환경설정")
    try:
        cfg = get_config()
    except RuntimeError as e:
        print(f"{NG} config — {e}")
        return 1
    check("Supabase URL", bool(cfg.supabase_url), cfg.supabase_url)
    check("DB 접속 문자열", bool(cfg.db_password), cfg.masked_dsn())
    check("service_role 키", len(cfg.service_role_key) > 20)
    check("worker_id", bool(cfg.worker_id), cfg.worker_id)
    # 아래 둘은 사이클1 후반(코멘트/알림)에 필요. 없어도 기동은 된다.
    print(f"    ANTHROPIC_API_KEY: {'있음' if cfg.anthropic_api_key else '없음 (코멘트 생성 단계에서 필요)'}")
    print(f"    RESEND_API_KEY   : {'있음' if cfg.resend_api_key else '없음 (이메일 알림 단계에서 필요)'}")

    print("▶ 2. rubric 임계값 (docs/rubric.md v%s)" % T.RUBRIC_VERSION)
    check("rubric 버전", T.RUBRIC_VERSION == "1.0", T.RUBRIC_VERSION)
    for bpm in (80, 96, 120, 140):
        print(
            f"    {bpm:>3} BPM → 비트간격 {T.beat_interval_ms(bpm):6.1f}ms  "
            f"온비트 ≤{T.t_onbeat_ms(bpm):5.1f}ms  경미 ≤{T.t_minor_ms(bpm):5.1f}ms"
        )
    # rubric §2.2 표와 대조 (반올림하지 않은 정확값)
    check("96 BPM 임계값", T.t_onbeat_ms(96) == 62.5 and T.t_minor_ms(96) == 125.0)
    check("140 BPM 절대하한 적용", T.t_onbeat_ms(140) == 50.0 and T.t_minor_ms(140) == 100.0)
    check("코멘트 톤(등급 아님)", T.comment_tone(95) == "maintain" and T.comment_tone(50) == "foundation")

    print("▶ 3. DB 연결 / 큐")
    q = JobQueue(cfg)
    try:
        counts = q.counts_by_status()
        check("ai_judge.jobs 조회", True, f"현재 {counts or '비어 있음'}")
    except Exception as e:  # noqa: BLE001
        check("ai_judge.jobs 조회", False, str(e))
        return 1

    try:
        n = q.requeue_stale()
        check("requeue_stale_jobs 호출", True, f"{n}건 회수")
    except Exception as e:  # noqa: BLE001
        check("requeue_stale_jobs 호출", False, str(e))

    try:
        job = q.claim()
        if job is None:
            check("claim_job 호출", True, "빈 큐 → None (정상)")
        else:
            check("claim_job 호출", True, f"job={job.id[:8]} role={job.role}")
            # 점검이므로 즉시 큐로 되돌린다.
            q.requeue_for_song(job.id)
            print("      (점검용 claim 이므로 큐로 반환했습니다)")
    except Exception as e:  # noqa: BLE001
        check("claim_job 호출", False, str(e))

    print("▶ 4. Storage")
    try:
        from supabase import create_client

        sb = create_client(cfg.supabase_url, cfg.service_role_key)
        buckets = [b.name for b in sb.storage.list_buckets()]
        check(f"버킷 {cfg.storage_bucket}", cfg.storage_bucket in buckets, f"전체: {buckets}")
    except ImportError:
        check("supabase 패키지", False, "pip install -r worker/requirements.txt")
    except Exception as e:  # noqa: BLE001
        check("Storage 접근", False, str(e))

    print("▶ 5. 시스템 의존성")
    # ffmpeg 은 S2(오디오 추출)부터 필요하다. S1 게이트에서는 실패로 세지 않고 경고만 한다.
    if cfg.ffmpeg_path:
        ver = subprocess.run(
            [cfg.ffmpeg_path, "-version"], capture_output=True, text=True
        )
        check("ffmpeg", ver.returncode == 0, cfg.ffmpeg_path)
        if ver.stdout:
            print(f"    {ver.stdout.splitlines()[0]}")
    else:
        print(f"{NG} ffmpeg — 미설치 (S2 오디오 추출부터 필요, S1 게이트에는 무관)")
        print("      설치 경로 3가지 중 하나:")
        print("        1) winget install Gyan.FFmpeg           (시스템 드라이브 사용)")
        print("        2) full build 압축해제 → worker/bin/ffmpeg.exe 에 배치")
        print("        3) AI_JUDGE_FFMPEG=<ffmpeg.exe 전체경로> 환경변수")

    print("▶ 6. 분석 라이브러리")
    for mod, why in (("mediapipe", "포즈"), ("librosa", "비트"), ("cv2", "영상 IO"), ("numpy", "수치")):
        try:
            __import__(mod)
            check(mod, True, why)
        except ImportError as e:  # noqa: PERF203
            check(mod, False, f"{why} — {e}")

    print("\n" + ("✅ 전체 통과" if failures == 0 else f"❌ 실패 {failures}건"))
    return 0 if failures == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
