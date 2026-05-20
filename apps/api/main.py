import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import webhooks, pull_requests, incidents, orgs, ws
from models.database import Base, engine, AsyncSessionLocal, settings
import models.org  # noqa: F401
import models.incident  # noqa: F401
import models.pull_request  # noqa: F401

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="DevSentinel API", version="1.0.0")


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


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://devsentinel.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(webhooks.router, prefix="/webhooks", tags=["webhooks"])
app.include_router(pull_requests.router, prefix="/prs", tags=["pull-requests"])
app.include_router(incidents.router, prefix="/incidents", tags=["incidents"])
app.include_router(orgs.router, prefix="/orgs", tags=["orgs"])
app.include_router(ws.router, tags=["websocket"])


@app.get("/health")
async def health():
    return {"status": "ok"}
