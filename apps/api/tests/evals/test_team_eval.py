"""Evaluates analyze_team_quality against real Claude calls.

Unlike review and triage this one has no file fixtures — its input is a
handful of aggregate numbers, so the cases are defined inline.
"""
import pytest

from services.claude_service import analyze_team_quality_with_meta
from tests.evals.scorers import Budget, ScoreResult, score_budget, score_contract

pytestmark = pytest.mark.eval

# (case_id, kwargs, expected overallScore band)
TEAM_CASES = [
    (
        "healthy_team",
        {
            "repo_count": 4, "total_prs": 62, "avg_score": 88.0,
            "total_critical": 1, "total_warnings": 9,
            "member_stats": [
                {"name": "jsmith", "prCount": 30, "avgScore": 90,
                 "criticalCount": 0, "warningCount": 4},
                {"name": "adevi", "prCount": 32, "avgScore": 86,
                 "criticalCount": 1, "warningCount": 5},
            ],
        },
        (70, 100),
    ),
    (
        "struggling_team",
        {
            "repo_count": 3, "total_prs": 40, "avg_score": 41.0,
            "total_critical": 22, "total_warnings": 55,
            "member_stats": [
                {"name": "jsmith", "prCount": 20, "avgScore": 38,
                 "criticalCount": 12, "warningCount": 30},
                {"name": "adevi", "prCount": 20, "avgScore": 44,
                 "criticalCount": 10, "warningCount": 25},
            ],
        },
        (0, 55),
    ),
    (
        "no_activity",
        {
            "repo_count": 1, "total_prs": 0, "avg_score": 0.0,
            "total_critical": 0, "total_warnings": 0,
            "member_stats": [],
        },
        (0, 100),
    ),
]


@pytest.mark.parametrize("case_id,kwargs,score_band", TEAM_CASES, ids=[c[0] for c in TEAM_CASES])
async def test_team_analysis_meets_its_contract_and_tracks_the_inputs(
    case_id, kwargs, score_band, budgets, recorder, gating
):
    payload, meta = await analyze_team_quality_with_meta(**kwargs)

    contract = score_contract(payload, "team")
    budget = score_budget(meta, Budget(**budgets["team"]))

    quality = []
    if contract.passed:
        low, high = score_band
        overall = payload["overallScore"]
        quality.append(ScoreResult(
            name="overall_in_range",
            value=float(overall),
            passed=low <= overall <= high,
            detail=f"overallScore {overall} against expected {low}-{high}",
        ))

    recorder.record("team", case_id, [contract, *quality, *budget], meta)

    assert contract.passed, contract.detail

    if not gating:
        pytest.skip("No baseline.json yet — reporting without gating.")

    for result in [*quality, *budget]:
        assert result.passed, f"{case_id} {result.name}: {result.detail}"
