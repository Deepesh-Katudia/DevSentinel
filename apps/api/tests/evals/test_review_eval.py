"""Evaluates review_pull_request against real Claude calls.

Costs money — gated behind `pytest -m eval` plus a real ANTHROPIC_API_KEY.
"""
from pathlib import Path

import pytest

from services.claude_service import review_pull_request_with_meta
from tests.evals.fixtures import load_pr_fixtures
from tests.evals.scorers import Budget, score_budget, score_contract, score_findings

pytestmark = pytest.mark.eval

PR_FIXTURES = load_pr_fixtures(Path(__file__).parent / "fixtures")


@pytest.mark.parametrize("fixture", PR_FIXTURES, ids=lambda f: f.case_id)
async def test_review_meets_its_contract_and_finds_the_planted_bug(
    fixture, budgets, recorder, gating
):
    payload, meta = await review_pull_request_with_meta(
        fixture.repo, fixture.title, fixture.diff
    )

    contract = score_contract(payload, "review")
    quality = score_findings(payload, fixture) if contract.passed else []
    budget = score_budget(meta, Budget(**budgets["review"]))

    recorder.record("review", fixture.case_id, [contract, *quality, *budget], meta)

    # Contract is a hard fail always — a malformed payload breaks consumers
    # regardless of how good the review is.
    assert contract.passed, contract.detail

    if not gating:
        pytest.skip(
            "No baseline.json yet — reporting this run's numbers without "
            "gating. Run with --eval-update-baseline to establish thresholds."
        )

    for result in [*quality, *budget]:
        assert result.passed, f"{fixture.case_id} {result.name}: {result.detail}"


def test_the_fixture_set_covers_both_planted_and_clean_cases():
    """A suite of only planted-bug cases cannot measure false positives."""
    assert any(f.is_clean for f in PR_FIXTURES), "no clean fixtures"
    assert any(not f.is_clean for f in PR_FIXTURES), "no planted-bug fixtures"
