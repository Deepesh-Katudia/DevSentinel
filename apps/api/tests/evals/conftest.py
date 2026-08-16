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

from pathlib import Path

import pytest

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


def pytest_addoption(parser):
    parser.addoption(
        "--eval-update-baseline",
        action="store_true",
        default=False,
        help="Overwrite tests/evals/baseline.json with this run's metrics.",
    )


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
