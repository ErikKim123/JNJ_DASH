"""AI 코칭 코멘트 생성 — Claude vision.

⚠️ 절대 원칙 1 (rubric §1.2) 의 구조적 강제:
   COMMENTS_SCHEMA 에는 **숫자 필드가 하나도 없다** (segment_index 제외 — 이건 배열
   인덱스이지 점수가 아니다). 따라서 모델이 Technique/Teamwork/Musicality 에
   점수를 부여할 구조적 경로 자체가 존재하지 않는다.
   스키마에 number/integer 를 추가하려 할 때는 이 주석을 먼저 읽을 것.

실패 처리: 코멘트 생성 실패는 잡을 실패시키지 않는다(errors.NON_FATAL_CODES).
지표는 이미 산출됐으므로 comments_json={} 으로 리포트를 저장하고 done 으로 둔다.
"""

from __future__ import annotations

import base64
import json
import logging
from pathlib import Path

from . import thresholds as T
from .config import Config, get_config
from .errors import CommentFailed, CommentRefused

log = logging.getLogger(__name__)

MODEL = "claude-opus-5"
#: opus-5 는 사고가 기본 ON 이고 max_tokens 가 사고+응답 합산 상한이다. 넉넉히 잡는다.
MAX_TOKENS = 8000

_TEXT = {"type": "string"}

COMMENTS_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": [
        "timing", "musicality", "technique", "teamwork",
        "offbeat_pattern_summary", "segment_coaching",
    ],
    "properties": {
        # Timing — 유일하게 정량 지표를 근거로 서술하는 축
        "timing": {
            "type": "object", "additionalProperties": False,
            "required": ["comment"], "properties": {"comment": _TEXT},
        },
        "musicality": {
            "type": "object", "additionalProperties": False,
            "required": ["comment"], "properties": {"comment": _TEXT},
        },
        # 참고 지표 축 — reference_only 를 const true 로 못박아 화면에서 점수처럼
        # 렌더되는 것을 막는다.
        "technique": {
            "type": "object", "additionalProperties": False,
            "required": ["comment", "reference_only"],
            "properties": {
                "comment": _TEXT,
                "reference_only": {"type": "boolean", "const": True},
            },
        },
        "teamwork": {
            "type": "object", "additionalProperties": False,
            "required": ["comment", "reference_only"],
            "properties": {
                "comment": _TEXT,
                "reference_only": {"type": "boolean", "const": True},
            },
        },
        "offbeat_pattern_summary": _TEXT,
        "segment_coaching": {
            "type": "array",
            "items": {
                "type": "object", "additionalProperties": False,
                "required": ["segment_index", "coaching"],
                "properties": {
                    # 배열 인덱스. 점수가 아니다.
                    "segment_index": {"type": "integer"},
                    "coaching": _TEXT,
                },
            },
        },
    },
}


def _rubric_text() -> str:
    from .config import REPO_ROOT

    path = REPO_ROOT / "docs" / "rubric.md"
    if not path.exists():
        raise CommentFailed(f"rubric 문서를 찾을 수 없습니다: {path}")
    return path.read_text(encoding="utf-8")


ABSOLUTE_RULES_PROMPT = """\
당신은 소셜댄스 코칭 어시스턴트입니다. 위 rubric 을 유일한 판단 기준으로 사용하십시오.

- Timing 축에만 정량적 판정을 붙입니다. 제공된 onbeat_ratio 와 구간 데이터를 근거로 서술하십시오.
- Technique / Teamwork / Musicality 는 점수·등급·별점·백분율·순위를 어떤 형태로도 생성하지 마십시오.
  영상과 지표에서 관찰된 사실, 그리고 개선 제안만 문장으로 서술합니다.
- 합격/불합격, 등수, 다른 참가자와의 비교를 언급하지 마십시오.
- 지표가 뒷받침하지 않는 단정을 하지 마십시오. 확신이 낮으면 "…로 보입니다" 로 서술합니다.
- 한국어로, 참가자를 존중하는 어조로 작성합니다. 지적 1개당 실행 가능한 연습 방법 1개를 함께 제시합니다.
- segment_coaching 은 제공된 오프비트 구간 각각에 대해 segment_index 를 맞춰 작성합니다.
"""


def _image_blocks(keyframes: list[Path]) -> list[dict]:
    blocks = []
    for p in keyframes[: T.KEYFRAME_MAX]:
        blocks.append({
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": "image/jpeg",
                "data": base64.standard_b64encode(p.read_bytes()).decode("ascii"),
            },
        })
    return blocks


def generate(metrics_json: dict, keyframes: list[Path],
             cfg: Config | None = None) -> tuple[dict, dict]:
    """지표 JSON + 키프레임 → (comments_json, usage_json).

    Raises:
        CommentRefused: 안전 분류기가 거절 (stop_reason='refusal')
        CommentFailed:  API 오류 / 응답 파싱 실패
    두 예외 모두 잡을 실패시키지 않는다 (errors.NON_FATAL_CODES).
    """
    cfg = cfg or get_config()
    if not cfg.anthropic_api_key:
        raise CommentFailed("ANTHROPIC_API_KEY 가 없어 코멘트를 생성할 수 없습니다.")

    import anthropic

    client = anthropic.Anthropic(api_key=cfg.anthropic_api_key)

    system = [
        # rubric 전문은 리포트마다 동일하므로 캐시한다(입력 비용 대폭 절감).
        {"type": "text", "text": _rubric_text(),
         "cache_control": {"type": "ephemeral"}},
        {"type": "text", "text": ABSOLUTE_RULES_PROMPT},
    ]
    content = _image_blocks(keyframes) + [{
        "type": "text",
        "text": "다음은 이 영상의 분석 지표입니다.\n\n"
                + json.dumps(metrics_json, ensure_ascii=False, indent=2),
    }]

    params = dict(
        model=MODEL,
        max_tokens=MAX_TOKENS,
        system=system,
        output_config={
            "effort": "high",
            "format": {"type": "json_schema", "schema": COMMENTS_SCHEMA},
        },
        messages=[{"role": "user", "content": content}],
    )

    try:
        resp = _create_with_fallback(client, params)
    except (CommentRefused, CommentFailed):
        raise
    except Exception as e:  # noqa: BLE001 — API/네트워크 오류 전반
        raise CommentFailed(f"Claude 호출 실패: {e}") from e

    # 절대 원칙과 무관하게, content 를 읽기 전에 반드시 stop_reason 을 본다.
    if resp.stop_reason == "refusal":
        raise CommentRefused(
            "안전 분류기가 코멘트 생성을 거절했습니다.",
            stop_details=str(getattr(resp, "stop_details", None)),
        )

    text = "".join(b.text for b in resp.content if getattr(b, "type", "") == "text")
    if not text.strip():
        raise CommentFailed(f"빈 응답 (stop_reason={resp.stop_reason})")
    try:
        comments = json.loads(text)
    except json.JSONDecodeError as e:
        raise CommentFailed(f"응답 JSON 파싱 실패: {e}") from e

    usage = {
        "model": getattr(resp, "model", MODEL),
        "input_tokens": getattr(resp.usage, "input_tokens", 0),
        "output_tokens": getattr(resp.usage, "output_tokens", 0),
        "cache_read_input_tokens": getattr(resp.usage, "cache_read_input_tokens", 0),
        "cache_creation_input_tokens": getattr(resp.usage, "cache_creation_input_tokens", 0),
    }
    log.info("comments 생성 완료: in=%d out=%d cache_read=%d",
             usage["input_tokens"], usage["output_tokens"],
             usage["cache_read_input_tokens"])
    return comments, usage


def _create_with_fallback(client, params: dict):
    """서버사이드 refusal fallback 을 켠 beta 경로를 먼저 시도한다.

    opus-5 의 안전 분류기가 거절하면 Anthropic 이 권장 모델로 자동 재실행한다.
    베타 파라미터가 거부되는 환경(SDK/계정 차이)에서는 GA 경로로 물러난다.
    """
    try:
        return client.beta.messages.create(
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            **params,
        )
    except TypeError as e:
        log.warning("beta fallback 미지원 → GA 경로 사용 (%s)", e)
    except Exception as e:  # noqa: BLE001
        name = type(e).__name__
        if "BadRequest" not in name and "NotFound" not in name:
            raise
        log.warning("beta fallback 거부됨 → GA 경로 사용 (%s: %s)", name, e)
    return client.messages.create(**params)
