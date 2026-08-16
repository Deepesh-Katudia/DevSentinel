"""Offline tests for baseline load / summarize / compare. Not eval-marked."""
import json

from tests.evals.baseline import (
    compare,
    load_baseline,
    summarize,
    write_baseline,
)
from tests.evals.scorers import ScoreResult


def _r(name, value, passed=True):
    return ScoreResult(name=name, value=value, passed=passed, detail="")


def _named(results, name):
    return next(r for r in results if r.name == name)


def test_summarize_averages_each_metric_by_name():
    metrics = summarize([
        _r("recall", 1.0), _r("recall", 0.0),
        _r("total_tokens", 1000.0), _r("total_tokens", 2000.0),
    ])
    assert metrics == {"recall": 0.5, "total_tokens": 1500.0}


def test_summarize_of_nothing_is_empty():
    assert summarize([]) == {}


def test_load_baseline_returns_none_when_absent(tmp_path):
    assert load_baseline(tmp_path / "baseline.json") is None


def test_write_then_load_round_trips(tmp_path):
    path = tmp_path / "baseline.json"
    write_baseline(path, {"recall": 0.9}, {"note": "first run"})

    loaded = load_baseline(path)
    assert loaded["metrics"] == {"recall": 0.9}
    assert loaded["meta"]["note"] == "first run"
    assert json.loads(path.read_text(encoding="utf-8"))["metrics"]["recall"] == 0.9


def test_compare_passes_on_an_unchanged_run():
    baseline = {"metrics": {"recall": 0.9, "score_in_range": 40.0, "total_tokens": 3000.0}}
    results = compare({"recall": 0.9, "score_in_range": 40.0, "total_tokens": 3000.0}, baseline)
    assert results, "expected one comparison per shared metric"
    assert all(r.passed for r in results)


def test_compare_fails_when_recall_drops_past_tolerance():
    baseline = {"metrics": {"recall": 0.9}}
    assert not _named(compare({"recall": 0.7}, baseline), "regression:recall").passed


def test_compare_tolerates_a_small_recall_drop():
    baseline = {"metrics": {"recall": 0.9}}
    assert _named(compare({"recall": 0.8}, baseline), "regression:recall").passed


def test_compare_never_penalizes_an_improvement():
    baseline = {"metrics": {"recall": 0.5, "total_tokens": 3000.0}}
    results = compare({"recall": 1.0, "total_tokens": 1000.0}, baseline)
    assert all(r.passed for r in results)


def test_compare_fails_on_a_large_mean_score_swing_in_either_direction():
    """A prompt that suddenly scores every PR higher is as notable as one that
    scores every PR lower — the band is two-sided on purpose."""
    baseline = {"metrics": {"score_in_range": 40.0}}
    assert not _named(compare({"score_in_range": 65.0}, baseline), "regression:score_in_range").passed
    assert not _named(compare({"score_in_range": 15.0}, baseline), "regression:score_in_range").passed


def test_every_gating_metric_name_has_a_tolerance():
    """A metric absent from TOLERANCES is silently skipped by compare(), so a
    renamed scorer would stop guarding without anything failing."""
    from tests.evals.baseline import TOLERANCES

    for name in ("recall", "no_false_criticals", "score_in_range", "total_tokens"):
        assert name in TOLERANCES, f"{name} would be skipped by compare()"


def test_compare_fails_on_runaway_token_growth():
    baseline = {"metrics": {"total_tokens": 2000.0}}
    assert not _named(compare({"total_tokens": 3200.0}, baseline), "regression:total_tokens").passed


def test_compare_ignores_metrics_absent_from_the_baseline():
    results = compare({"brand_new_metric": 1.0}, {"metrics": {"recall": 0.9}})
    assert results == []
