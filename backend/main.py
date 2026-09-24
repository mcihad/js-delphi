"""JS-Delphi backend entry point.

Run (from the repository root):
    uv run uvicorn backend.main:app --reload --port 8000   (or: make backend)
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from backend.config import settings
from backend.db import init_db
from backend.routers import auth, build, database, forms, preview, projects, runtime, ws

log = logging.getLogger("jsdelphi")

# Paths reachable from sandboxed preview iframes (Origin: null). They authenticate with
# bearer tokens only (never cookies), so a wildcard CORS policy does not leak anything.
_SANDBOX_CORS_PREFIXES = ("/api/db/", "/api/runtime/")


class SandboxCorsMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if not path.startswith(_SANDBOX_CORS_PREFIXES):
            return await call_next(request)
        headers = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Client-Id",
            "Access-Control-Max-Age": "600",
        }
        if request.method == "OPTIONS" and "access-control-request-method" in request.headers:
            return Response(status_code=204, headers=headers)
        response = await call_next(request)
        response.headers.update(headers)
        return response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("Referrer-Policy", "same-origin")
        if not request.url.path.startswith("/preview/"):
            response.headers.setdefault("X-Frame-Options", "SAMEORIGIN")
        return response


@asynccontextmanager
async def lifespan(_app: FastAPI):
    settings.ensure_dirs()
    init_db()
    if settings.seed_demo:
        from backend.services.seed import ensure_demo_content

        try:
            ensure_demo_content()
        except Exception:  # pragma: no cover - seeding must never block startup
            log.exception("demo seed failed")
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title="JS-Delphi IDE API",
        version=settings.version,
        description="Web tabanlı Delphi RAD IDE — FastAPI backend",
        lifespan=lifespan,
    )
    # Starlette: the middleware added last runs first. SandboxCors must sit outside the
    # regular CORSMiddleware, which would reject the sandbox's "Origin: null" preflight.
    if settings.cors_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=list(settings.cors_origins),
            allow_methods=["*"],
            allow_headers=["*"],
        )
    app.add_middleware(SandboxCorsMiddleware)
    app.add_middleware(SecurityHeadersMiddleware)

    for module in (auth, projects, forms, build, runtime, database, preview, ws):
        app.include_router(module.router)

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok", "version": settings.version}

    @app.exception_handler(ValueError)
    async def value_error_handler(_request: Request, exc: ValueError):
        return JSONResponse(status_code=400, content={"detail": str(exc)})

    _mount_frontend(app)
    return app


def _mount_frontend(app: FastAPI) -> None:
    """Serve the built IDE (frontend/dist) when present — single-origin production deploy."""
    dist = settings.frontend_dist
    if not (dist / "index.html").is_file():
        return
    from backend.security import PathSecurityError, lock_path

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa(full_path: str):
        if full_path.startswith(("api/", "ws/", "preview/")):
            return JSONResponse(status_code=404, content={"detail": "Not Found"})
        try:
            target = lock_path(dist, full_path) if full_path else dist / "index.html"
        except PathSecurityError:
            return JSONResponse(status_code=404, content={"detail": "Not Found"})
        if target.is_file():
            headers = {"Cache-Control": "public, max-age=31536000, immutable"} if "/assets/" in f"/{full_path}" else {}
            return FileResponse(target, headers=headers)
        return FileResponse(dist / "index.html", headers={"Cache-Control": "no-cache"})


app = create_app()
