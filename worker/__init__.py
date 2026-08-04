"""AI Judge 분석 워커.

설계: docs/02-design/features/ai-judge.design.md §7
기준: docs/rubric.md v1.0

절대 원칙 (docs/rubric.md §1.2):
  1. Timing 축에만 점수를 부여한다. 다른 축은 코멘트만 생성한다.
  2. 모든 결과에 confidence 를 포함한다. low 면 지표를 숨긴다.
  3. 순위·합격/불합격을 판정하지 않는다.
"""

__all__ = ["config", "thresholds", "errors", "queue"]
