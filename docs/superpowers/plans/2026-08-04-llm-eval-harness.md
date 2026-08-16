# LLM Eval Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a pytest-native harness that catches broken output contracts, quality regressions, poor review recall, and runaway token cost in DevSentinel's three Claude calls.

**Architecture:** A new `apps/api/tests/evals/` package sitting beside the existing suite, gated behind a `pytest -m eval` marker so the default run stays offline and free. `claude_service.py` gains a shared `_call()` helper that captures token usage and latency, plus a `*_with_meta` variant of each public function so the harness exercises the real production prompts rather than copies of them. Fixtures are plain files on disk (`diff.patch` + `labels.json`); scoring is keyword- and range-based, so it is deterministic and needs no judge model.

**Tech Stack:** Python 3.x, pytest 8.3.2, pytest-asyncio 0.23.8 (`asyncio_mode = auto`), `anthropic` 0.34.2. Standard library only for the harness itself (`json`, `pathlib`, `dataclasses`, `statistics`, `time`).

## Global Constraints

- **No new production dependencies.** The harness imports only the standard library and packages already in `apps/api/requirements.txt`.
- **The default `pytest` run must stay offline, free, and green.** All 36 existing tests pass unchanged, with no network access and no real API key.
- **Public signatures of `review_pull_request`, `analyze_team_quality`, and `triage_incident` do not change.** `routers/webhooks.py`, `routers/incidents.py`, and `services/report_service.py` are not touched by this plan.
- **Files stay under 400 lines; functions stay under 50 lines.** Split rather than grow.
- **All commands run from `apps/api/`** using the repo venv: `./.venv/Scripts/python.exe -m pytest ...`.
- **Score scale is 0–100.** Already fixed in commit `f557aba`; the contract scorer enforces it.
- **Models are not changed by this plan.** `review_pull_request` and `triage_incident` stay on `claude-sonnet-4-6`; `analyze_team_quality` stays on `claude-haiku-4-5-20251001`. Bumping them is a follow-on that this harness exists to make safe.

---

## Deviations from the spec (and why)

Three intentional departures from `docs/superpowers/specs/2026-08-04-llm-eval-harness-design.md`. Each is a judgment call made after reading the source; flag them at review.

**1. Fixtures use JSON, not YAML.** The spec specifies `labels.yaml` / `incident.yaml`. PyYAML is **not** in `requirements.txt` — it is present in the venv only because `huggingface_hub` pulled it in transitively. Depending on it would either rest on an accident or force a new dependency, contradicting the spec's own "No new production dependencies." JSON needs nothing. The one thing YAML bought us was multi-line blocks for stack traces, and the spec had already chosen a separate `diff.patch` file for the same reason — so incidents get a separate `stack_trace.txt` the same way. Format is otherwise field-for-field identical to the spec.

**2. A `*_with_meta` layer above `_call()`.** The spec says "The harness calls `_call()` directly to read usage and latency." But `_call()` takes a fully-built `system` and `user` string, so a harness calling it directly would have to rebuild each prompt — reintroducing exactly the prompt-duplication drift the spec rejected promptfoo for. Instead each public function's body moves into `<name>_with_meta()` returning `(payload, CallMeta)`, and the public function becomes a one-line unwrap. Zero duplication, unchanged public signatures, and the harness runs the real production prompt.

**3. Three modules where the spec named two.** The spec put everything in `conftest.py` + `scorers.py`. Fixture loading (`fixtures.py`) and baseline I/O (`baseline.py`) are split out — each has one clear responsibility and its own offline unit tests, and it keeps `conftest.py` from carrying three unrelated jobs.

---

## File Structure

```
apps/api/
  pytest.ini                            MODIFY  eval marker + default exclusion
  services/claude_service.py            MODIFY  _call() + CallMeta + *_with_meta
  tests/
    test_claude_call.py                 CREATE  offline unit tests for _call/CallMeta
    evals/
      __init__.py                       CREATE  makes `tests.evals` importable
      conftest.py                       CREATE  API-key gate, budgets, gating mode, recorder
      fixtures.py                       CREATE  fixture dataclasses + loaders
      scorers.py                        CREATE  contract / findings / budget scorers
      baseline.py                       CREATE  baseline load, summarize, compare, write
      test_fixtures_unit.py             CREATE  offline tests for the loader
      test_scorers_unit.py              CREATE  offline tests for the scorers
      test_baseline_unit.py             CREATE  offline tests for baseline compare
      test_review_eval.py               CREATE  eval-marked: review_pull_request
      test_triage_eval.py               CREATE  eval-marked: triage_incident
      test_team_eval.py                 CREATE  eval-marked: analyze_team_quality
      baseline.json                     CREATE  committed, written by Task 9
      fixtures/
        prs/<case>/diff.patch           CREATE  11 cases (8 planted-bug, 3 clean)
        prs/<case>/labels.json
        incidents/<case>/incident.json  CREATE  4 cases
        incidents/<case>/stack_trace.txt
.gitignore                              MODIFY  ignore last_run.json
```

The three `*_unit.py` modules are **not** eval-marked — they run in the default offline suite and are what keeps the harness itself honest.

---

### Task 1: `_call()` helper, `CallMeta`, and the `*_with_meta` layer

**Files:**
- Modify: `apps/api/services/claude_service.py`
- Test: `apps/api/tests/test_claude_call.py` (create)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `CallMeta(model: str, input_tokens: int, output_tokens: int, latency_ms: float)` — frozen dataclass
  - `async _call(*, model: str, max_tokens: int, system: str, user: str) -> tuple[dict, CallMeta]`
  - `async review_pull_request_with_meta(repo_name: str, pr_title: str, diff: str, max_locs: int = 500) -> tuple[dict, CallMeta]`
  - `async triage_incident_with_meta(title: str, stack_trace: str, affected_files: list[str], blame_info: dict[str, str]) -> tuple[dict, CallMeta]`
  - `async analyze_team_quality_with_meta(repo_count: int, total_prs: int, avg_score: float, total_critical: int, total_warnings: int, member_stats: list[dict]) -> tuple[dict, CallMeta]`
  - Module constants `REVIEW_MODEL`, `TRIAGE_MODEL`, `TEAM_MODEL`, `REVIEW_MAX_TOKENS`, `TRIAGE_MAX_TOKENS`, `TEAM_MAX_TOKENS`

- [ ] **Step 1: Write the failing test**

Create `apps/api/tests/test_claude_call.py`:

```python
import json
import os
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379")
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-jwt-secret")
os.environ.setdefault("ANTHROPIC_API_KEY", "sk-ant-mock")
os.environ.setdefault("GITHUB_APP_ID", "12345")
os.environ.setdefault("GITHUB_WEBHOOK_SECRET", "test-webhook-secret")
os.environ.setdefault("SENTRY_WEBHOOK_SECRET", "test-sentry-secret")
os.environ.setdefault("STRIPE_SECRET_KEY", "sk_test_mock")
os.environ.setdefault("STRIPE_WEBHOOK_SECRET", "whsec_mock")


def _mock_client(text: str, input_tokens=1200, output_tokens=340):
    """An AsyncAnthropic stand-in whose response carries a realistic usage block."""
    message = MagicMock()
    message.content = [MagicMock(text=text)]
    message.usage = MagicMock(input_tokens=input_tokens, output_tokens=output_tokens)
    client = AsyncMock()
    client.messages.create = AsyncMock(return_value=message)
    return client


@pytest.mark.asyncio
async def test_call_returns_parsed_payload_and_usage():
    with patch("services.claude_service.get_client") as get_client:
        get_client.return_value = _mock_client('{"ok": true}')

        from services.claude_service import _call
        payload, meta = await _call(
            model="claude-sonnet-4-6", max_tokens=512, system="sys", user="usr"
        )

    assert payload == {"ok": True}
    assert meta.model == "claude-sonnet-4-6"
    assert meta.input_tokens == 1200
    assert meta.output_tokens == 340
    assert meta.latency_ms > 0


@pytest.mark.asyncio
async def test_call_strips_markdown_fences():
    fenced = "```json\n" + json.dumps({"score": 65}) + "\n```"
    with patch("services.claude_service.get_client") as get_client:
        get_client.return_value = _mock_client(fenced)

        from services.claude_service import _call
        payload, _ = await _call(model="m", max_tokens=1, system="s", user="u")

    assert payload == {"score": 65}


@pytest.mark.asyncio
async def test_call_tolerates_a_usage_block_without_integer_counts():
    """MagicMock attributes are not ints. Never let a bad token count fail a
    review that Claude actually answered correctly."""
    message = MagicMock()
    message.content = [MagicMock(text='{"ok": true}')]
    client = AsyncMock()
    client.messages.create = AsyncMock(return_value=message)

    with patch("services.claude_service.get_client") as get_client:
        get_client.return_value = client

        from services.claude_service import _call
        payload, meta = await _call(model="m", max_tokens=1, system="s", user="u")

    assert payload == {"ok": True}
    assert meta.input_tokens == 0
    assert meta.output_tokens == 0


@pytest.mark.asyncio
async def test_review_with_meta_uses_the_production_prompt_and_reports_usage():
    review = {"comments": [], "score": 88, "summary": "Clean."}
    client = _mock_client(json.dumps(review))

    with patch("services.claude_service.get_client") as get_client:
        get_client.return_value = client

        from services.claude_service import review_pull_request_with_meta, REVIEW_MODEL
        payload, meta = await review_pull_request_with_meta(
            "acme/api", "fix: null check", "diff --git a/x.py b/x.py"
        )

    assert payload["score"] == 88
    assert meta.model == REVIEW_MODEL
    assert meta.input_tokens == 1200

    sent = client.messages.create.await_args.kwargs
    assert sent["model"] == REVIEW_MODEL
    assert "OWASP" in sent["system"]
    assert "0-100" in sent["messages"][0]["content"]
    assert "acme/api" in sent["messages"][0]["content"]


@pytest.mark.asyncio
async def test_public_review_still_returns_a_bare_dict():
    """webhooks.py reads review["score"] directly — the wrapper must not leak a tuple."""
    review = {"comments": [], "score": 88, "summary": "Clean."}
    with patch("services.claude_service.get_client") as get_client:
        get_client.return_value = _mock_client(json.dumps(review))

        from services.claude_service import review_pull_request
        result = await review_pull_request("acme/api", "t", "d")

    assert isinstance(result, dict)
    assert result["score"] == 88
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `./.venv/Scripts/python.exe -m pytest tests/test_claude_call.py -v`
Expected: FAIL — `ImportError: cannot import name '_call' from 'services.claude_service'`

- [ ] **Step 3: Add the constants, `CallMeta`, and `_call()`**

In `apps/api/services/claude_service.py`, replace the imports and `get_client` block (lines 1–12) with:

```python
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
```

- [ ] **Step 4: Rewrite `review_pull_request` on top of `_call()`**

Replace the whole `review_pull_request` function (old lines 15–66) with:

```python
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
```

- [ ] **Step 5: Rewrite `analyze_team_quality` the same way**

Replace the whole `analyze_team_quality` function with:

```python
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
```

- [ ] **Step 6: Rewrite `triage_incident` the same way**

Replace the whole `triage_incident` function with:

```python
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
```

- [ ] **Step 7: Run the new tests**

Run: `./.venv/Scripts/python.exe -m pytest tests/test_claude_call.py -v`
Expected: PASS — 5 passed

- [ ] **Step 8: Run the whole suite to prove the refactor broke nothing**

Run: `./.venv/Scripts/python.exe -m pytest -q`
Expected: PASS — 41 passed (36 existing + 5 new). If `test_claude_service.py` fails, the refactor changed observable behaviour; fix the refactor, not the test.

- [ ] **Step 9: Commit**

```bash
git add apps/api/services/claude_service.py apps/api/tests/test_claude_call.py
git commit -m "refactor: extract _call() helper and capture Claude usage metrics

The fence-strip + json.loads block was copy-pasted three times and
message.usage was thrown away, so nothing could measure what a review
costs. Extract one _call() that parses the payload and returns a
CallMeta with model, token counts, and wall-clock latency.

Each public function's body moves into a <name>_with_meta() coroutine
returning (payload, CallMeta); the public function is now a one-line
unwrap. The eval harness calls the _with_meta variant so it exercises
the real production prompt instead of a copy that would drift.

Public signatures and return types are unchanged, so webhooks.py,
report_service.py, and routers/incidents.py are untouched. 41 passed."
```

---

### Task 2: eval marker, package skeleton, and the real-API-key gate

**Files:**
- Modify: `apps/api/pytest.ini`
- Modify: `.gitignore` (repo root)
- Create: `apps/api/tests/evals/__init__.py`
- Create: `apps/api/tests/evals/conftest.py`
- Create: `apps/api/tests/evals/test_gate_smoke.py` (temporary, deleted in Step 7)

**Interfaces:**
- Consumes: `services.claude_service` (to reset the cached client).
- Produces:
  - pytest marker `eval`, and `addopts = -m "not eval"` so the default run excludes it
  - `--eval-update-baseline` CLI flag
  - session fixtures `evals_dir`, `fixtures_dir`, `baseline_path`, `budgets`
  - autouse session fixture that skips every eval test when no real key is present

- [ ] **Step 1: Write the failing test**

Create `apps/api/tests/evals/__init__.py` (empty file) and `apps/api/tests/evals/test_gate_smoke.py`:

```python
"""Temporary: proves the marker and the API-key gate behave. Deleted in Step 7."""
import pytest

pytestmark = pytest.mark.eval


def test_gate_lets_us_through():
    assert True
```

- [ ] **Step 2: Run it to verify the marker does not exist yet**

Run: `./.venv/Scripts/python.exe -m pytest tests/evals/ -v`
Expected: the test RUNS (rather than being excluded or skipped) and pytest emits `PytestUnknownMarkWarning: Unknown pytest.mark.eval`. That warning is the failure signal — the marker is not registered and nothing is gating the run.

- [ ] **Step 3: Register the marker and exclude it by default**

Replace the entire contents of `apps/api/pytest.ini`:

```ini
[pytest]
asyncio_mode = auto
markers =
    eval: hits the real Anthropic API and costs money
addopts = -m "not eval"
```

- [ ] **Step 4: Write the eval conftest**

Create `apps/api/tests/evals/conftest.py`:

```python
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


@pytest.fixture(scope="session", autouse=True)
def require_real_api_key():
    """Skip the whole package unless a real ANTHROPIC_API_KEY is exported.

    Runs before any eval test so an accidental `pytest -m eval` costs nothing
    and reports why it did nothing, instead of failing on a 401.
    """
    key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not key or key.startswith(MOCK_KEY_SENTINEL):
        pytest.skip(
            "No real ANTHROPIC_API_KEY exported (found "
            f"{key or '<unset>'!r}). Export a real key to run the evals.",
            allow_module_level=True,
        )

    # The offline tests never build a client (they patch get_client), but reset
    # the cached one anyway so we can never inherit a mock-key client.
    from services import claude_service
    claude_service._client = None
```

- [ ] **Step 5: Ignore the run report**

Append to `.gitignore` at the repo root:

```
# Eval harness run report — regenerated on every `pytest -m eval`
apps/api/tests/evals/last_run.json
```

- [ ] **Step 6: Verify all three behaviours**

Run: `./.venv/Scripts/python.exe -m pytest -q`
Expected: 41 passed — the eval smoke test is **not** collected (excluded by `addopts`).

Run: `./.venv/Scripts/python.exe -m pytest -m eval -q`
Expected: 1 skipped, with the reason naming the missing/mock key. No `PytestUnknownMarkWarning`.

Run: `./.venv/Scripts/python.exe -m pytest -m eval --collect-only -q`
Expected: `tests/evals/test_gate_smoke.py::test_gate_lets_us_through` is listed — confirming the CLI `-m eval` overrides `addopts`.

- [ ] **Step 7: Delete the temporary smoke test**

```bash
rm apps/api/tests/evals/test_gate_smoke.py
```

Run: `./.venv/Scripts/python.exe -m pytest -q`
Expected: 41 passed.

- [ ] **Step 8: Commit**

```bash
git add apps/api/pytest.ini apps/api/tests/evals/__init__.py apps/api/tests/evals/conftest.py .gitignore
git commit -m "test: add eval marker and gate evals behind a real API key

pytest.ini registers an 'eval' marker and excludes it by default, so the
normal run stays offline and free exactly as before. 'pytest -m eval'
opts in.

tests/evals/conftest.py skips the entire package when ANTHROPIC_API_KEY
is unset or still holds the sk-ant-mock sentinel the offline tests seed,
so an accidental eval run costs nothing and says why it did nothing
instead of failing on a 401. Also adds the --eval-update-baseline flag
and the shared path/budget fixtures."
```

---

### Task 3: fixture loader and the first four fixtures

**Files:**
- Create: `apps/api/tests/evals/fixtures.py`
- Create: `apps/api/tests/evals/test_fixtures_unit.py`
- Create: `apps/api/tests/evals/fixtures/prs/001_sql_injection/{diff.patch,labels.json}`
- Create: `apps/api/tests/evals/fixtures/prs/002_missing_null_check/{diff.patch,labels.json}`
- Create: `apps/api/tests/evals/fixtures/prs/009_clean_refactor/{diff.patch,labels.json}`
- Create: `apps/api/tests/evals/fixtures/incidents/001_null_pointer_checkout/{incident.json,stack_trace.txt}`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `ExpectedFinding(file: str, line_range: tuple[int, int], severity: str, keywords: tuple[str, ...])`
  - `PRFixture(case_id, repo, title, diff, expected_findings, expected_score_range, must_not_flag)`
  - `IncidentFixture(case_id, title, stack_trace, affected_files, blame_info, expected_severity, root_cause_keywords)`
  - `load_pr_fixtures(fixtures_dir: Path) -> list[PRFixture]` — sorted by `case_id`
  - `load_incident_fixtures(fixtures_dir: Path) -> list[IncidentFixture]` — sorted by `case_id`

- [ ] **Step 1: Write the failing test**

Create `apps/api/tests/evals/test_fixtures_unit.py`:

```python
"""Offline tests for the fixture loader. Not eval-marked — these run in the
default suite so a malformed fixture fails fast without spending money."""
import json
import pytest

from tests.evals.fixtures import (
    ExpectedFinding,
    load_incident_fixtures,
    load_pr_fixtures,
)


def _write_pr(root, case_id, labels, diff="diff --git a/x.py b/x.py\n"):
    case = root / "prs" / case_id
    case.mkdir(parents=True)
    (case / "diff.patch").write_text(diff, encoding="utf-8")
    (case / "labels.json").write_text(json.dumps(labels), encoding="utf-8")


def test_loads_a_planted_bug_fixture(tmp_path):
    _write_pr(tmp_path, "001_sql_injection", {
        "repo": "acme/payments",
        "title": "feat: customer lookup",
        "expected_findings": [{
            "file": "src/customers.py",
            "line_range": [43, 47],
            "severity": "critical",
            "keywords": ["sql", "injection"],
        }],
        "expected_score_range": [0, 45],
        "must_not_flag": [],
    })

    fixtures = load_pr_fixtures(tmp_path)

    assert len(fixtures) == 1
    fixture = fixtures[0]
    assert fixture.case_id == "001_sql_injection"
    assert fixture.repo == "acme/payments"
    assert fixture.diff.startswith("diff --git")
    assert fixture.expected_findings == (
        ExpectedFinding("src/customers.py", (43, 47), "critical", ("sql", "injection")),
    )
    assert fixture.expected_score_range == (0, 45)
    assert fixture.must_not_flag == ()


def test_loads_a_clean_fixture_with_no_planted_findings(tmp_path):
    _write_pr(tmp_path, "009_clean_refactor", {
        "repo": "acme/api",
        "title": "refactor: extract helper",
        "expected_findings": [],
        "expected_score_range": [70, 100],
        "must_not_flag": ["critical"],
    })

    fixture = load_pr_fixtures(tmp_path)[0]

    assert fixture.expected_findings == ()
    assert fixture.must_not_flag == ("critical",)
    assert fixture.expected_score_range == (70, 100)


def test_fixtures_are_returned_in_case_id_order(tmp_path):
    for case_id in ("003_c", "001_a", "002_b"):
        _write_pr(tmp_path, case_id, {
            "repo": "r", "title": "t", "expected_findings": [],
            "expected_score_range": [0, 100], "must_not_flag": [],
        })

    assert [f.case_id for f in load_pr_fixtures(tmp_path)] == ["001_a", "002_b", "003_c"]


def test_missing_labels_file_names_the_case(tmp_path):
    (tmp_path / "prs" / "004_broken").mkdir(parents=True)
    (tmp_path / "prs" / "004_broken" / "diff.patch").write_text("x", encoding="utf-8")

    with pytest.raises(FileNotFoundError, match="004_broken"):
        load_pr_fixtures(tmp_path)


def test_loads_an_incident_fixture(tmp_path):
    case = tmp_path / "incidents" / "001_null_pointer_checkout"
    case.mkdir(parents=True)
    (case / "stack_trace.txt").write_text(
        'Traceback (most recent call last):\n  File "src/payment.py", line 87\n',
        encoding="utf-8",
    )
    (case / "incident.json").write_text(json.dumps({
        "title": "NullPointerException in checkout",
        "affected_files": ["src/payment.py"],
        "blame_info": {"src/payment.py": "jsmith"},
        "expected_severity": "P1",
        "root_cause_keywords": ["null", "payment"],
    }), encoding="utf-8")

    fixture = load_incident_fixtures(tmp_path)[0]

    assert fixture.case_id == "001_null_pointer_checkout"
    assert fixture.expected_severity == "P1"
    assert "src/payment.py" in fixture.stack_trace
    assert fixture.affected_files == ("src/payment.py",)
    assert fixture.blame_info == {"src/payment.py": "jsmith"}
    assert fixture.root_cause_keywords == ("null", "payment")


def test_empty_fixture_root_returns_nothing(tmp_path):
    assert load_pr_fixtures(tmp_path) == []
    assert load_incident_fixtures(tmp_path) == []
```

- [ ] **Step 2: Run to verify it fails**

Run: `./.venv/Scripts/python.exe -m pytest tests/evals/test_fixtures_unit.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'tests.evals.fixtures'`

- [ ] **Step 3: Write the loader**

Create `apps/api/tests/evals/fixtures.py`:

```python
"""Ground-truth fixtures for the eval harness.

A PR case is a directory holding the raw `diff.patch` we feed Claude and a
`labels.json` describing what a correct review of it looks like. Incidents
follow the same split: `stack_trace.txt` for the raw text, `incident.json` for
the expectations.

Everything is plain JSON and plain text so scoring stays deterministic and the
harness needs no dependency beyond the standard library.
"""
import json
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class ExpectedFinding:
    """One bug we planted, and what a review that caught it looks like.

    `line_range` is a range rather than an exact line because models drift a
    line or two either side of the real defect. `keywords` is any-match and
    case-insensitive.
    """

    file: str
    line_range: tuple[int, int]
    severity: str
    keywords: tuple[str, ...]


@dataclass(frozen=True)
class PRFixture:
    case_id: str
    repo: str
    title: str
    diff: str
    expected_findings: tuple[ExpectedFinding, ...]
    expected_score_range: tuple[int, int]
    must_not_flag: tuple[str, ...]

    @property
    def is_clean(self) -> bool:
        return not self.expected_findings


@dataclass(frozen=True)
class IncidentFixture:
    case_id: str
    title: str
    stack_trace: str
    affected_files: tuple[str, ...]
    blame_info: dict[str, str]
    expected_severity: str
    root_cause_keywords: tuple[str, ...]


def _read_json(case_dir: Path, name: str) -> dict:
    path = case_dir / name
    if not path.exists():
        raise FileNotFoundError(f"fixture {case_dir.name!r} is missing {name}")
    return json.loads(path.read_text(encoding="utf-8"))


def _read_text(case_dir: Path, name: str) -> str:
    path = case_dir / name
    if not path.exists():
        raise FileNotFoundError(f"fixture {case_dir.name!r} is missing {name}")
    return path.read_text(encoding="utf-8")


def _case_dirs(root: Path) -> list[Path]:
    if not root.exists():
        return []
    return sorted(d for d in root.iterdir() if d.is_dir())


def _to_finding(raw: dict) -> ExpectedFinding:
    low, high = raw["line_range"]
    return ExpectedFinding(
        file=raw["file"],
        line_range=(int(low), int(high)),
        severity=raw["severity"],
        keywords=tuple(raw["keywords"]),
    )


def load_pr_fixtures(fixtures_dir: Path) -> list[PRFixture]:
    """Load every PR case under `<fixtures_dir>/prs/`, ordered by case id."""
    out = []
    for case_dir in _case_dirs(fixtures_dir / "prs"):
        labels = _read_json(case_dir, "labels.json")
        low, high = labels["expected_score_range"]
        out.append(PRFixture(
            case_id=case_dir.name,
            repo=labels["repo"],
            title=labels["title"],
            diff=_read_text(case_dir, "diff.patch"),
            expected_findings=tuple(
                _to_finding(f) for f in labels.get("expected_findings", [])
            ),
            expected_score_range=(int(low), int(high)),
            must_not_flag=tuple(labels.get("must_not_flag", [])),
        ))
    return out


def load_incident_fixtures(fixtures_dir: Path) -> list[IncidentFixture]:
    """Load every incident case under `<fixtures_dir>/incidents/`, ordered by case id."""
    out = []
    for case_dir in _case_dirs(fixtures_dir / "incidents"):
        data = _read_json(case_dir, "incident.json")
        out.append(IncidentFixture(
            case_id=case_dir.name,
            title=data["title"],
            stack_trace=_read_text(case_dir, "stack_trace.txt"),
            affected_files=tuple(data["affected_files"]),
            blame_info=dict(data["blame_info"]),
            expected_severity=data["expected_severity"],
            root_cause_keywords=tuple(data["root_cause_keywords"]),
        ))
    return out
```

- [ ] **Step 4: Run the loader tests**

Run: `./.venv/Scripts/python.exe -m pytest tests/evals/test_fixtures_unit.py -v`
Expected: PASS — 6 passed

- [ ] **Step 5: Write the SQL injection fixture**

`apps/api/tests/evals/fixtures/prs/001_sql_injection/diff.patch`:

```
diff --git a/src/customers.py b/src/customers.py
index 3f1c2ab..9e4d7c1 100644
--- a/src/customers.py
+++ b/src/customers.py
@@ -38,6 +38,14 @@ from db import connection
 def get_customer(customer_id: str) -> dict | None:
     with connection() as conn:
         return conn.execute(SELECT_CUSTOMER, (customer_id,)).fetchone()
+
+
+def search_customers(name: str) -> list[dict]:
+    """Look up customers by display name."""
+    query = "SELECT id, name, email FROM customers WHERE name LIKE '%" + name + "%'"
+    with connection() as conn:
+        return conn.execute(query).fetchall()
```

The concatenated `query` lands on new-file line 45; the range below allows the usual +/-2 drift.

`apps/api/tests/evals/fixtures/prs/001_sql_injection/labels.json`:

```json
{
  "repo": "acme/payments",
  "title": "feat: add customer search endpoint",
  "expected_findings": [
    {
      "file": "src/customers.py",
      "line_range": [43, 47],
      "severity": "critical",
      "keywords": ["sql", "injection", "parameteriz", "sanitiz"]
    }
  ],
  "expected_score_range": [0, 45],
  "must_not_flag": []
}
```

- [ ] **Step 6: Write the missing-null-check fixture**

`apps/api/tests/evals/fixtures/prs/002_missing_null_check/diff.patch`:

```
diff --git a/src/checkout.py b/src/checkout.py
index a1b2c3d..d4e5f6a 100644
--- a/src/checkout.py
+++ b/src/checkout.py
@@ -20,5 +20,11 @@ from billing import lookup_payment_method
 def summarize_cart(cart):
     return {"items": len(cart.items), "total": cart.total}
+
+
+def charge(order):
+    method = lookup_payment_method(order.user_id)
+    return method.charge(order.total)
```

`lookup_payment_method` can return `None`; `method.charge` is on new-file line 27.

`apps/api/tests/evals/fixtures/prs/002_missing_null_check/labels.json`:

```json
{
  "repo": "acme/payments",
  "title": "feat: charge order on checkout",
  "expected_findings": [
    {
      "file": "src/checkout.py",
      "line_range": [25, 29],
      "severity": "critical",
      "keywords": ["none", "null", "attributeerror", "check"]
    }
  ],
  "expected_score_range": [0, 55],
  "must_not_flag": []
}
```

- [ ] **Step 7: Write the first clean fixture**

`apps/api/tests/evals/fixtures/prs/009_clean_refactor/diff.patch`:

```
diff --git a/src/reports.py b/src/reports.py
index 7a8b9c0..1d2e3f4 100644
--- a/src/reports.py
+++ b/src/reports.py
@@ -12,9 +12,13 @@ from statistics import mean
-def weekly_summary(reviews):
-    scores = [r.score for r in reviews if r.score is not None]
-    average = sum(scores) / len(scores) if scores else 0.0
-    return {"count": len(reviews), "average": average}
+def _average_score(reviews) -> float:
+    scores = [r.score for r in reviews if r.score is not None]
+    return mean(scores) if scores else 0.0
+
+
+def weekly_summary(reviews) -> dict:
+    return {"count": len(reviews), "average": _average_score(reviews)}
```

A behaviour-preserving extraction with the empty case still handled — nothing here is a defect.

`apps/api/tests/evals/fixtures/prs/009_clean_refactor/labels.json`:

```json
{
  "repo": "acme/api",
  "title": "refactor: extract average score helper",
  "expected_findings": [],
  "expected_score_range": [70, 100],
  "must_not_flag": ["critical"]
}
```

- [ ] **Step 8: Write the first incident fixture**

`apps/api/tests/evals/fixtures/incidents/001_null_pointer_checkout/stack_trace.txt`:

```
Traceback (most recent call last):
  File "src/api/routes.py", line 142, in post_checkout
    return process(order)
  File "src/payment.py", line 87, in process
    return method.charge(order.total)
AttributeError: 'NoneType' object has no attribute 'charge'
```

`apps/api/tests/evals/fixtures/incidents/001_null_pointer_checkout/incident.json`:

```json
{
  "title": "AttributeError: 'NoneType' object has no attribute 'charge'",
  "affected_files": ["src/payment.py", "src/api/routes.py"],
  "blame_info": {
    "src/payment.py": "jsmith",
    "src/api/routes.py": "adevi"
  },
  "expected_severity": "P1",
  "root_cause_keywords": ["none", "null", "payment", "charge"]
}
```

- [ ] **Step 9: Prove the real fixtures load**

Run:
```bash
./.venv/Scripts/python.exe -c "from pathlib import Path; import sys; sys.path.insert(0, '.'); from tests.evals.fixtures import load_pr_fixtures, load_incident_fixtures; d = Path('tests/evals/fixtures'); prs = load_pr_fixtures(d); inc = load_incident_fixtures(d); print([f.case_id for f in prs]); print([f.case_id for f in inc])"
```
Expected: `['001_sql_injection', '002_missing_null_check', '009_clean_refactor']` and `['001_null_pointer_checkout']`

Run: `./.venv/Scripts/python.exe -m pytest -q`
Expected: 47 passed (41 + 6 loader tests)

- [ ] **Step 10: Commit**

```bash
git add apps/api/tests/evals/fixtures.py apps/api/tests/evals/test_fixtures_unit.py apps/api/tests/evals/fixtures/
git commit -m "test: add eval fixture format and loader

Each PR case is a directory holding the raw diff.patch we send Claude
plus a labels.json describing what catching the planted bug looks like:
file, a line range (models drift a line or two off the real defect), and
any-match keywords. Incidents split the same way into stack_trace.txt
and incident.json.

JSON rather than the YAML the design sketched: PyYAML is not in
requirements.txt (it is only in the venv via huggingface_hub), and
adding it would contradict the design's own no-new-dependencies rule.
Splitting the stack trace into its own file mirrors what the design
already did for diffs.

Three PR cases and one incident case land here to exercise the loader;
the rest follow. The loader tests are not eval-marked, so a malformed
fixture fails in the free offline run rather than mid-spend."
```

---

### Task 4: scorers

**Files:**
- Create: `apps/api/tests/evals/scorers.py`
- Create: `apps/api/tests/evals/test_scorers_unit.py`

**Interfaces:**
- Consumes: `PRFixture`, `IncidentFixture`, `ExpectedFinding` from Task 3; `CallMeta` from Task 1.
- Produces:
  - `ScoreResult(name: str, value: float, passed: bool, detail: str)`
  - `Budget(max_total_tokens: int, max_latency_ms: float)`
  - `score_contract(payload: dict, kind: str) -> ScoreResult` where `kind` is `"review" | "triage" | "team"`
  - `score_findings(payload: dict, fixture: PRFixture) -> list[ScoreResult]`
  - `score_triage(payload: dict, fixture: IncidentFixture) -> list[ScoreResult]`
  - `score_budget(meta: CallMeta, budget: Budget) -> list[ScoreResult]`
  - `RECALL_FLOOR = 0.6` — provisional; Task 9 replaces it with a baseline-derived value

- [ ] **Step 1: Write the failing test**

Create `apps/api/tests/evals/test_scorers_unit.py`:

```python
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
        "rootCause": "lookup_payment_method returned None for the user.",
        "suggestedFix": "Guard the return value.",
        "affectedFiles": ["src/payment.py"],
        "blastRadius": "All checkouts", "severity": "P1",
    }, INCIDENT)
    assert _named(results, "severity_match").passed
    assert _named(results, "root_cause_keywords").value == 1.0


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
```

- [ ] **Step 2: Run to verify it fails**

Run: `./.venv/Scripts/python.exe -m pytest tests/evals/test_scorers_unit.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'tests.evals.scorers'`

- [ ] **Step 3: Write the scorers**

Create `apps/api/tests/evals/scorers.py`:

```python
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

# Provisional. Task 9 replaces this with (first run's recall - tolerance);
# until baseline.json exists the harness reports without failing anyway.
RECALL_FLOOR = 0.6


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

    This is the check that would have caught the 0-10 score scale bug.
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
        passed=recall >= RECALL_FLOOR,
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
```

- [ ] **Step 4: Run the scorer tests**

Run: `./.venv/Scripts/python.exe -m pytest tests/evals/test_scorers_unit.py -v`
Expected: PASS — 22 passed

- [ ] **Step 5: Run the full offline suite**

Run: `./.venv/Scripts/python.exe -m pytest -q`
Expected: 69 passed

- [ ] **Step 6: Commit**

```bash
git add apps/api/tests/evals/scorers.py apps/api/tests/evals/test_scorers_unit.py
git commit -m "test: add contract, findings, triage, and budget scorers

score_contract is the hard fail: it checks every key, severity enum, and
numeric range each consumer already assumes. Its score 0-100 assertion is
exactly the check that would have caught the 0-10 scale bug before it
manufactured a P1 on every clean PR.

score_findings computes recall over planted bugs matched on file, line
range, and any keyword. Severity is deliberately not part of the match --
models reasonably disagree on critical vs warning. Precision is reported
but never gates, because extra findings are frequently real. Clean
fixtures gate on emitting no critical at all, which is the only way to
measure false positives.

score_triage and score_budget follow the same ScoreResult shape so the
report writer and baseline differ treat every metric uniformly."
```

---

### Task 5: baseline storage and comparison

**Files:**
- Create: `apps/api/tests/evals/baseline.py`
- Create: `apps/api/tests/evals/test_baseline_unit.py`

**Interfaces:**
- Consumes: `ScoreResult` from Task 4.
- Produces:
  - `TOLERANCES: dict[str, dict]` — per-metric drift allowance
  - `summarize(results: list[ScoreResult]) -> dict[str, float]` — mean of each metric name
  - `load_baseline(path: Path) -> dict | None` — `None` when the file is absent
  - `compare(current: dict, baseline: dict) -> list[ScoreResult]`
  - `write_baseline(path: Path, metrics: dict, meta: dict) -> None`

- [ ] **Step 1: Write the failing test**

Create `apps/api/tests/evals/test_baseline_unit.py`:

```python
"""Offline tests for baseline load / summarize / compare. Not eval-marked."""
import json

from tests.evals.baseline import (
    compare,
    load_baseline,
    summarize,
    write_baseline,
)
from tests.evals.scorers import ScoreResult


def _r(name, value, passed=True):
    return ScoreResult(name=name, value=value, passed=passed, detail="")


def _named(results, name):
    return next(r for r in results if r.name == name)


def test_summarize_averages_each_metric_by_name():
    metrics = summarize([
        _r("recall", 1.0), _r("recall", 0.0),
        _r("total_tokens", 1000.0), _r("total_tokens", 2000.0),
    ])
    assert metrics == {"recall": 0.5, "total_tokens": 1500.0}


def test_summarize_of_nothing_is_empty():
    assert summarize([]) == {}


def test_load_baseline_returns_none_when_absent(tmp_path):
    assert load_baseline(tmp_path / "baseline.json") is None


def test_write_then_load_round_trips(tmp_path):
    path = tmp_path / "baseline.json"
    write_baseline(path, {"recall": 0.9}, {"note": "first run"})

    loaded = load_baseline(path)
    assert loaded["metrics"] == {"recall": 0.9}
    assert loaded["meta"]["note"] == "first run"
    assert json.loads(path.read_text(encoding="utf-8"))["metrics"]["recall"] == 0.9


def test_compare_passes_on_an_unchanged_run():
    baseline = {"metrics": {"recall": 0.9, "score_in_range": 40.0, "total_tokens": 3000.0}}
    results = compare({"recall": 0.9, "score_in_range": 40.0, "total_tokens": 3000.0}, baseline)
    assert results, "expected one comparison per shared metric"
    assert all(r.passed for r in results)


def test_compare_fails_when_recall_drops_past_tolerance():
    baseline = {"metrics": {"recall": 0.9}}
    assert not _named(compare({"recall": 0.7}, baseline), "regression:recall").passed


def test_compare_tolerates_a_small_recall_drop():
    baseline = {"metrics": {"recall": 0.9}}
    assert _named(compare({"recall": 0.8}, baseline), "regression:recall").passed


def test_compare_never_penalizes_an_improvement():
    baseline = {"metrics": {"recall": 0.5, "total_tokens": 3000.0}}
    results = compare({"recall": 1.0, "total_tokens": 1000.0}, baseline)
    assert all(r.passed for r in results)


def test_compare_fails_on_a_large_mean_score_swing_in_either_direction():
    """A prompt that suddenly scores every PR higher is as notable as one that
    scores every PR lower — the band is two-sided on purpose."""
    baseline = {"metrics": {"score_in_range": 40.0}}
    assert not _named(compare({"score_in_range": 65.0}, baseline), "regression:score_in_range").passed
    assert not _named(compare({"score_in_range": 15.0}, baseline), "regression:score_in_range").passed


def test_every_gating_metric_name_has_a_tolerance():
    """A metric absent from TOLERANCES is silently skipped by compare(), so a
    renamed scorer would stop guarding without anything failing."""
    from tests.evals.baseline import TOLERANCES

    for name in ("recall", "no_false_criticals", "score_in_range", "total_tokens"):
        assert name in TOLERANCES, f"{name} would be skipped by compare()"


def test_compare_fails_on_runaway_token_growth():
    baseline = {"metrics": {"total_tokens": 2000.0}}
    assert not _named(compare({"total_tokens": 3200.0}, baseline), "regression:total_tokens").passed


def test_compare_ignores_metrics_absent_from_the_baseline():
    results = compare({"brand_new_metric": 1.0}, {"metrics": {"recall": 0.9}})
    assert results == []
```

- [ ] **Step 2: Run to verify it fails**

Run: `./.venv/Scripts/python.exe -m pytest tests/evals/test_baseline_unit.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'tests.evals.baseline'`

- [ ] **Step 3: Write the baseline module**

Create `apps/api/tests/evals/baseline.py`:

```python
"""Baseline storage and regression comparison.

baseline.json holds the aggregate metrics from the last accepted run and is
committed to git, so every accepted quality shift lands as a reviewable diff.
Updating it needs an explicit --eval-update-baseline.

Model output is non-deterministic, so thresholds are bands rather than
equality, and aggregates matter more than any single fixture.
"""
import json
from pathlib import Path
from statistics import mean

from tests.evals.scorers import ScoreResult

# How far a metric may drift from the baseline before it counts as a regression.
#   max_drop      — falling this far below baseline fails; rising never does
#   max_abs_delta — moving this far in either direction fails
#   max_growth    — fractional increase allowed (cost metrics)
TOLERANCES = {
    "recall": {"max_drop": 0.15},
    "no_false_criticals": {"max_drop": 0.15},
    "severity_match": {"max_drop": 0.25},
    "root_cause_keywords": {"max_drop": 0.25},
    # score_in_range carries the raw score as its value, so its aggregate is
    # the mean score across fixtures — bounded in both directions, because a
    # prompt that suddenly scores everything higher is as notable as one that
    # scores everything lower.
    "score_in_range": {"max_abs_delta": 10.0},
    "overall_in_range": {"max_abs_delta": 10.0},
    "total_tokens": {"max_growth": 0.30},
    "latency_ms": {"max_growth": 1.00},
}


def summarize(results: list[ScoreResult]) -> dict[str, float]:
    """Collapse many per-fixture ScoreResults into one mean per metric name."""
    grouped: dict[str, list[float]] = {}
    for result in results:
        grouped.setdefault(result.name, []).append(result.value)
    return {name: mean(values) for name, values in grouped.items()}


def load_baseline(path: Path) -> dict | None:
    """Return the committed baseline, or None on the very first run."""
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def write_baseline(path: Path, metrics: dict[str, float], meta: dict) -> None:
    path.write_text(
        json.dumps({"meta": meta, "metrics": metrics}, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def _compare_one(name: str, current: float, previous: float) -> ScoreResult:
    tolerance = TOLERANCES[name]
    delta = current - previous

    if "max_drop" in tolerance:
        limit = tolerance["max_drop"]
        passed = delta >= -limit
        detail = f"{previous:.3f} -> {current:.3f} (drop limit {limit})"
    elif "max_abs_delta" in tolerance:
        limit = tolerance["max_abs_delta"]
        passed = abs(delta) <= limit
        detail = f"{previous:.2f} -> {current:.2f} (limit +/-{limit})"
    else:
        limit = tolerance["max_growth"]
        ceiling = previous * (1 + limit)
        passed = current <= ceiling or previous == 0
        detail = f"{previous:.0f} -> {current:.0f} (ceiling {ceiling:.0f})"

    return ScoreResult(
        name=f"regression:{name}",
        value=delta,
        passed=passed,
        detail=detail,
    )


def compare(current: dict[str, float], baseline: dict) -> list[ScoreResult]:
    """One ScoreResult per metric present in both the run and the baseline."""
    previous = baseline.get("metrics", {})
    return [
        _compare_one(name, value, previous[name])
        for name, value in sorted(current.items())
        if name in previous and name in TOLERANCES
    ]
```

- [ ] **Step 4: Run the baseline tests**

Run: `./.venv/Scripts/python.exe -m pytest tests/evals/test_baseline_unit.py -v`
Expected: PASS — 12 passed

- [ ] **Step 5: Run the full offline suite**

Run: `./.venv/Scripts/python.exe -m pytest -q`
Expected: 81 passed

- [ ] **Step 6: Commit**

```bash
git add apps/api/tests/evals/baseline.py apps/api/tests/evals/test_baseline_unit.py
git commit -m "test: add baseline storage and regression comparison

baseline.json holds the aggregate metrics from the last accepted run and
is committed, so every accepted quality shift is a reviewable diff rather
than a silent drift. Updating it requires --eval-update-baseline.

Because model output is non-deterministic, tolerances are bands rather
than equality, and each metric gets the band that suits it: recall may
only drop so far (rising is never a regression), mean score is bounded in
both directions, and cost metrics are bounded by fractional growth.
Metrics missing from the baseline are skipped so adding a new one does
not fail the run that introduces it."
```

---

### Task 6: the review eval module and the run report

**Files:**
- Modify: `apps/api/tests/evals/conftest.py` (add the recorder)
- Create: `apps/api/tests/evals/test_review_eval.py`

**Interfaces:**
- Consumes: `review_pull_request_with_meta`, `CallMeta` (Task 1); loaders (Task 3); scorers (Task 4); `summarize`/`compare`/`load_baseline`/`write_baseline` (Task 5).
- Produces:
  - session fixture `recorder` with `record(suite: str, case_id: str, results: list[ScoreResult], meta: CallMeta | None)` and `results: list[ScoreResult]`
  - session fixture `gating: bool` — `False` until `baseline.json` exists
  - `tests/evals/last_run.json` written at session end

- [ ] **Step 1: Add the recorder to conftest**

Extend `apps/api/tests/evals/conftest.py`. The four import lines go with the
existing imports at the top of the file, **below** the `os.environ.setdefault`
block — `tests.evals.scorers` pulls in `services.claude_service`, which needs
those env vars already seeded. The rest appends to the end.

```python
import json
from dataclasses import asdict

from tests.evals.baseline import compare, load_baseline, summarize, write_baseline
from tests.evals.scorers import ScoreResult


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
    elif baseline:
        failed = [r for r in regressions if not r.passed]
        for r in failed:
            print(f"\n[eval] REGRESSION {r.name}: {r.detail}")
        assert not failed, f"{len(failed)} metric(s) regressed against baseline.json"
```

- [ ] **Step 2: Write the review eval module**

Create `apps/api/tests/evals/test_review_eval.py`:

```python
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
```

- [ ] **Step 3: Verify the module skips cleanly without a key**

Run: `./.venv/Scripts/python.exe -m pytest -m eval -q`
Expected: 4 skipped (3 PR fixtures + the coverage test), each naming the missing key. No errors, no network.

- [ ] **Step 4: Verify the default run is unaffected**

Run: `./.venv/Scripts/python.exe -m pytest -q`
Expected: 81 passed — the eval module is not collected.

- [ ] **Step 5: Commit**

```bash
git add apps/api/tests/evals/conftest.py apps/api/tests/evals/test_review_eval.py
git commit -m "test: add the review eval module and run report

Parametrizes every PR fixture through the real review_pull_request
prompt, then scores contract, recall, precision, false criticals, score
range, and budget.

The contract check is a hard fail on every run: a malformed payload
breaks webhooks.py and the dashboard no matter how good the review text
is. Quality and budget metrics only gate once baseline.json exists, so
the first run establishes numbers instead of failing against guesses.

The recorder writes every per-fixture score to a gitignored
last_run.json and asserts the aggregate against the committed baseline at
session end."
```

---

### Task 7: the remaining fixtures

**Files:**
- Create: 8 more `fixtures/prs/<case>/{diff.patch,labels.json}`
- Create: 3 more `fixtures/incidents/<case>/{incident.json,stack_trace.txt}`

**Interfaces:**
- Consumes: the fixture format from Task 3.
- Produces: a full set of 11 PR cases (8 planted-bug, 3 clean) and 4 incident cases.

- [ ] **Step 1: `003_hardcoded_secret`**

`fixtures/prs/003_hardcoded_secret/diff.patch`:

```
diff --git a/src/notify.py b/src/notify.py
index b1c2d3e..f4a5b6c 100644
--- a/src/notify.py
+++ b/src/notify.py
@@ -8,3 +8,9 @@ import requests
 
 def build_payload(message: str) -> dict:
     return {"text": message}
+
+
+def send_slack(message: str) -> None:
+    token = "b7f3d9a1c04e28516af0d3c9e7b2145a"
+    requests.post("https://slack.com/api/chat.postMessage",
+                  headers={"Authorization": f"Bearer {token}"}, json=build_payload(message))
```

The hardcoded token is on new-file line 14.

`fixtures/prs/003_hardcoded_secret/labels.json`:

```json
{
  "repo": "acme/notifier",
  "title": "feat: post build failures to Slack",
  "expected_findings": [
    {
      "file": "src/notify.py",
      "line_range": [12, 16],
      "severity": "critical",
      "keywords": ["hardcod", "secret", "token", "credential", "environment"]
    }
  ],
  "expected_score_range": [0, 50],
  "must_not_flag": []
}
```

- [ ] **Step 2: `004_path_traversal`**

`fixtures/prs/004_path_traversal/diff.patch`:

```
diff --git a/src/files.py b/src/files.py
index c3d4e5f..a6b7c8d 100644
--- a/src/files.py
+++ b/src/files.py
@@ -15,3 +15,9 @@ UPLOAD_ROOT = "/srv/uploads"
 
 def list_uploads() -> list[str]:
     return os.listdir(UPLOAD_ROOT)
+
+
+def read_upload(filename: str) -> bytes:
+    """Return the bytes of an uploaded file."""
+    with open(os.path.join(UPLOAD_ROOT, filename), "rb") as handle:
+        return handle.read()
```

`filename` is unsanitized, so `../../etc/passwd` escapes `UPLOAD_ROOT`; the `open` is on new-file line 22.

`fixtures/prs/004_path_traversal/labels.json`:

```json
{
  "repo": "acme/uploads",
  "title": "feat: serve uploaded files",
  "expected_findings": [
    {
      "file": "src/files.py",
      "line_range": [20, 24],
      "severity": "critical",
      "keywords": ["traversal", "path", "sanitiz", "../", "basename"]
    }
  ],
  "expected_score_range": [0, 50],
  "must_not_flag": []
}
```

- [ ] **Step 3: `005_n_plus_one_query`**

`fixtures/prs/005_n_plus_one_query/diff.patch`:

```
diff --git a/src/dashboard.py b/src/dashboard.py
index d4e5f6a..b7c8d9e 100644
--- a/src/dashboard.py
+++ b/src/dashboard.py
@@ -30,3 +30,10 @@ from models import Repo, Review
 
 def active_repos(session):
     return session.query(Repo).filter(Repo.active.is_(True)).all()
+
+
+def repo_summaries(session) -> list[dict]:
+    out = []
+    for repo in active_repos(session):
+        reviews = session.query(Review).filter(Review.repo_id == repo.id).all()
+        out.append({"repo": repo.name, "reviews": len(reviews)})
+    return out
```

One query per repo inside the loop; the inner query is on new-file line 38.

`fixtures/prs/005_n_plus_one_query/labels.json`:

```json
{
  "repo": "acme/dashboard",
  "title": "feat: add repo summary panel",
  "expected_findings": [
    {
      "file": "src/dashboard.py",
      "line_range": [36, 40],
      "severity": "warning",
      "keywords": ["n+1", "n + 1", "loop", "join", "query per", "batch"]
    }
  ],
  "expected_score_range": [30, 70],
  "must_not_flag": []
}
```

- [ ] **Step 4: `006_unbounded_query`**

`fixtures/prs/006_unbounded_query/diff.patch`:

```
diff --git a/src/api/events.py b/src/api/events.py
index e5f6a7b..c8d9e0f 100644
--- a/src/api/events.py
+++ b/src/api/events.py
@@ -22,3 +22,8 @@ from models import Event
 
 def recent_event(session):
     return session.query(Event).order_by(Event.created_at.desc()).first()
+
+
+@router.get("/events")
+def list_events(session=Depends(get_session)):
+    return session.query(Event).order_by(Event.created_at.desc()).all()
```

No `LIMIT` and no pagination on a table that grows without bound; the query is on new-file line 29.

`fixtures/prs/006_unbounded_query/labels.json`:

```json
{
  "repo": "acme/api",
  "title": "feat: expose the events endpoint",
  "expected_findings": [
    {
      "file": "src/api/events.py",
      "line_range": [27, 31],
      "severity": "warning",
      "keywords": ["pagination", "paginat", "limit", "unbounded", "all rows"]
    }
  ],
  "expected_score_range": [30, 70],
  "must_not_flag": []
}
```

- [ ] **Step 5: `007_missing_auth_check`**

`fixtures/prs/007_missing_auth_check/diff.patch`:

```
diff --git a/src/api/admin.py b/src/api/admin.py
index f6a7b8c..d9e0f1a 100644
--- a/src/api/admin.py
+++ b/src/api/admin.py
@@ -18,3 +18,9 @@ from auth import require_admin
 @router.get("/admin/users")
 def list_users(user=Depends(require_admin), session=Depends(get_session)):
     return session.query(User).all()
+
+
+@router.delete("/admin/users/{user_id}")
+def delete_user(user_id: str, session=Depends(get_session)):
+    session.query(User).filter(User.id == user_id).delete()
+    session.commit()
```

The sibling route above it requires admin; this destructive one has no auth dependency. The route decorator is on new-file line 24.

`fixtures/prs/007_missing_auth_check/labels.json`:

```json
{
  "repo": "acme/api",
  "title": "feat: allow admins to delete users",
  "expected_findings": [
    {
      "file": "src/api/admin.py",
      "line_range": [23, 28],
      "severity": "critical",
      "keywords": ["auth", "authoriz", "require_admin", "permission", "unauthenticated"]
    }
  ],
  "expected_score_range": [0, 45],
  "must_not_flag": []
}
```

- [ ] **Step 6: `008_swallowed_exception`**

`fixtures/prs/008_swallowed_exception/diff.patch`:

```
diff --git a/src/sync.py b/src/sync.py
index a7b8c9d..e0f1a2b 100644
--- a/src/sync.py
+++ b/src/sync.py
@@ -40,3 +40,10 @@ logger = logging.getLogger(__name__)
 
 def fetch_repos(client):
     return client.get("/user/repos").json()
+
+
+def sync_all(client, session) -> None:
+    try:
+        for repo in fetch_repos(client):
+            upsert_repo(session, repo)
+    except Exception:
+        pass
```

A bare `except Exception: pass` hides every sync failure; the `pass` is on new-file line 50.

`fixtures/prs/008_swallowed_exception/labels.json`:

```json
{
  "repo": "acme/sync",
  "title": "feat: sync all repos on login",
  "expected_findings": [
    {
      "file": "src/sync.py",
      "line_range": [48, 52],
      "severity": "warning",
      "keywords": ["swallow", "silent", "bare except", "except", "log", "re-raise"]
    }
  ],
  "expected_score_range": [25, 65],
  "must_not_flag": []
}
```

- [ ] **Step 7: `010_clean_typed_helper`**

`fixtures/prs/010_clean_typed_helper/diff.patch`:

```
diff --git a/src/format.py b/src/format.py
index b8c9d0e..f1a2b3c 100644
--- a/src/format.py
+++ b/src/format.py
@@ -5,3 +5,11 @@ from datetime import datetime, timezone
 
 def now() -> datetime:
     return datetime.now(timezone.utc)
+
+
+def humanize_age(created_at: datetime) -> str:
+    """Render how long ago `created_at` was, to the nearest hour."""
+    delta = now() - created_at
+    hours = int(delta.total_seconds() // 3600)
+    if hours < 1:
+        return "just now"
+    return f"{hours}h ago"
```

Typed, timezone-aware, and the sub-hour case is handled — no defect.

`fixtures/prs/010_clean_typed_helper/labels.json`:

```json
{
  "repo": "acme/web",
  "title": "feat: humanize timestamps in the activity feed",
  "expected_findings": [],
  "expected_score_range": [70, 100],
  "must_not_flag": ["critical"]
}
```

- [ ] **Step 8: `011_clean_test_addition`**

`fixtures/prs/011_clean_test_addition/diff.patch`:

```
diff --git a/tests/test_format.py b/tests/test_format.py
index 0000000..c9d0e1f 100644
--- a/tests/test_format.py
+++ b/tests/test_format.py
@@ -1,3 +1,16 @@
 from datetime import datetime, timedelta, timezone
 
 from src.format import humanize_age
+
+
+def test_returns_just_now_for_a_sub_hour_delta():
+    created = datetime.now(timezone.utc) - timedelta(minutes=20)
+    assert humanize_age(created) == "just now"
+
+
+def test_rounds_down_to_whole_hours():
+    created = datetime.now(timezone.utc) - timedelta(hours=3, minutes=59)
+    assert humanize_age(created) == "3h ago"
```

Pure test coverage for the previous fixture's helper — nothing to flag.

`fixtures/prs/011_clean_test_addition/labels.json`:

```json
{
  "repo": "acme/web",
  "title": "test: cover humanize_age boundaries",
  "expected_findings": [],
  "expected_score_range": [75, 100],
  "must_not_flag": ["critical", "warning"]
}
```

- [ ] **Step 9: `002_redis_connection_exhaustion` incident**

`fixtures/incidents/002_redis_connection_exhaustion/stack_trace.txt`:

```
Traceback (most recent call last):
  File "src/cache.py", line 34, in get_cached
    return await pool.get(key)
  File "redis/asyncio/connection.py", line 1104, in get_connection
    raise ConnectionError("Too many connections")
redis.exceptions.ConnectionError: Too many connections
```

`fixtures/incidents/002_redis_connection_exhaustion/incident.json`:

```json
{
  "title": "redis.exceptions.ConnectionError: Too many connections",
  "affected_files": ["src/cache.py"],
  "blame_info": {"src/cache.py": "mchen"},
  "expected_severity": "P1",
  "root_cause_keywords": ["connection", "pool", "redis", "exhaust", "limit"]
}
```

- [ ] **Step 10: `003_slow_report_query` incident**

`fixtures/incidents/003_slow_report_query/stack_trace.txt`:

```
TimeoutError: query exceeded statement_timeout of 30000ms
  at src/services/report_service.py:112 in build_weekly_report
  SQL: SELECT * FROM reviews JOIN pull_requests ON ... WHERE created_at > $1
  rows examined: 4,182,551
```

`fixtures/incidents/003_slow_report_query/incident.json`:

```json
{
  "title": "Weekly report generation times out after 30s",
  "affected_files": ["src/services/report_service.py"],
  "blame_info": {"src/services/report_service.py": "adevi"},
  "expected_severity": "P3",
  "root_cause_keywords": ["timeout", "index", "query", "slow", "scan"]
}
```

- [ ] **Step 11: `004_stale_ui_label` incident**

`fixtures/incidents/004_stale_ui_label/stack_trace.txt`:

```
No exception. Reported by a user via support.

The dashboard header reads "0 repos connected" while the repo list below
renders 4 repos. Reloading fixes it until the next navigation.
Console shows no errors.
```

`fixtures/incidents/004_stale_ui_label/incident.json`:

```json
{
  "title": "Dashboard header shows a stale repo count",
  "affected_files": ["apps/web/components/DashboardHeader.tsx"],
  "blame_info": {"apps/web/components/DashboardHeader.tsx": "jsmith"},
  "expected_severity": "P4",
  "root_cause_keywords": ["stale", "cache", "state", "refetch", "render"]
}
```

This one exists to check triage does **not** call a cosmetic bug P1.

- [ ] **Step 12: Verify the full fixture set loads**

Run:
```bash
./.venv/Scripts/python.exe -c "from pathlib import Path; import sys; sys.path.insert(0, '.'); from tests.evals.fixtures import load_pr_fixtures, load_incident_fixtures; d = Path('tests/evals/fixtures'); prs = load_pr_fixtures(d); inc = load_incident_fixtures(d); print(f'{len(prs)} PR fixtures, {sum(1 for f in prs if f.is_clean)} clean'); print(f'{len(inc)} incident fixtures')"
```
Expected: `11 PR fixtures, 3 clean` and `4 incident fixtures`

Run: `./.venv/Scripts/python.exe -m pytest -q`
Expected: 81 passed

- [ ] **Step 13: Commit**

```bash
git add apps/api/tests/evals/fixtures/
git commit -m "test: complete the eval fixture set

Brings the suite to 11 PR cases (8 planted-bug, 3 clean) and 4 incident
cases. The planted bugs span the classes the review prompt claims to
cover: SQL injection, missing null check, hardcoded secret, path
traversal, N+1 query, unbounded query, missing auth check, and a
swallowed exception.

The three clean cases are what actually measure false positives -- a
suite of planted bugs alone can only measure recall, and a model that
flags everything would score perfectly on it.

The incident set spans P1 through P4 on purpose; the P4 cosmetic case
checks that triage does not inflate severity on a bug nobody is paged
for."
```

---

### Task 8: triage and team eval modules

**Files:**
- Create: `apps/api/tests/evals/test_triage_eval.py`
- Create: `apps/api/tests/evals/test_team_eval.py`

**Interfaces:**
- Consumes: `triage_incident_with_meta`, `analyze_team_quality_with_meta` (Task 1); `load_incident_fixtures` (Task 3); `score_contract`, `score_triage`, `score_budget`, `Budget` (Task 4); `recorder`, `gating`, `budgets` (Task 6).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Write the triage eval module**

Create `apps/api/tests/evals/test_triage_eval.py`:

```python
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
```

- [ ] **Step 2: Write the team eval module**

Create `apps/api/tests/evals/test_team_eval.py`:

```python
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
```

- [ ] **Step 3: Verify both modules skip cleanly without a key**

Run: `./.venv/Scripts/python.exe -m pytest -m eval -q`
Expected: 20 skipped (11 review + 4 triage + 3 team + 2 coverage tests), each naming the missing key.

- [ ] **Step 4: Verify the default run is still clean**

Run: `./.venv/Scripts/python.exe -m pytest -q`
Expected: 81 passed

- [ ] **Step 5: Commit**

```bash
git add apps/api/tests/evals/test_triage_eval.py apps/api/tests/evals/test_team_eval.py
git commit -m "test: add triage and team-quality eval modules

Both follow the review module's shape: contract is a hard fail on every
run, quality and budget gate only once a baseline exists.

Triage runs the four file fixtures and scores severity match plus
root-cause keyword coverage. analyze_team_quality has no file fixtures --
its input is a handful of aggregate numbers -- so its three cases are
defined inline: a healthy team, a struggling team, and a team with no
activity at all, which is the shape a brand new org actually sends."
```

---

### Task 9: establish the baseline and run the spec's verification

**Files:**
- Create: `apps/api/tests/evals/baseline.json` (generated)
- Modify: `apps/api/tests/evals/scorers.py` (`RECALL_FLOOR` from real data)

**Interfaces:**
- Consumes: everything above.
- Produces: a committed `baseline.json`.

**This task needs a real `ANTHROPIC_API_KEY` and spends real money** (roughly 18 calls; a few cents). If no key is available, stop here and report that Tasks 1–8 are complete and Task 9 is blocked on credentials — do not fabricate a baseline.

- [ ] **Step 1: Confirm a real key is present**

Run: `./.venv/Scripts/python.exe -c "import os; k = os.environ.get('ANTHROPIC_API_KEY',''); print('real key' if k and not k.startswith('sk-ant-mock') else 'NO REAL KEY')"`
Expected: `real key`. If not, stop and report Task 9 as blocked.

- [ ] **Step 2: First real run, reporting only**

Run: `./.venv/Scripts/python.exe -m pytest -m eval -v`
Expected: every contract check passes; quality tests report then skip with "No baseline.json yet". Any contract failure is a genuine bug — fix it before baselining.

- [ ] **Step 3: Read the numbers**

Run: `./.venv/Scripts/python.exe -c "import json; d = json.load(open('tests/evals/last_run.json')); print(json.dumps(d['metrics'], indent=2))"`
Expected: a metrics block with `recall`, `precision`, `no_false_criticals`, `score_in_range`, `severity_match`, `root_cause_keywords`, `total_tokens`, `latency_ms`.

Record the `recall` value — Step 5 uses it.

- [ ] **Step 4: Write the baseline**

Run: `./.venv/Scripts/python.exe -m pytest -m eval --eval-update-baseline -q`
Expected: PASS, ending with `[eval] baseline updated: ...baseline.json`.

- [ ] **Step 5: Set `RECALL_FLOOR` from the observed value, not a guess**

In `apps/api/tests/evals/scorers.py`, replace the `RECALL_FLOOR` block with the observed recall minus the 0.15 tolerance, rounded down to one decimal. For example, an observed recall of 0.87 gives:

```python
# Set from the first real run (recall 0.87) minus the 0.15 regression
# tolerance. Raise it as the prompts improve; never lower it to make a
# failing run pass.
RECALL_FLOOR = 0.7
```

- [ ] **Step 6: Confirm a clean re-run now gates and passes**

Run: `./.venv/Scripts/python.exe -m pytest -m eval -q`
Expected: PASS with no skips — the baseline exists, so quality metrics gate and clear.

- [ ] **Step 7: Spec verification — the deliberate recall regression**

Temporarily weaken the review system prompt in `services/claude_service.py`, dropping the security clause:

```python
        system=(
            "You are a senior software engineer reviewing a pull request. "
            "Identify bugs and performance problems. "
            "Respond in structured JSON only — no prose outside the JSON."
        ),
```

Run: `./.venv/Scripts/python.exe -m pytest -m eval -q`
Expected: FAIL — recall drops on the security fixtures (`001`, `003`, `004`, `007`) and/or `regression:recall` fails at session end.

**Revert the prompt** (restore the `security issues (OWASP top 10)` clause) and confirm:
Run: `./.venv/Scripts/python.exe -m pytest -m eval -q`
Expected: PASS

- [ ] **Step 8: Spec verification — the contract hard fail**

Temporarily revert the review prompt's score instruction to the old broken scale:

```python
            '"score": 0-10, "summary": str}'
```

Run: `./.venv/Scripts/python.exe -m pytest -m eval -q`
Expected: FAIL on `score is outside 0-100` — proving the contract scorer catches the exact bug that was manufacturing false P1s.

**Revert the prompt** and confirm:
Run: `./.venv/Scripts/python.exe -m pytest -m eval -q`
Expected: PASS

- [ ] **Step 9: Confirm the offline suite is untouched**

Run: `./.venv/Scripts/python.exe -m pytest -q`
Expected: 81 passed, no network, no key needed.

Run: `git status --short`
Expected: only `baseline.json` and `scorers.py` modified. `last_run.json` must **not** appear — if it does, the `.gitignore` entry from Task 2 is wrong.

- [ ] **Step 10: Confirm the graph registers the new coverage**

Use the `code-review-graph` MCP tools: `detect_changes`, then `query_graph` with `pattern="tests_for"` on `claude_service`.
Expected: the eval modules appear as covering `claude_service`. If they do not, note it — the graph indexes on file change hooks and may need `build_or_update_graph_tool`.

- [ ] **Step 11: Commit**

```bash
git add apps/api/tests/evals/baseline.json apps/api/tests/evals/scorers.py
git commit -m "test: establish the eval baseline from the first real run

baseline.json records the aggregate metrics from the first full
'pytest -m eval' against the fixed prompts, and RECALL_FLOOR is set from
that run's observed recall minus the regression tolerance rather than
from a guess.

Verified both failure modes the harness exists to catch: dropping the
OWASP clause from the review system prompt fails recall against this
baseline, and reverting the score instruction to 0-10 hard-fails the
contract check -- the bug that was auto-creating a P1 incident on every
clean PR.

Changing a prompt from here on means running the evals, reading the
delta, and committing the new baseline alongside the prompt change."
```

---

## Out of scope

Each of these is a clean follow-on, deliberately excluded:

- **CI wiring** — a path-filtered GitHub Action on `claude_service.py`. Note the repo has no `.github/` directory at all today, so this means standing up CI from scratch, not adding a job.
- **Nightly scheduled runs** against `main` to catch Anthropic-side model drift.
- **LLM-as-judge scoring** as a second quality signal. `scorers.py` leaves room for `score_judge` without restructuring.
- **Model upgrades.** `claude-sonnet-4-6` and `claude-haiku-4-5-20251001` stay as they are. This harness is the thing that makes bumping them a measurable change rather than a leap.
