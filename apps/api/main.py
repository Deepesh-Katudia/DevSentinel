from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import webhooks, pull_requests, incidents, orgs, ws

app = FastAPI(title="DevSentinel API", version="1.0.0")

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
