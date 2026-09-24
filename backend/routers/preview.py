"""/preview/{project_id}/{token}/… — serves the build folder to the IDE's sandboxed iframe.

* The run token (HMAC, short lived, project scoped) is part of the path so that relative
  module imports keep working; responses use ``Referrer-Policy: no-referrer``.
* The iframe runs with ``sandbox="allow-scripts"`` (opaque origin), so module scripts are
  CORS requests: ``Access-Control-Allow-Origin: *`` is required and safe here because
  nothing is authenticated by cookies.
* A strict CSP only allows scripts from this server.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from backend.security import PathSecurityError, lock_path, verify_token
from backend.services.file_service import files

router = APIRouter(tags=["preview"])

_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json",
    ".map": "application/json",
    ".ts": "text/plain; charset=utf-8",
    ".md": "text/plain; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".bmp": "image/bmp",
}

CSP = (
    "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
    "img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self'; "
    "base-uri 'none'; form-action 'none'; frame-ancestors 'self'"
)


@router.get("/preview/{project_id}/{token}/{path:path}", include_in_schema=False)
def preview_file(project_id: str, token: str, path: str = ""):
    body = verify_token(token, "run")
    if not body or body.get("pid") != project_id:
        raise HTTPException(404, "Önizleme bulunamadı ya da süresi doldu")
    try:
        root = files.build_dir(project_id)
        target = lock_path(root, path or "index.html")
    except (PathSecurityError, ValueError):
        raise HTTPException(404, "Bulunamadı") from None
    if target.is_dir():
        target = target / "index.html"
    if not target.is_file() and path.startswith("assets/"):
        # Design-time: assets uploaded but not built yet (TImage in the designer).
        try:
            target = lock_path(files.path(project_id, "assets"), path.removeprefix("assets/"))
        except (PathSecurityError, ValueError):
            raise HTTPException(404, "Bulunamadı") from None
    if not target.is_file() or target.name.startswith(".tmp-"):
        raise HTTPException(404, "Bulunamadı")
    media = _TYPES.get(target.suffix.lower(), "application/octet-stream")
    headers = {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
        "Access-Control-Allow-Origin": "*",
        "Cross-Origin-Resource-Policy": "cross-origin",
    }
    if media.startswith("text/html"):
        headers["Content-Security-Policy"] = CSP
    return FileResponse(target, media_type=media, headers=headers)
