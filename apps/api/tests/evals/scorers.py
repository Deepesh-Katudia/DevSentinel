"""Scorers for the eval harness.

Every scorer returns ScoreResult(s) so the report writer and the baseline
differ can treat them uniformly. Scoring is keyword- and range-based on
purpose: deterministic, cheap, and needs no judge model. The signature leaves
room for a future score_judge without restructuring anything.
"""
from dataclasses import dataclass

from services.claude_service import CallMeta
from tests.evals.fixtures import ExpectedFinding, IncidentFixture, PRFixture

REVIEW_SEVERITIES = frozenset({"critical", "warning", "info"})
TRIAGE_SEVERITIES = frozenset({"P1", "P2", "P3", "P4"})
TEAM_GRADES = frozenset(
    {"A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D", "F"}
)

# Absolute floor for *aggregate* recall across the whole fixture set, enforced
# once per session by the recorder. Set from the first real run (recall 0.909)
# minus the 0.15 regression tolerance. Raise it as the prompts improve; never
# lower it to make a failing run pass.
RECALL_FLOOR = 0.7


@dataclass(frozen=True)
class ScoreResult:
    name: str
    value: float
    passed: bool
    detail: str


@dataclass(frozen=True)
class Budget:
    max_total_tokens: int
    max_latency_ms: float


# --- contract -------------------------------------------------------------

def _is_int(value: object) -> bool:
    return isinstance(value, int) and not isinstance(value, bool)


def _missing_keys(payload: dict, keys: tuple[str, ...]) -> list[str]:
    return [f"missing key {k!r}" for k in keys if k not in payload]


def _comment_problems(comments: list) -> list[str]:
    problems = []
    for index, comment in enumerate(comments):
        if not isinstance(comment, dict):
            problems.append(f"comments[{index}] is not an object")
            continue
        severity = comment.get("severity")
        if severity not in REVIEW_SEVERITIES:
            problems.append(f"comments[{index}].severity {severity!r} not in {sorted(REVIEW_SEVERITIES)}")
        if not isinstance(comment.get("file"), str):
            problems.append(f"comments[{index}].file must be a string")
        if not _is_int(comment.get("line")):
            problems.append(f"comments[{index}].line must be an integer")
        if not isinstance(comment.get("body"), str):
            problems.append(f"comments[{index}].body must be a string")
    return problems


def _review_problems(payload: dict) -> list[str]:
    problems = _missing_keys(payload, ("comments", "score", "summary"))
    score = payload.get("score")
    if not _is_int(score):
        problems.append(f"score must be an integer, got {score!r}")
    elif not 0 <= score <= 100:
        problems.append(f"score {score} is outside 0-100")
    comments = payload.get("comments")
    if not isinstance(comments, list):
        problems.append(f"comments must be a list, got {type(comments).__name__}")
    else:
        problems.extend(_comment_problems(comments))
    if not isinstance(payload.get("summary"), str):
        problems.append("summary must be a string")
    return problems


def _triage_problems(payload: dict) -> list[str]:
    keys = ("rootCause", "suggestedFix", "affectedFiles", "blastRadius", "severity")
    problems = _missing_keys(payload, keys)
    severity = payload.get("severity")
    if severity not in TRIAGE_SEVERITIES:
        problems.append(f"severity {severity!r} not in {sorted(TRIAGE_SEVERITIES)}")
    for key in ("rootCause", "suggestedFix", "blastRadius"):
        if key in payload and not isinstance(payload[key], str):
            problems.append(f"{key} must be a string")
    if "affectedFiles" in payload and not isinstance(payload["affectedFiles"], list):
        problems.append("affectedFiles must be a list")
    return problems


def _team_problems(payload: dict) -> list[str]:
    keys = ("overallScore", "grade", "summary", "strengths", "risks", "recommendation")
    problems = _missing_keys(payload, keys)
    score = payload.get("overallScore")
    if not _is_int(score):
        problems.append(f"overallScore must be an integer, got {score!r}")
    elif not 0 <= score <= 100:
        problems.append(f"overallScore {score} is outside 0-100")
    grade = payload.get("grade")
    if grade not in TEAM_GRADES:
        problems.append(f"grade {grade!r} not in {sorted(TEAM_GRADES)}")
    for key in ("strengths", "risks"):
        if key in payload and not isinstance(payload[key], list):
            problems.append(f"{key} must be a list")
    return problems


_CONTRACT_CHECKS = {
    "review": _review_problems,
    "triage": _triage_problems,
    "team": _team_problems,
}


def score_contract(payload: object, kind: str) -> ScoreResult:
    """Hard fail: does the payload match the shape every consumer assumes?

    Note what this does *not* catch: reverting the prompt to the old 0-10
    scale was verified against this harness and the contract still passed,
    because a score of 8 is a perfectly valid integer in 0-100. A scale
    collapse is caught by score_findings' score_in_range on the *clean*
    fixtures (a flawless PR scoring 8 fails its 70-100 band) and by the
    aggregate regression check on the mean. Planted-bug fixtures miss it
    entirely -- 2 sits inside their 0-45 band.
    """
    if not isinstance(payload, dict):
        problems = [f"expected a JSON object, got {type(payload).__name__}"]
    else:
        problems = _CONTRACT_CHECKS[kind](payload)

    return ScoreResult(
        name="contract",
        value=0.0 if problems else 1.0,
        passed=not problems,
        detail="; ".join(problems) if problems else f"{kind} payload matches its contract",
    )


# --- findings -------------------------------------------------------------

def _comment_matches(expected: ExpectedFinding, comment: dict) -> bool:
    """Matched on file + line range + any keyword. Severity is deliberately not
    part of the match — models reasonably disagree on critical vs warning."""
    if comment.get("file") != expected.file:
        return False
    line = comment.get("line")
    low, high = expected.line_range
    if not _is_int(line) or not low <= line <= high:
        return False
    body = str(comment.get("body", "")).lower()
    return any(keyword.lower() in body for keyword in expected.keywords)


def _matching_comment(expected: ExpectedFinding, comments: list) -> dict | None:
    for comment in comments:
        if isinstance(comment, dict) and _comment_matches(expected, comment):
            return comment
    return None


def score_findings(payload: dict, fixture: PRFixture) -> list[ScoreResult]:
    """Recall, precision, false-critical rate, and score range for one PR case."""
    comments = [c for c in (payload.get("comments") or []) if isinstance(c, dict)]
    results: list[ScoreResult] = []

    matched = [f for f in fixture.expected_findings if _matching_comment(f, comments)]
    expected_count = len(fixture.expected_findings)
    recall = len(matched) / expected_count if expected_count else 1.0
    results.append(ScoreResult(
        name="recall",
        value=recall,
        # Reported per fixture, gated on the aggregate. A fixture plants a
        # single finding, so its own recall is only ever 0.0 or 1.0 and any
        # floor between them collapses to "must match exactly" -- which makes
        # the 0.15 tolerance meaningless here and turns ordinary line-number
        # drift into a red suite on a different random case every run. The
        # session-wide floor and the baseline comparison both guard the mean,
        # which is where the design puts the signal.
        passed=True,
        detail=f"matched {len(matched)}/{expected_count} planted findings",
    ))

    if expected_count and comments:
        hits = sum(
            1 for c in comments
            if any(_comment_matches(f, c) for f in fixture.expected_findings)
        )
        precision = hits / len(comments)
    else:
        precision = 1.0
    results.append(ScoreResult(
        name="precision",
        value=precision,
        passed=True,  # reported only: extra findings are often real bugs
        detail=f"{len(comments)} comments returned",
    ))

    banned = {s.lower() for s in fixture.must_not_flag}
    offenders = [c for c in comments if str(c.get("severity", "")).lower() in banned]
    results.append(ScoreResult(
        name="no_false_criticals",
        value=0.0 if offenders else 1.0,
        passed=not offenders,
        detail=(
            f"flagged {len(offenders)} comment(s) at a banned severity {sorted(banned)}"
            if offenders else "no banned severities emitted"
        ),
    ))

    score = payload.get("score")
    low, high = fixture.expected_score_range
    in_range = _is_int(score) and low <= score <= high
    results.append(ScoreResult(
        name="score_in_range",
        value=float(score) if _is_int(score) else -1.0,
        passed=in_range,
        detail=f"score {score!r} against expected {low}-{high}",
    ))

    return results


# --- triage ---------------------------------------------------------------

def score_triage(payload: dict, fixture: IncidentFixture) -> list[ScoreResult]:
    """Severity match and root-cause keyword coverage for one incident case."""
    severity = payload.get("severity")
    matched = severity == fixture.expected_severity

    root_cause = str(payload.get("rootCause", "")).lower()
    hits = [k for k in fixture.root_cause_keywords if k.lower() in root_cause]
    coverage = len(hits) / len(fixture.root_cause_keywords) if fixture.root_cause_keywords else 1.0

    return [
        ScoreResult(
            name="severity_match",
            value=1.0 if matched else 0.0,
            passed=matched,
            detail=f"got {severity!r}, expected {fixture.expected_severity!r}",
        ),
        ScoreResult(
            name="root_cause_keywords",
            value=coverage,
            passed=coverage > 0.0,
            detail=f"matched {sorted(hits)} of {sorted(fixture.root_cause_keywords)}",
        ),
    ]


# --- budget ---------------------------------------------------------------

def score_budget(meta: CallMeta, budget: Budget) -> list[ScoreResult]:
    """Token and wall-clock cost for one call."""
    return [
        ScoreResult(
            name="total_tokens",
            value=float(meta.total_tokens),
            passed=meta.total_tokens <= budget.max_total_tokens,
            detail=f"{meta.total_tokens} tokens against a {budget.max_total_tokens} budget",
        ),
        ScoreResult(
            name="latency_ms",
            value=meta.latency_ms,
            passed=meta.latency_ms <= budget.max_latency_ms,
            detail=f"{meta.latency_ms:.0f}ms against a {budget.max_latency_ms:.0f}ms budget",
        ),
    ]
