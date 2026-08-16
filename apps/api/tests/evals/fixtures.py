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
