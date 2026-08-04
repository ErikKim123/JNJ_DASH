"""워커 에러 코드 — design §6.1.

jobs.error_code 에 기록되고, 웹앱이 코드별 안내 문구를 매핑한다.
문자열을 여기 밖에서 만들지 말 것.
"""

from __future__ import annotations


class WorkerError(Exception):
    """error_code 를 동반하는 워커 예외."""

    code = "INTERNAL"
    #: True 면 사용자가 조치 후 재시도할 수 있다(웹앱에 재시도 버튼 노출).
    retryable = True

    def __init__(self, message: str = "", **detail):
        super().__init__(message or self.code)
        self.message = message or self.code
        self.detail = detail


class DurationExceeded(WorkerError):
    code = "DURATION_EXCEEDED"


class AudioExtractFailed(WorkerError):
    """오디오 트랙 없음 / 무음 / 템포 불안정.

    이 에러만 특별하게, 웹앱이 '원곡 파일 업로드' 폴백 UI 를 띄운다.
    """

    code = "AUDIO_EXTRACT_FAILED"


class PoseExtractFailed(WorkerError):
    code = "POSE_EXTRACT_FAILED"


class PersonCountMismatch(WorkerError):
    code = "PERSON_COUNT_MISMATCH"


class CommentRefused(WorkerError):
    """Claude 가 stop_reason='refusal' 로 응답.

    ⚠️ 잡을 실패시키지 않는다. 지표는 이미 산출됐으므로
       comments_json={} 으로 리포트를 저장하고 status=done 으로 둔다.
    """

    code = "COMMENT_REFUSED"
    retryable = False


class CommentFailed(WorkerError):
    """Claude API 오류(재시도 소진). CommentRefused 와 동일하게 잡을 실패시키지 않는다."""

    code = "COMMENT_FAILED"


#: 리포트 저장을 막지 않는 코드. 지표만 저장하고 status=done 으로 진행한다.
NON_FATAL_CODES = frozenset({CommentRefused.code, CommentFailed.code})
