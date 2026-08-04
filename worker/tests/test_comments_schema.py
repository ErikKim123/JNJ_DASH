"""COMMENTS_SCHEMA 검증 — 절대 원칙 1의 구조적 강제가 실제로 성립하는지.

이 테스트가 깨진다면 모델이 Timing 외 축에 점수를 부여할 경로가 생겼다는 뜻이다.
스키마에 number/integer 를 추가하기 전에 반드시 이 파일을 읽을 것.
"""

import json

import jsonschema
import pytest

from worker.comments import ABSOLUTE_RULES_PROMPT, COMMENTS_SCHEMA, MODEL

REFERENCE_AXES = ("technique", "teamwork")
ALL_AXES = ("timing", "musicality", "technique", "teamwork")


def _walk(node, path=""):
    """스키마를 순회하며 (경로, 노드) 를 낸다."""
    if isinstance(node, dict):
        yield path, node
        for k, v in node.items():
            yield from _walk(v, f"{path}.{k}" if path else k)
    elif isinstance(node, list):
        for i, v in enumerate(node):
            yield from _walk(v, f"{path}[{i}]")


# ── 절대 원칙 1 ──────────────────────────────────────────────────
def test_only_allowed_numeric_field_is_segment_index():
    """숫자 필드는 segment_index(배열 인덱스) 하나뿐이어야 한다."""
    numeric = [
        p for p, n in _walk(COMMENTS_SCHEMA)
        if isinstance(n, dict) and n.get("type") in ("number", "integer")
    ]
    assert len(numeric) == 1, f"허용되지 않은 숫자 필드: {numeric}"
    assert numeric[0].endswith("segment_index"), numeric[0]


def test_no_score_like_property_names():
    banned = ("score", "rating", "rank", "grade", "star", "point",
              "percent", "total", "pass", "level")
    names = []
    for path, node in _walk(COMMENTS_SCHEMA):
        if path.endswith("properties") and isinstance(node, dict):
            names.extend(node.keys())
    for n in names:
        low = n.lower()
        for b in banned:
            assert b not in low, f"점수를 연상시키는 필드명: {n}"


def test_reference_axes_are_pinned_to_reference_only():
    """Technique/Teamwork 는 reference_only=true 가 const 로 고정돼야 한다."""
    for axis in REFERENCE_AXES:
        prop = COMMENTS_SCHEMA["properties"][axis]["properties"]["reference_only"]
        assert prop["type"] == "boolean"
        assert prop["const"] is True
        assert "reference_only" in COMMENTS_SCHEMA["properties"][axis]["required"]


def test_every_axis_only_has_comment_text():
    """모든 축은 comment(문자열) 외의 값 필드를 갖지 않는다."""
    for axis in ALL_AXES:
        props = COMMENTS_SCHEMA["properties"][axis]["properties"]
        assert props["comment"]["type"] == "string"
        extra = set(props) - {"comment", "reference_only"}
        assert not extra, f"{axis} 에 예상 밖 필드: {extra}"


# ── 구조화 출력 제약 (Claude structured outputs) ─────────────────
def test_all_objects_forbid_additional_properties():
    for path, node in _walk(COMMENTS_SCHEMA):
        if isinstance(node, dict) and node.get("type") == "object":
            assert node.get("additionalProperties") is False, path


def test_schema_itself_is_valid_json_schema():
    jsonschema.Draft202012Validator.check_schema(COMMENTS_SCHEMA)


def test_schema_is_json_serializable():
    json.dumps(COMMENTS_SCHEMA)


# ── 실제 응답 형태 검증 ──────────────────────────────────────────
VALID = {
    "timing": {"comment": "브레이크 직후 반복적으로 밀립니다."},
    "musicality": {"comment": "코러스 진입 악센트를 놓쳤습니다."},
    "technique": {"comment": "중심 이동은 안정적입니다.", "reference_only": True},
    "teamwork": {"comment": "리드 신호 수용이 빠릅니다.", "reference_only": True},
    "offbeat_pattern_summary": "턴 이후 밀림이 반복됩니다.",
    "segment_coaching": [{"segment_index": 0, "coaching": "턴 마무리에서 축을 잡으세요."}],
}


def test_valid_response_passes():
    jsonschema.validate(VALID, COMMENTS_SCHEMA)


def test_response_with_score_field_is_rejected():
    bad = json.loads(json.dumps(VALID))
    bad["technique"]["score"] = 8
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(bad, COMMENTS_SCHEMA)


def test_reference_only_false_is_rejected():
    bad = json.loads(json.dumps(VALID))
    bad["technique"]["reference_only"] = False
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(bad, COMMENTS_SCHEMA)


def test_missing_axis_is_rejected():
    bad = json.loads(json.dumps(VALID))
    del bad["teamwork"]
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(bad, COMMENTS_SCHEMA)


# ── 프롬프트 / 모델 ──────────────────────────────────────────────
def test_prompt_states_the_absolute_rules():
    for phrase in ("Timing", "점수", "순위", "합격"):
        assert phrase in ABSOLUTE_RULES_PROMPT


def test_model_is_pinned():
    assert MODEL == "claude-opus-5"
