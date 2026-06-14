import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import webhooks, pull_requests, incidents, orgs, ws, users, notifications
from models.database import Base, engine, AsyncSessionLocal, settings
import models.org  # noqa: F401
import models.incident  # noqa: F401
import models.pull_request  # noqa: F401
import models.user  # noqa: F401
import models.notification  # noqa: F401

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# APScheduler — runs the weekly report job every Sunday at 23:55 EST
try:
    import pytz
    from apscheduler.schedulers.asyncio import AsyncIOScheduler
    from apscheduler.triggers.cron import CronTrigger

    _scheduler = AsyncIOScheduler()
    _scheduler.add_job(
        "services.report_service:run_weekly_reports_for_all_orgs",
        CronTrigger(
            day_of_week="sun",
            hour=23,
            minute=55,
            timezone=pytz.timezone("America/New_York"),
        ),
        id="weekly_reports",
        replace_existing=True,
    )
except ImportError:
    _scheduler = None
    logger.warning("apscheduler not installed — weekly report cron disabled")

app = FastAPI(title="DevSentinel API", version="1.0.0")


@app.on_event("startup")
async def start_scheduler():
    if _scheduler is not None:
        _scheduler.start()
        logger.info("✅ APScheduler started — weekly reports run every Sunday 23:55 EST")


@app.on_event("shutdown")
async def stop_scheduler():
    if _scheduler is not None and _scheduler.running:
        _scheduler.shutdown(wait=False)


@app.on_event("startup")
async def create_tables():
    url = settings.database_url
    if ":6543/" in url or "pgbouncer" in url.lower():
        logger.warning(
            "⚠️  DATABASE_URL appears to use PgBouncer transaction pooler (port 6543). "
            "Switch to the session pooler (port 5432) to avoid prepared statement errors."
        )
    logger.info("Connecting to database...")
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("✅ Database connected and tables ready")
    except Exception as e:
        logger.error(f"❌ Database connection failed: {e}")
        raise

    # Verify DB is actually queryable
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(__import__("sqlalchemy").text("SELECT 1"))
        logger.info("✅ Database query test passed")
    except Exception as e:
        logger.error(f"❌ Database query test failed: {e}")
        raise


# Allowed CORS origins come from the CORS_ORIGINS env var (comma-separated).
# Falls back to localhost for local development.
_allowed_origins = [
    origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(webhooks.router, prefix="/webhooks", tags=["webhooks"])
app.include_router(pull_requests.router, prefix="/prs", tags=["pull-requests"])
app.include_router(incidents.router, prefix="/incidents", tags=["incidents"])
app.include_router(orgs.router, prefix="/orgs", tags=["orgs"])
app.include_router(ws.router, tags=["websocket"])
app.include_router(users.router, prefix="/users", tags=["users"])
app.include_router(notifications.router, prefix="/notifications", tags=["notifications"])


@app.get("/health")
async def health():
    return {"status": "ok"}
