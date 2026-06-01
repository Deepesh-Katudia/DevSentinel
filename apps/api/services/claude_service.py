import json
import anthropic
from models.database import settings

_client: anthropic.AsyncAnthropic | None = None


def get_client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        _client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    return _client


async def review_pull_request(
    repo_name: str,
    pr_title: str,
    diff: str,
    max_locs: int = 500,
) -> dict:
    """Send PR diff to Claude for code review. Returns structured JSON.

    Returns: {
        comments: [{file, line, severity, body}],
        score: 0-10,
        summary: str
    }
    """
    # Truncate diff to max_locs lines
    lines = diff.splitlines()
    if len(lines) > max_locs:
        diff = "\n".join(lines[:max_locs]) + f"\n... (truncated {len(lines) - max_locs} lines)"

    message = await get_client().messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2048,
        system=(
            "You are a senior software engineer reviewing a pull request. "
            "Identify bugs, security issues (OWASP top 10), and performance problems. "
            "Respond in structured JSON only — no prose outside the JSON."
        ),
        messages=[
            {
                "role": "user",
                "content": (
                    f"Repository: {repo_name}\n"
                    f"PR Title: {pr_title}\n"
                    f"Diff:\n{diff}\n\n"
                    'Return JSON: {"comments": [{"file": str, "line": int, '
                    '"severity": "critical"|"warning"|"info", "body": str}], '
                    '"score": 0-10, "summary": str}'
                ),
            }
        ],
    )

    raw = message.content[0].text.strip()
    # Strip markdown code fences if present
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
    return json.loads(raw)


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
    member_lines = "\n".join(
        f"  - {m['name']}: {m['prCount']} PRs, avg score {m['avgScore']}/100, "
        f"{m['criticalCount']} critical, {m['warningCount']} warnings"
        for m in member_stats
        if m.get("prCount", 0) > 0
    ) or "  (no PRs reviewed yet)"

    message = await get_client().messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=512,
        system=(
            "You are a senior engineering manager assessing a software team's code quality. "
            "Based on automated PR review stats, provide an honest, constructive assessment. "
            "Respond in structured JSON only — no prose outside the JSON."
        ),
        messages=[{
            "role": "user",
            "content": (
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
        }],
    )

    raw = message.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
    return json.loads(raw)


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
    blame_text = "\n".join(
        f"  {file}: last commit by {author}" for file, author in blame_info.items()
    )

    message = await get_client().messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system=(
            "You are a senior reliability engineer triaging a production incident. "
            "Analyze the error and provide actionable remediation. "
            "Respond in structured JSON only."
        ),
        messages=[
            {
                "role": "user",
                "content": (
                    f"Incident: {title}\n"
                    f"Stack trace:\n{stack_trace}\n"
                    f"Affected files: {', '.join(affected_files)}\n"
                    f"Recent committers:\n{blame_text}\n\n"
                    'Return JSON: {"rootCause": str, "suggestedFix": str, '
                    '"affectedFiles": [str], "blastRadius": str, '
                    '"severity": "P1"|"P2"|"P3"|"P4"}'
                ),
            }
        ],
    )

    raw = message.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
    return json.loads(raw)
