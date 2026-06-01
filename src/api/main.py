import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from fastapi.staticfiles import StaticFiles
from pathlib import Path

from src.api.routers import (
    action_plans,
    admin,
    assessments,
    auth,
    health,
    leader_analysis,
    modules,
    notifications,
    periods,
    programs,
    qualitative,
    reports,
    students,
)
from src.api.routers.auth import limiter
from src.api.routers import rubrics
from src.core.config import settings
from src.db.base import Base, engine

logger = logging.getLogger("ra_assessment")


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.APP_ENV == "development":
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    yield


app = FastAPI(title="RA Assessment API", version="0.1.0", lifespan=lifespan)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = round((time.perf_counter() - start) * 1000)
    logger.info("%s %s %d %dms", request.method, request.url.path, response.status_code, elapsed_ms)
    return response


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


app.include_router(health.router)
app.include_router(auth.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
app.include_router(periods.router, prefix="/api/v1")
app.include_router(modules.router, prefix="/api/v1")
app.include_router(rubrics.router, prefix="/api/v1")
app.include_router(programs.router, prefix="/api/v1")
app.include_router(assessments.router, prefix="/api/v1")
app.include_router(qualitative.router, prefix="/api/v1")
app.include_router(students.router, prefix="/api/v1")
app.include_router(leader_analysis.router, prefix="/api/v1")
app.include_router(action_plans.router, prefix="/api/v1")
app.include_router(reports.router, prefix="/api/v1")
app.include_router(notifications.router, prefix="/api/v1")

_frontend_dir = Path(__file__).resolve().parents[2] / "frontend"
if settings.APP_ENV in ("development", "test_e2e") and _frontend_dir.is_dir():
    app.mount("/", StaticFiles(directory=str(_frontend_dir), html=True), name="frontend")
