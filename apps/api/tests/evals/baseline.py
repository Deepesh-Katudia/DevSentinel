"""Baseline storage and regression comparison.

baseline.json holds the aggregate metrics from the last accepted run and is
committed to git, so every accepted quality shift lands as a reviewable diff.
Updating it needs an explicit --eval-update-baseline.

Model output is non-deterministic, so thresholds are bands rather than
equality, and aggregates matter more than any single fixture.
"""
import json
from pathlib import Path
from statistics import mean

from tests.evals.scorers import ScoreResult

# How far a metric may drift from the baseline before it counts as a regression.
#   max_drop      — falling this far below baseline fails; rising never does
#   max_abs_delta — moving this far in either direction fails
#   max_growth    — fractional increase allowed (cost metrics)
TOLERANCES = {
    "recall": {"max_drop": 0.15},
    "no_false_criticals": {"max_drop": 0.15},
    "severity_match": {"max_drop": 0.25},
    "root_cause_keywords": {"max_drop": 0.25},
    # score_in_range carries the raw score as its value, so its aggregate is
    # the mean score across fixtures — bounded in both directions, because a
    # prompt that suddenly scores everything higher is as notable as one that
    # scores everything lower.
    "score_in_range": {"max_abs_delta": 10.0},
    "overall_in_range": {"max_abs_delta": 10.0},
    "total_tokens": {"max_growth": 0.30},
    "latency_ms": {"max_growth": 1.00},
}


def summarize(results: list[ScoreResult]) -> dict[str, float]:
    """Collapse many per-fixture ScoreResults into one mean per metric name."""
    grouped: dict[str, list[float]] = {}
    for result in results:
        grouped.setdefault(result.name, []).append(result.value)
    return {name: mean(values) for name, values in grouped.items()}


def load_baseline(path: Path) -> dict | None:
    """Return the committed baseline, or None on the very first run."""
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def write_baseline(path: Path, metrics: dict[str, float], meta: dict) -> None:
    path.write_text(
        json.dumps({"meta": meta, "metrics": metrics}, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def _compare_one(name: str, current: float, previous: float) -> ScoreResult:
    tolerance = TOLERANCES[name]
    delta = current - previous

    if "max_drop" in tolerance:
        limit = tolerance["max_drop"]
        passed = delta >= -limit
        detail = f"{previous:.3f} -> {current:.3f} (drop limit {limit})"
    elif "max_abs_delta" in tolerance:
        limit = tolerance["max_abs_delta"]
        passed = abs(delta) <= limit
        detail = f"{previous:.2f} -> {current:.2f} (limit +/-{limit})"
    else:
        limit = tolerance["max_growth"]
        ceiling = previous * (1 + limit)
        passed = current <= ceiling or previous == 0
        detail = f"{previous:.0f} -> {current:.0f} (ceiling {ceiling:.0f})"

    return ScoreResult(
        name=f"regression:{name}",
        value=delta,
        passed=passed,
        detail=detail,
    )


def compare(current: dict[str, float], baseline: dict) -> list[ScoreResult]:
    """One ScoreResult per metric present in both the run and the baseline."""
    previous = baseline.get("metrics", {})
    return [
        _compare_one(name, value, previous[name])
        for name, value in sorted(current.items())
        if name in previous and name in TOLERANCES
    ]
