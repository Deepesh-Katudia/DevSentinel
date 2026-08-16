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
