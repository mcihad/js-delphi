"""/api/runtime/* — the fixed VCL runtime (never generated; the IDE and builds copy it)."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from backend.config import settings

router = APIRouter(prefix="/api/runtime", tags=["runtime"])

_FILES = {
    "vcl.ts": "text/plain; charset=utf-8",
    "vcl.js": "text/javascript; charset=utf-8",
    "vcl.css": "text/css; charset=utf-8",
    "vcl.d.ts": "text/plain; charset=utf-8",
    "vcl.global.d.ts": "text/plain; charset=utf-8",
    "vcl.manifest.json": "application/json",
}


@router.get("/{name}")
def runtime_file(name: str):
    media = _FILES.get(name)
    if media is None:
        raise HTTPException(404, "Bilinmeyen runtime dosyası")
    path = settings.runtime_dir / name
    if not path.is_file():
        raise HTTPException(404, f"{name} henüz üretilmemiş — 'npm run build:runtime'")
    return FileResponse(path, media_type=media, headers={"Cache-Control": "no-cache"})
