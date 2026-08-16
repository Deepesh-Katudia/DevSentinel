"""Session-level wiring for the eval harness.

Everything here exists to make `pytest -m eval` safe to run by accident: with
no real key the whole package skips, and with one it uses the same client the
production code does.
"""
import os

# Seed the non-Anthropic settings before anything imports models.database,
# which builds a Settings() at import time. conftest is imported ahead of the
# test modules that normally do this seeding, so without it a `-m eval` run
# fails during collection on a missing DATABASE_URL rather than running.
# ANTHROPIC_API_KEY is deliberately absent — a real one must come from the
# environment, and require_real_api_key below skips the package if it doesn't.
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379")
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-jwt-secret")
os.environ.setdefault("GITHUB_APP_ID", "12345")
os.environ.setdefault("GITHUB_WEBHOOK_SECRET", "test-webhook-secret")
os.environ.setdefault("SENTRY_WEBHOOK_SECRET", "test-sentry-secret")
os.environ.setdefault("STRIPE_SECRET_KEY", "sk_test_mock")
os.environ.setdefault("STRIPE_WEBHOOK_SECRET", "whsec_mock")

import json
from dataclasses import asdict
from pathlib import Path

import pytest

from tests.evals.baseline import compare, load_baseline, summarize, write_baseline
from tests.evals.scorers import RECALL_FLOOR, ScoreResult

# The sentinel the offline tests seed via os.environ.setdefault. If we see it,
# no real key was exported and there is nothing to evaluate against.
MOCK_KEY_SENTINEL = "sk-ant-mock"

# Generous on purpose — roughly 2x what a first run should show. Task 9 tightens
# these against real numbers rather than guesses.
BUDGETS = {
    "review": {"max_total_tokens": 8000, "max_latency_ms": 60000},
    "triage": {"max_total_tokens": 4000, "max_latency_ms": 45000},
    "team": {"max_total_tokens": 2500, "max_latency_ms": 30000},
}


# --eval-update-baseline is registered in the rootdir conftest.py, not here:
# pytest only honours pytest_addoption in a conftest it loads before parsing
# the command line, and this one is not imported until collection starts.


@pytest.fixture(scope="session")
def evals_dir() -> Path:
    return Path(__file__).parent


@pytest.fixture(scope="session")
def fixtures_dir(evals_dir: Path) -> Path:
    return evals_dir / "fixtures"


@pytest.fixture(scope="session")
def baseline_path(evals_dir: Path) -> Path:
    return evals_dir / "baseline.json"


@pytest.fixture(scope="session")
def budgets() -> dict:
    return BUDGETS


def _real_api_key() -> str | None:
    """The exported ANTHROPIC_API_KEY, or None when it is absent or the mock."""
    key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not key or key.startswith(MOCK_KEY_SENTINEL):
        return None
    return key


def pytest_collection_modifyitems(config, items):
    """Skip every eval-marked test unless a real ANTHROPIC_API_KEY is exported.

    An accidental `pytest -m eval` then costs nothing and reports why it did
    nothing, instead of failing on a 401.

    This gates per-item rather than per-package on purpose: the *_unit.py
    modules beside it are not eval-marked and must keep running in the free
    offline suite, so an autouse fixture over the whole package would wrongly
    skip the tests that keep the harness itself honest.
    """
    if _real_api_key() is not None:
        return

    found = os.environ.get("ANTHROPIC_API_KEY", "") or "<unset>"
    skip = pytest.mark.skip(
        reason=f"No real ANTHROPIC_API_KEY exported (found {found!r}). "
               "Export a real key to run the evals."
    )
    for item in items:
        if "eval" in item.keywords:
            item.add_marker(skip)


@pytest.fixture(scope="session", autouse=True)
def reset_cached_client():
    """Never let an eval run inherit a client built with the mock-key sentinel.

    The offline tests never build a client (they patch get_client), so dropping
    the cached one is a no-op for them.
    """
    from services import claude_service
    claude_service._client = None


class EvalRecorder:
    """Collects every ScoreResult in the session, then writes last_run.json.

    Only aggregates go into baseline.json; the per-fixture rows stay in the
    gitignored run report where they are useful for debugging a single case.
    """

    def __init__(self):
        self.results: list[ScoreResult] = []
        self.rows: list[dict] = []

    def record(self, suite: str, case_id: str, results, meta=None) -> None:
        self.results.extend(results)
        self.rows.append({
            "suite": suite,
            "case_id": case_id,
            "scores": [asdict(r) for r in results],
            "usage": asdict(meta) if meta is not None else None,
        })

    def metrics(self) -> dict:
        return summarize(self.results)


@pytest.fixture(scope="session")
def gating(baseline_path) -> bool:
    """Quality metrics only fail a run once a baseline exists to compare to.

    The first `pytest -m eval` establishes the numbers; until then everything
    except the contract check reports without failing, exactly as designed.
    """
    return load_baseline(baseline_path) is not None


@pytest.fixture(scope="session")
def recorder(request, baseline_path, evals_dir):
    rec = EvalRecorder()
    yield rec

    metrics = rec.metrics()
    baseline = load_baseline(baseline_path)
    regressions = compare(metrics, baseline) if baseline else []

    (evals_dir / "last_run.json").write_text(
        json.dumps({
            "metrics": metrics,
            "regressions": [asdict(r) for r in regressions],
            "cases": rec.rows,
        }, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )

    if request.config.getoption("--eval-update-baseline"):
        write_baseline(baseline_path, metrics, {"cases": len(rec.rows)})
        print(f"\n[eval] baseline updated: {baseline_path}")
        return

    if not baseline:
        return

    # A -k filtered run aggregates a different set of cases than the baseline
    # did, so comparing the two means measuring the filter rather than the
    # prompt. Debugging one case with -k must not report phantom regressions.
    expected_cases = baseline.get("meta", {}).get("cases")
    if expected_cases is not None and len(rec.rows) != expected_cases:
        print(
            f"\n[eval] partial run ({len(rec.rows)}/{expected_cases} cases) — "
            "skipping the baseline comparison; run the full suite to gate."
        )
        return

    failed = [r for r in regressions if not r.passed]
    for r in failed:
        print(f"\n[eval] REGRESSION {r.name}: {r.detail}")

    # Relative drift is only half the guard: a baseline accepted while already
    # poor would let recall sit low forever without ever "regressing". The
    # absolute floor is checked here rather than per fixture because a single
    # fixture plants one finding, so only the mean carries signal.
    recall = metrics.get("recall")
    floor_failed = recall is not None and recall < RECALL_FLOOR
    if floor_failed:
        print(f"\n[eval] RECALL FLOOR: {recall:.3f} is below {RECALL_FLOOR}")

    assert not failed and not floor_failed, (
        f"{len(failed)} metric(s) regressed against baseline.json"
        + (f"; aggregate recall {recall:.3f} < {RECALL_FLOOR}" if floor_failed else "")
    )
