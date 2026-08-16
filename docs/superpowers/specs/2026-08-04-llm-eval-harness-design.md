# DevSentinel — LLM Eval Harness Design

**Date:** 2026-08-04
**Status:** Approved (pending spec review)
**Author:** Deepesh + Claude

## Context

DevSentinel's product value rests on three LLM calls in
`apps/api/services/claude_service.py`:

| Function | Model | Feeds |
| --- | --- | --- |
| `review_pull_request()` | `claude-sonnet-4-6` | PR review comments, `review_score`, auto-incidents |
| `triage_incident()` | `claude-sonnet-4-6` | Incident root cause + P1–P4 severity |
| `analyze_team_quality()` | `claude-haiku-4-5-20251001` | Weekly report grade + narrative |

All three are single-shot: one `messages.create`, strip markdown fences,
`json.loads`. No chains, no agents, no tool use.

**Nothing currently exercises the model.** `tests/test_claude_service.py` mocks
`get_client` entirely, so it verifies our parsing of a hand-written dict — not
that Claude returns a parseable, correctly-shaped, useful response. A prompt
edit, a model bump, or an Anthropic-side snapshot change can silently degrade
every review DevSentinel produces and no test would notice.

This design adds a harness that catches four failure classes: broken output
contract, quality regression across prompt/model changes, poor review
recall/precision, and runaway token cost.

### Why not LangChain or LangGraph

Both were considered and rejected. LangChain is a provider-abstraction layer —
we have one provider and three functions, so it means rewriting working code for
portability we do not need. LangGraph is for stateful multi-step agent graphs,
of which we have none. Neither is an eval framework; the eval product in that
ecosystem is LangSmith, which requires neither library and was set aside to
avoid sending customer PR diffs to a third party beyond Anthropic. promptfoo
(Node, would force duplicating Python-embedded prompts into YAML) and DeepEval
(Python-native, but its value is generic judge metrics we would not use) were
also evaluated. See "Rejected alternatives" below.

## Prerequisite bug fix: the score scale

`claude_service.py:51` instructs Claude to return `"score": 0-10`. Every
consumer reads it as 0–100:

- `routers/webhooks.py:240` — `if review.get("score", 100) < 60` opens an incident
- `routers/webhooks.py:245` — `severity="P1" if score < 40 else "P2"`
- `apps/web/lib/utils.ts:24-28` — `severityFromScore`: `<60` critical, `<80` warning
- `services/report_service.py:56,124,138` — averages `review_score`, passed to
  `analyze_team_quality`, whose own prompt says `/100`

Consequence: a clean PR scored 8/10 is stored as `review_score=8`, renders as
**critical** in the dashboard, and **auto-creates a P1 incident**. Every good PR
manufactures a false P1.

**Fix first, then baseline.** Change the `review_pull_request` prompt to request
`"score": <integer 0-100>` (matching the phrasing already used in
`analyze_team_quality:101`). Baselining before this fix would freeze the broken
scale into `baseline.json`.

Existing `MOCK_REVIEW` in `tests/test_claude_service.py:22` already uses
`"score": 65`, so the unit tests need no change.

## Approach

A pytest-native harness living beside the existing suite. Rationale: the prompts
are string literals inside async Python functions, so any external tool requires
either duplicating them (drift) or writing a provider shim (more code than the
harness itself). The interesting assertions are project-specific — "did it find
the planted SQL injection near line 42" is a domain check, not a generic rubric.
`pytest` + `pytest-asyncio` are already dependencies; `pytest.ini` already sets
`asyncio_mode = auto`.

**No new production dependencies.**

### Layout

```
apps/api/tests/evals/
  __init__.py
  conftest.py            # real client fixture, budget config, report writer
  scorers.py             # four scorer families
  fixtures/
    prs/
      001_sql_injection/       {diff.patch, labels.yaml}
      002_missing_null_check/  {diff.patch, labels.yaml}
      ...                      # 8 planted-bug cases
      009_clean_refactor/      {diff.patch, labels.yaml}
      ...                      # 3 clean cases
    incidents/
      001_null_pointer_checkout/ {incident.yaml}
      ...                        # 4 cases
  baseline.json          # committed; last accepted scores
  test_review_eval.py
  test_triage_eval.py
  test_team_eval.py
```

~11 PR fixtures (8 planted-bug, 3 clean) and 4 incident fixtures. Full run is a
couple of minutes and a few cents.

### Fixture format

`fixtures/prs/<case>/labels.yaml` — ground truth:

```yaml
repo: acme/payments
title: "feat: add customer lookup endpoint"
expected_findings:
  - file: src/customers.py
    line_range: [40, 46]      # range, not exact line — models drift ±2
    severity: critical
    keywords: [sql, injection, parameteriz]   # any-match, case-insensitive
expected_score_range: [0, 45]
must_not_flag: []             # clean fixtures list severities that fail the case
```

`fixtures/incidents/<case>/incident.yaml`:

```yaml
title: "NullPointerException in checkout"
stack_trace: |
  Traceback (most recent call last):
    File "src/payment.py", line 87, in process
affected_files: [src/payment.py]
blame_info: {src/payment.py: jsmith}
expected_severity: P1
root_cause_keywords: [null, payment]
```

Keyword matching keeps scoring deterministic and judge-free.

Clean fixtures set `expected_score_range: [70, 100]` and
`must_not_flag: [critical]` — these are what measure false-positive rate, which
planted-bug cases alone cannot.

### Scorers (`scorers.py`)

Each returns a `ScoreResult(name, value, passed, detail)` so the report writer
and baseline differ can treat them uniformly.

| Scorer | Fails when | Notes |
| --- | --- | --- |
| `score_contract` | JSON unparseable; missing key; `severity` outside `{critical,warning,info}`; `score` outside 0–100; triage `severity` outside `{P1,P2,P3,P4}` | **Hard fail** — the check that would have caught the scale bug |
| `score_findings` | recall below threshold; a clean fixture emits `critical` | Recall = planted bugs matched on file + line-range + any keyword. Precision reported but does not fail (models legitimately find extra real issues). |
| `score_regression` | a metric moves beyond its threshold vs `baseline.json` | e.g. recall −0.15, mean score ±10 |
| `score_budget` | tokens or wall-clock exceed the per-function budget | Budgets in `conftest.py`, generous initially (2× observed) |

The signature leaves room for a future `score_judge` without restructuring.

### Baseline and the regression workflow

`baseline.json` holds per-fixture and aggregate metrics from the last accepted
run, committed to git. Updating requires an explicit `--eval-update-baseline`
flag, which makes every accepted quality shift a reviewable diff.

Intended loop: change a prompt → `pytest -m eval` → read the delta → decide →
commit the new baseline alongside the prompt change.

Because model output is non-deterministic, thresholds are bands rather than
equality, and aggregate metrics matter more than any single fixture.

Threshold values are **not** guessed up front. The first `pytest -m eval` run
against the fixed prompts establishes them: the initial run's numbers become
`baseline.json`, and each threshold is set to that run's value minus its stated
tolerance. Until that run happens, the harness reports without failing.

### Production change: shared `_call()` helper

`claude_service` discards `message.usage`, and the fence-stripping +
`json.loads` block is copy-pasted three times (`:57-61`, `:111-114`, `:161-164`).

Extract one private helper:

```python
async def _call(*, model, max_tokens, system, user) -> tuple[dict, dict]:
    """Returns (parsed_payload, meta) where meta carries usage + latency."""
```

The three public functions keep their exact current signatures and return types,
so `webhooks.py`, `report_service.py`, and `routers/incidents.py` are untouched.
The harness calls `_call()` directly to read usage and latency — cost tracking
becomes three lines instead of a wrapper layer, and the duplication goes away.

### Wiring

- `pytest.ini` gains:
  ```ini
  markers =
      eval: hits the real Anthropic API and costs money
  addopts = -m "not eval"
  ```
  `pytest` stays free and offline exactly as today; `pytest -m eval` opts in.
- `tests/evals/conftest.py` reads a real `ANTHROPIC_API_KEY` and **skips the
  whole module** when it is absent or matches the `sk-ant-mock` sentinel the
  existing tests seed (`test_claude_service.py:9`). No accidental spend, no
  confusing failures.
- Run report written to `tests/evals/last_run.json`, gitignored.

## Scope boundary

Deliberately excluded, each a clean follow-on:

- CI wiring (path-filtered GitHub Action on `claude_service.py`)
- Nightly scheduled runs against `main` to catch Anthropic-side model drift
- LLM-as-judge scoring as a second quality signal

## Rejected alternatives

| Option | Why not |
| --- | --- |
| **LangChain** | Provider abstraction for a single-provider, three-function surface. Rewrite cost, no benefit. |
| **LangGraph** | Stateful multi-step agent graphs. DevSentinel has no multi-step LLM flow. |
| **LangSmith** | Viable (needs neither LangChain nor LangGraph), good regression UI — but a SaaS dependency that would receive customer PR diffs. Revisit if the dashboard becomes worth it. |
| **promptfoo** | Node tool; prompts live in Python. Forces either YAML duplication (drift on the first `claude_service.py` edit) or a custom provider shim larger than this harness. |
| **DeepEval** | Closest third-party fit, pytest-native Python. Its value is generic judge metrics; our assertions are domain-specific. Heavy dep tree for the remainder. |

## Verification

1. `pytest` from `apps/api/` — existing 5 test modules pass unchanged, no
   network, no API key needed. Confirms the marker config and `_call()` refactor
   broke nothing.
2. `pytest -m eval` with no real key — every eval module skips with a clear
   reason.
3. `pytest -m eval` with a real key — full run completes; inspect
   `last_run.json` for per-fixture contract/recall/token/latency numbers.
4. Deliberate regression: temporarily weaken the review system prompt (drop
   "security issues (OWASP top 10)"), re-run, confirm `score_findings` recall
   drops and `score_regression` fails against the baseline. Revert.
5. Contract check: temporarily revert the prompt to `0-10`, confirm
   `score_contract` hard-fails on the score range. Revert.
6. Graph tools: `detect_changes` + `query_graph` pattern=`tests_for` on
   `claude_service` to confirm the new modules register as covering it.
