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
