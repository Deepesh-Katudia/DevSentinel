import json
import time
from dataclasses import dataclass

import anthropic
from models.database import settings

REVIEW_MODEL = "claude-sonnet-4-6"
TRIAGE_MODEL = "claude-sonnet-4-6"
TEAM_MODEL = "claude-haiku-4-5-20251001"

REVIEW_MAX_TOKENS = 2048
TRIAGE_MAX_TOKENS = 1024
TEAM_MAX_TOKENS = 512

_client: anthropic.AsyncAnthropic | None = None


def get_client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        _client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    return _client


@dataclass(frozen=True)
class CallMeta:
    """Usage and wall-clock for one Claude round-trip.

    Only the eval harness reads this. The three public functions discard it so
    their callers keep seeing a plain dict.
    """

    model: str
    input_tokens: int
    output_tokens: int
    latency_ms: float

    @property
    def total_tokens(self) -> int:
        return self.input_tokens + self.output_tokens


def _token_count(value: object) -> int:
    """Usage fields are ints in production and mocks in tests. A token count we
    cannot read is a reporting problem, never a reason to fail a good review."""
    return value if isinstance(value, int) and not isinstance(value, bool) else 0


def _parse_payload(text: str) -> dict:
    """Strip a markdown fence if Claude added one, then parse the JSON body."""
    raw = text.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
    return json.loads(raw)


async def _call(
    *, model: str, max_tokens: int, system: str, user: str
) -> tuple[dict, CallMeta]:
    """One Claude call: send, strip fences, parse JSON, record usage and latency.

    Raises json.JSONDecodeError when Claude returns something unparseable —
    the same behaviour callers have always had.
    """
    started = time.perf_counter()
    message = await get_client().messages.create(
        model=model,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    latency_ms = (time.perf_counter() - started) * 1000

    usage = getattr(message, "usage", None)
    meta = CallMeta(
        model=model,
        input_tokens=_token_count(getattr(usage, "input_tokens", 0)),
        output_tokens=_token_count(getattr(usage, "output_tokens", 0)),
        latency_ms=latency_ms,
    )
    return _parse_payload(message.content[0].text), meta


async def review_pull_request_with_meta(
    repo_name: str,
    pr_title: str,
    diff: str,
    max_locs: int = 500,
) -> tuple[dict, CallMeta]:
    """review_pull_request plus the usage/latency the eval harness scores."""
    lines = diff.splitlines()
    if len(lines) > max_locs:
        diff = "\n".join(lines[:max_locs]) + f"\n... (truncated {len(lines) - max_locs} lines)"

    return await _call(
        model=REVIEW_MODEL,
        max_tokens=REVIEW_MAX_TOKENS,
        system=(
            "You are a senior software engineer reviewing a pull request. "
            "Identify bugs, security issues (OWASP top 10), and performance problems. "
            "Respond in structured JSON only — no prose outside the JSON."
        ),
        user=(
            f"Repository: {repo_name}\n"
            f"PR Title: {pr_title}\n"
            f"Diff:\n{diff}\n\n"
            'Return JSON: {"comments": [{"file": str, "line": int, '
            '"severity": "critical"|"warning"|"info", "body": str}], '
            '"score": <integer 0-100, where 100 is flawless and '
            'below 60 means serious problems>, "summary": str}'
        ),
    )


async def review_pull_request(
    repo_name: str,
    pr_title: str,
    diff: str,
    max_locs: int = 500,
) -> dict:
    """Send PR diff to Claude for code review. Returns structured JSON.

    Returns: {
        comments: [{file, line, severity, body}],
        score: 0-100,
        summary: str
    }

    The score is on a 0-100 scale — every consumer (webhook auto-incident
    thresholds, the dashboard's severityFromScore, weekly report averages)
    reads it that way. Do not change the scale without updating all of them.
    """
    payload, _ = await review_pull_request_with_meta(repo_name, pr_title, diff, max_locs)
    return payload


async def analyze_team_quality_with_meta(
    repo_count: int,
    total_prs: int,
    avg_score: float,
    total_critical: int,
    total_warnings: int,
    member_stats: list[dict],
) -> tuple[dict, CallMeta]:
    """analyze_team_quality plus the usage/latency the eval harness scores."""
    member_lines = "\n".join(
        f"  - {m['name']}: {m['prCount']} PRs, avg score {m['avgScore']}/100, "
        f"{m['criticalCount']} critical, {m['warningCount']} warnings"
        for m in member_stats
        if m.get("prCount", 0) > 0
    ) or "  (no PRs reviewed yet)"

    return await _call(
        model=TEAM_MODEL,
        max_tokens=TEAM_MAX_TOKENS,
        system=(
            "You are a senior engineering manager assessing a software team's code quality. "
            "Based on automated PR review stats, provide an honest, constructive assessment. "
            "Respond in structured JSON only — no prose outside the JSON."
        ),
        user=(
            f"Team code quality stats:\n"
            f"  Active repos: {repo_count}\n"
            f"  Total PRs auto-reviewed: {total_prs}\n"
            f"  Team average review score: {avg_score}/100\n"
            f"  Total critical issues caught: {total_critical}\n"
            f"  Total warnings caught: {total_warnings}\n"
            f"Per-engineer breakdown:\n{member_lines}\n\n"
            'Return JSON: {"overallScore": <integer 0-100>, '
            '"grade": <"A+"|"A"|"A-"|"B+"|"B"|"B-"|"C+"|"C"|"C-"|"D"|"F">, '
            '"summary": <2-3 sentence team quality summary string>, '
            '"strengths": [<up to 3 short strength strings>], '
            '"risks": [<up to 3 short risk strings>], '
            '"recommendation": <1 actionable sentence string>}'
        ),
    )


async def analyze_team_quality(
    repo_count: int,
    total_prs: int,
    avg_score: float,
    total_critical: int,
    total_warnings: int,
    member_stats: list[dict],
) -> dict:
    """Ask Claude to assess team code quality based on aggregated PR review stats.

    Returns: {overallScore, grade, summary, strengths, risks, recommendation}
    """
    payload, _ = await analyze_team_quality_with_meta(
        repo_count, total_prs, avg_score, total_critical, total_warnings, member_stats
    )
    return payload


async def triage_incident_with_meta(
    title: str,
    stack_trace: str,
    affected_files: list[str],
    blame_info: dict[str, str],
) -> tuple[dict, CallMeta]:
    """triage_incident plus the usage/latency the eval harness scores."""
    blame_text = "\n".join(
        f"  {file}: last commit by {author}" for file, author in blame_info.items()
    )

    return await _call(
        model=TRIAGE_MODEL,
        max_tokens=TRIAGE_MAX_TOKENS,
        system=(
            "You are a senior reliability engineer triaging a production incident. "
            "Analyze the error and provide actionable remediation. "
            "Respond in structured JSON only."
        ),
        user=(
            f"Incident: {title}\n"
            f"Stack trace:\n{stack_trace}\n"
            f"Affected files: {', '.join(affected_files)}\n"
            f"Recent committers:\n{blame_text}\n\n"
            'Return JSON: {"rootCause": str, "suggestedFix": str, '
            '"affectedFiles": [str], "blastRadius": str, '
            '"severity": "P1"|"P2"|"P3"|"P4"}'
        ),
    )


async def triage_incident(
    title: str,
    stack_trace: str,
    affected_files: list[str],
    blame_info: dict[str, str],
) -> dict:
    """Send incident data to Claude for root cause analysis.

    Returns: {
        rootCause: str,
        suggestedFix: str,
        affectedFiles: [str],
        blastRadius: str,
        severity: "P1"|"P2"|"P3"|"P4"
    }
    """
    payload, _ = await triage_incident_with_meta(
        title, stack_trace, affected_files, blame_info
    )
    return payload
