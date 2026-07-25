"""Tests for GitHub repository synchronisation.

Regression context: an org could end up with a single repo -- the one
auto-registered by a pull_request webhook -- while the GitHub App had access to
dozens. The install-time backfill (`POST /orgs/github/link`) is the only code
that ever calls the GitHub repositories API, it is reachable from exactly one
place (the install callback), and it is what sets `Organization.
github_installation_id`. When that callback never fires, the org keeps a NULL
installation id and the repo list can never catch up.
"""
import os

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379")
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-supabase-jwt-secret")
os.environ.setdefault("ANTHROPIC_API_KEY", "sk-ant-mock")

from types import SimpleNamespace

from routers.orgs import _missing_repos, _resolve_installation_id


def _repo(github_repo_id, installation_id=134133960):
    return SimpleNamespace(github_repo_id=github_repo_id, installation_id=installation_id)


class TestResolveInstallationId:
    """The org's stored installation id is the primary source, but it is NULL
    whenever the install callback never completed -- so fall back to the id
    carried by repos the webhook auto-registered."""

    def test_prefers_installation_id_stored_on_org(self):
        org = SimpleNamespace(github_installation_id=111)
        assert _resolve_installation_id(org, [_repo(1, installation_id=222)]) == 111

    def test_falls_back_to_existing_repo_when_org_id_is_null(self):
        org = SimpleNamespace(github_installation_id=None)
        assert _resolve_installation_id(org, [_repo(1, installation_id=134133960)]) == 134133960

    def test_ignores_repos_carrying_placeholder_zero(self):
        """_resolve_repo writes `installation_id or 0`, so 0 is not a real id."""
        org = SimpleNamespace(github_installation_id=None)
        repos = [_repo(1, installation_id=0), _repo(2, installation_id=987)]
        assert _resolve_installation_id(org, repos) == 987

    def test_returns_none_when_nothing_knows_the_installation(self):
        org = SimpleNamespace(github_installation_id=None)
        assert _resolve_installation_id(org, []) is None

    def test_returns_none_when_only_placeholder_ids_exist(self):
        org = SimpleNamespace(github_installation_id=None)
        assert _resolve_installation_id(org, [_repo(1, installation_id=0)]) is None


class TestMissingRepos:
    def test_returns_repos_absent_locally(self):
        github = [{"id": 1, "name": "a"}, {"id": 2, "name": "b"}, {"id": 3, "name": "c"}]
        assert [r["id"] for r in _missing_repos(github, {2})] == [1, 3]

    def test_returns_empty_when_already_in_sync(self):
        github = [{"id": 1, "name": "a"}]
        assert _missing_repos(github, {1}) == []

    def test_returns_everything_when_nothing_known(self):
        github = [{"id": 1, "name": "a"}, {"id": 2, "name": "b"}]
        assert len(_missing_repos(github, set())) == 2

    def test_reproduces_the_production_gap(self):
        """One repo locally, 46 granted by GitHub -> 45 to create."""
        github = [{"id": i, "name": f"repo{i}"} for i in range(46)]
        assert len(_missing_repos(github, {0})) == 45

    def test_does_not_mutate_its_inputs(self):
        github = [{"id": 1}, {"id": 2}]
        known = {1}
        _missing_repos(github, known)
        assert github == [{"id": 1}, {"id": 2}]
        assert known == {1}
