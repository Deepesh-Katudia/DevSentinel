import ssl
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool
from pydantic_settings import BaseSettings

_ssl_ctx = ssl.create_default_context()
_ssl_ctx.check_hostname = False
_ssl_ctx.verify_mode = ssl.CERT_NONE


class Settings(BaseSettings):
    database_url: str
    redis_url: str = "redis://localhost:6379"
    supabase_jwt_secret: str
    jwt_secret: str = ""
    anthropic_api_key: str
    github_app_id: str = ""
    github_app_private_key_path: str = "./github-app.pem"
    github_app_private_key: str = ""   # alternative: paste PEM content directly in .env
    github_webhook_secret: str = ""
    sentry_webhook_secret: str = ""
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    supabase_url: str = ""
    supabase_service_key: str = ""
    frontend_url: str = "http://localhost:3000"
    cors_origins: str = "http://localhost:3000"  # comma-separated allowed origins
    resend_api_key: str = ""
    resend_from_address: str = "onboarding@resend.dev"
    # Reject API requests whose Supabase JWT email is not verified.
    # Safety valve: set to false if a legitimate token is ever missing the claim.
    enforce_email_verification: bool = True
    # Storage backend for rate limiting. Empty → in-memory (per-process).
    # Set to a redis:// URI for shared limits across workers.
    ratelimit_storage_uri: str = ""

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()

engine = create_async_engine(
    # .strip() guards against stray whitespace/newlines pasted into the
    # DATABASE_URL env var (a common dashboard copy-paste footgun).
    settings.database_url.strip(),
    echo=False,
    poolclass=NullPool,
    connect_args={"ssl": _ssl_ctx, "statement_cache_size": 0},
)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session
