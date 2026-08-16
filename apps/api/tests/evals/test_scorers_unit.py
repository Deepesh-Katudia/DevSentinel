"""Offline tests for the scorers, driven by synthetic payloads. Not eval-marked."""
import pytest

from services.claude_service import CallMeta
from tests.evals.fixtures import ExpectedFinding, IncidentFixture, PRFixture
from tests.evals.scorers import (
    Budget,
    score_budget,
    score_contract,
    score_findings,
    score_triage,
)

GOOD_REVIEW = {
    "comments": [
        {"file": "src/customers.py", "line": 45, "severity": "critical",
         "body": "String concatenation here allows SQL injection; use parameterized queries."}
    ],
    "score": 30,
    "summary": "One critical issue.",
}

PLANTED = PRFixture(
    case_id="001_sql_injection",
    repo="acme/payments",
    title="feat: add customer search endpoint",
    diff="diff --git a/src/customers.py b/src/customers.py\n",
    expected_findings=(
        ExpectedFinding("src/customers.py", (43, 47), "critical",
                        ("sql", "injection", "parameteriz")),
    ),
    expected_score_range=(0, 45),
    must_not_flag=(),
)

CLEAN = PRFixture(
    case_id="009_clean_refactor",
    repo="acme/api",
    title="refactor: extract average score helper",
    diff="diff --git a/src/reports.py b/src/reports.py\n",
    expected_findings=(),
    expected_score_range=(70, 100),
    must_not_flag=("critical",),
)


def _named(results, name):
    return next(r for r in results if r.name == name)


# --- contract -------------------------------------------------------------

def test_contract_accepts_a_well_formed_review():
    result = score_contract(GOOD_REVIEW, "review")
    assert result.passed
    assert result.value == 1.0


def test_contract_rejects_a_score_on_the_old_0_to_10_scale():
    """The regression that opened a false P1 on every clean PR."""
    result = score_contract({**GOOD_REVIEW, "score": 8.0}, "review")
    assert not result.passed
    assert "integer" in result.detail


def test_contract_rejects_a_score_above_100():
    result = score_contract({**GOOD_REVIEW, "score": 140}, "review")
    assert not result.passed
    assert "0-100" in result.detail


def test_contract_rejects_a_missing_key():
    payload = {k: v for k, v in GOOD_REVIEW.items() if k != "summary"}
    result = score_contract(payload, "review")
    assert not result.passed
    assert "summary" in result.detail


def test_contract_rejects_an_unknown_comment_severity():
    payload = {**GOOD_REVIEW, "comments": [
        {**GOOD_REVIEW["comments"][0], "severity": "blocker"}
    ]}
    result = score_contract(payload, "review")
    assert not result.passed
    assert "blocker" in result.detail


def test_contract_rejects_an_unknown_triage_severity():
    result = score_contract({
        "rootCause": "r", "suggestedFix": "f", "affectedFiles": ["a.py"],
        "blastRadius": "b", "severity": "SEV1",
    }, "triage")
    assert not result.passed
    assert "SEV1" in result.detail


def test_contract_accepts_a_well_formed_triage():
    result = score_contract({
        "rootCause": "Null payment method.", "suggestedFix": "Add a guard.",
        "affectedFiles": ["src/payment.py"], "blastRadius": "All checkouts",
        "severity": "P1",
    }, "triage")
    assert result.passed


def test_contract_rejects_an_unknown_team_grade():
    result = score_contract({
        "overallScore": 80, "grade": "AA", "summary": "s",
        "strengths": [], "risks": [], "recommendation": "r",
    }, "team")
    assert not result.passed
    assert "AA" in result.detail


def test_contract_rejects_a_non_dict_payload():
    result = score_contract(["not", "a", "dict"], "review")
    assert not result.passed


# --- findings -------------------------------------------------------------

def test_recall_is_one_when_the_planted_bug_is_found():
    assert _named(score_findings(GOOD_REVIEW, PLANTED), "recall").value == 1.0


def test_recall_is_reported_per_fixture_but_never_gates_there():
    """A fixture plants one finding, so its recall is only ever 0.0 or 1.0 and
    any floor between them means 'must match exactly'. Line-number drift would
    then redden a different random case every run. RECALL_FLOOR guards the
    session aggregate instead, where the tolerance actually has room."""
    payload = {**GOOD_REVIEW, "comments": [
        {**GOOD_REVIEW["comments"][0], "line": 200}
    ]}
    recall = _named(score_findings(payload, PLANTED), "recall")
    assert recall.value == 0.0
    assert recall.passed, "per-fixture recall is reported, not gating"


def test_recall_is_zero_when_the_line_is_outside_the_range():
    payload = {**GOOD_REVIEW, "comments": [
        {**GOOD_REVIEW["comments"][0], "line": 200}
    ]}
    assert _named(score_findings(payload, PLANTED), "recall").value == 0.0


def test_recall_is_zero_when_no_keyword_appears():
    payload = {**GOOD_REVIEW, "comments": [
        {**GOOD_REVIEW["comments"][0], "body": "Consider renaming this variable."}
    ]}
    assert _named(score_findings(payload, PLANTED), "recall").value == 0.0


def test_keyword_matching_is_case_insensitive():
    payload = {**GOOD_REVIEW, "comments": [
        {**GOOD_REVIEW["comments"][0], "body": "Possible SQL INJECTION risk."}
    ]}
    assert _named(score_findings(payload, PLANTED), "recall").value == 1.0


def test_extra_comments_lower_precision_but_never_fail_the_case():
    payload = {**GOOD_REVIEW, "comments": GOOD_REVIEW["comments"] + [
        {"file": "src/customers.py", "line": 44, "severity": "info",
         "body": "Missing type hint."}
    ]}
    precision = _named(score_findings(payload, PLANTED), "precision")
    assert precision.value == 0.5
    assert precision.passed, "precision is reported, never gating"


def test_a_clean_fixture_fails_when_a_critical_is_flagged():
    payload = {"comments": [
        {"file": "src/reports.py", "line": 14, "severity": "critical",
         "body": "This will crash."}
    ], "score": 85, "summary": "s"}
    assert not _named(score_findings(payload, CLEAN), "no_false_criticals").passed


def test_a_clean_fixture_passes_with_only_info_comments():
    payload = {"comments": [
        {"file": "src/reports.py", "line": 14, "severity": "info",
         "body": "Nice extraction."}
    ], "score": 90, "summary": "s"}
    results = score_findings(payload, CLEAN)
    assert _named(results, "no_false_criticals").passed
    assert _named(results, "score_in_range").passed


def test_score_outside_the_expected_range_fails():
    payload = {**GOOD_REVIEW, "score": 95}
    assert not _named(score_findings(payload, PLANTED), "score_in_range").passed


# --- triage ---------------------------------------------------------------

INCIDENT = IncidentFixture(
    case_id="001_null_pointer_checkout",
    title="AttributeError",
    stack_trace="...",
    affected_files=("src/payment.py",),
    blame_info={"src/payment.py": "jsmith"},
    expected_severity="P1",
    root_cause_keywords=("null", "payment"),
)


def test_triage_scores_severity_and_root_cause():
    results = score_triage({
        "rootCause": "lookup_payment_method returned a null payment method.",
        "suggestedFix": "Guard the return value.",
        "affectedFiles": ["src/payment.py"],
        "blastRadius": "All checkouts", "severity": "P1",
    }, INCIDENT)
    assert _named(results, "severity_match").passed
    assert _named(results, "root_cause_keywords").value == 1.0


def test_root_cause_coverage_is_a_fraction_not_an_any_match():
    """A root cause naming only some of the expected concepts scores partial
    credit — the metric is coverage, so a baseline can watch it erode."""
    results = score_triage({
        "rootCause": "lookup_payment_method returned None for the user.",
        "suggestedFix": "f", "affectedFiles": [], "blastRadius": "b",
        "severity": "P1",
    }, INCIDENT)
    coverage = _named(results, "root_cause_keywords")
    assert coverage.value == 0.5
    assert coverage.passed, "partial coverage still counts as finding the cause"


def test_triage_fails_on_the_wrong_severity():
    results = score_triage({
        "rootCause": "None returned for payment.", "suggestedFix": "f",
        "affectedFiles": [], "blastRadius": "b", "severity": "P4",
    }, INCIDENT)
    assert not _named(results, "severity_match").passed


# --- budget ---------------------------------------------------------------

def test_budget_passes_inside_the_limits():
    meta = CallMeta("m", input_tokens=1000, output_tokens=400, latency_ms=5000)
    assert all(r.passed for r in score_budget(meta, Budget(8000, 60000)))


def test_budget_fails_on_token_overrun():
    meta = CallMeta("m", input_tokens=9000, output_tokens=400, latency_ms=5000)
    assert not _named(score_budget(meta, Budget(8000, 60000)), "total_tokens").passed


def test_budget_fails_on_latency_overrun():
    meta = CallMeta("m", input_tokens=100, output_tokens=100, latency_ms=99000)
    assert not _named(score_budget(meta, Budget(8000, 60000)), "latency_ms").passed
