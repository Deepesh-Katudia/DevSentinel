"""Evaluates triage_incident against real Claude calls."""
from pathlib import Path

import pytest

from services.claude_service import triage_incident_with_meta
from tests.evals.fixtures import load_incident_fixtures
from tests.evals.scorers import Budget, score_budget, score_contract, score_triage

pytestmark = pytest.mark.eval

INCIDENT_FIXTURES = load_incident_fixtures(Path(__file__).parent / "fixtures")


@pytest.mark.parametrize("fixture", INCIDENT_FIXTURES, ids=lambda f: f.case_id)
async def test_triage_meets_its_contract_and_lands_the_right_severity(
    fixture, budgets, recorder, gating
):
    payload, meta = await triage_incident_with_meta(
        fixture.title,
        fixture.stack_trace,
        list(fixture.affected_files),
        fixture.blame_info,
    )

    contract = score_contract(payload, "triage")
    quality = score_triage(payload, fixture) if contract.passed else []
    budget = score_budget(meta, Budget(**budgets["triage"]))

    recorder.record("triage", fixture.case_id, [contract, *quality, *budget], meta)

    assert contract.passed, contract.detail

    if not gating:
        pytest.skip("No baseline.json yet — reporting without gating.")

    for result in [*quality, *budget]:
        assert result.passed, f"{fixture.case_id} {result.name}: {result.detail}"


def test_the_incident_set_spans_more_than_one_severity():
    """A set that is all P1 cannot catch a model that calls everything P1."""
    severities = {f.expected_severity for f in INCIDENT_FIXTURES}
    assert len(severities) > 1, f"only {severities} represented"
