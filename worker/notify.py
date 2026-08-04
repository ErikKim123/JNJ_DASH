"""완료 알림 이메일 — Resend REST API.

워커는 Python 이라 웹앱의 lib/email(Resend Node SDK)을 재사용할 수 없으므로
REST 엔드포인트를 직접 호출한다.

TODO(사이클 3 이후): 알림톡 연동. 지금은 범위 밖이다(스펙 4.2).
"""

from __future__ import annotations

import logging

import httpx

from .config import Config, get_config

log = logging.getLogger(__name__)

RESEND_ENDPOINT = "https://api.resend.com/emails"
FROM_DEFAULT = "JNJ Dash AI Judge <onboarding@resend.dev>"


def send_report_ready(to_email: str, report_id: str, *,
                      confidence: str, app_base_url: str = "",
                      cfg: Config | None = None) -> bool:
    """분석 완료 알림. 실패해도 예외를 올리지 않는다(잡을 실패시키지 않기 위해).

    Returns: 발송 성공 여부
    """
    cfg = cfg or get_config()
    if not cfg.resend_api_key:
        log.info("RESEND_API_KEY 없음 — 이메일 발송 생략")
        return False
    if not to_email:
        log.info("수신 이메일 없음 — 발송 생략")
        return False

    url = f"{app_base_url.rstrip('/')}/ajudge/report/{report_id}" if app_base_url else ""

    if confidence == "low":
        subject = "[AI Judge] 분석 결과를 확인해 주세요 (재촬영 안내)"
        body = (
            "<p>영상 분석이 끝났습니다.</p>"
            "<p>다만 화각이나 인물 추적 문제로 <b>지표를 신뢰할 수 없어</b> "
            "결과를 표시하지 않았습니다. 재촬영 안내를 확인해 주세요.</p>"
        )
    else:
        subject = "[AI Judge] 분석이 완료되었습니다"
        body = "<p>영상 분석이 완료되었습니다. 리포트에서 온비트 지표와 코칭을 확인해 보세요.</p>"

    if url:
        body += f'<p><a href="{url}">리포트 열기</a></p>'

    try:
        resp = httpx.post(
            RESEND_ENDPOINT,
            headers={"Authorization": f"Bearer {cfg.resend_api_key}"},
            json={
                "from": FROM_DEFAULT,
                "to": [to_email],
                "subject": subject,
                "html": body,
            },
            timeout=15.0,
        )
        if resp.status_code >= 400:
            log.warning("이메일 발송 실패 %s: %s", resp.status_code, resp.text[:300])
            return False
        log.info("이메일 발송 완료 → %s", to_email)
        return True
    except Exception as e:  # noqa: BLE001 — 알림 실패가 파이프라인을 막지 않는다
        log.warning("이메일 발송 예외: %s", e)
        return False
