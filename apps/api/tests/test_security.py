import os

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379")
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-supabase-jwt-secret")
os.environ.setdefault("ANTHROPIC_API_KEY", "sk-ant-mock")
os.environ.setdefault("GITHUB_APP_ID", "12345")
os.environ.setdefault("GITHUB_WEBHOOK_SECRET", "test-secret")
os.environ.setdefault("SENTRY_WEBHOOK_SECRET", "test-sentry-secret")
os.environ.setdefault("STRIPE_SECRET_KEY", "sk_test_mock")
os.environ.setdefault("STRIPE_WEBHOOK_SECRET", "whsec_mock")

from fastapi import FastAPI, Request
from fastapi.testclient import TestClient
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from main import app
from middleware.security import _client_ip


client = TestClient(app)


def _make_request(headers: dict, client_host: str = "1.2.3.4") -> Request:
    scope = {
        "type": "http",
        "headers": [(k.lower().encode(), v.encode()) for k, v in headers.items()],
        "client": (client_host, 12345),
    }
    return Request(scope)


def test_client_ip_prefers_forwarded_header():
    req = _make_request({"x-forwarded-for": "203.0.113.7, 70.41.3.18"})
    assert _client_ip(req) == "203.0.113.7"


def test_client_ip_falls_back_to_peer():
    req = _make_request({}, client_host="9.9.9.9")
    assert _client_ip(req) == "9.9.9.9"


def test_security_headers_present_on_health():
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.headers.get("X-Content-Type-Options") == "nosniff"
    assert resp.headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"


def test_limiter_registered_on_app():
    assert getattr(app.state, "limiter", None) is not None


def test_rate_limit_returns_429_when_exceeded():
    """Mirrors main.py's wiring (per-route @limiter.limit decorator + handler +
    _client_ip, no global middleware) and confirms 429 past the limit."""
    mini = FastAPI()
    limiter = Limiter(key_func=_client_ip, storage_uri="memory://")
    mini.state.limiter = limiter
    mini.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    @mini.get("/ping")
    @limiter.limit("2/minute")
    async def ping(request: Request):
        return {"ok": True}

    c = TestClient(mini)
    assert c.get("/ping").status_code == 200
    assert c.get("/ping").status_code == 200
    assert c.get("/ping").status_code == 429
