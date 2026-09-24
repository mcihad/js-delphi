"""/api/projects/{id}/build | run | export."""
from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Header
from fastapi.responses import Response

from backend.config import settings
from backend.deps import CurrentUser, DbSession, load_project
from backend.schemas import BuildRequest, BuildResult, RunResult
from backend.security import sign_token
from backend.services.build_service import builder
from backend.services.project_service import slugify
from backend.services.sync_service import hub

router = APIRouter(prefix="/api/projects/{project_id}", tags=["build"])


def run_token(project_id: str) -> str:
    return sign_token({"typ": "run", "pid": project_id}, settings.run_token_ttl_seconds)


@router.post("/build", response_model=BuildResult)
def build_project(
    project_id: str,
    db: DbSession,
    user: CurrentUser,
    tasks: BackgroundTasks,
    req: BuildRequest | None = None,
    x_client_id: str | None = Header(default=None),
):
    project, _ = load_project(db, project_id, user, write=True)
    result = builder.build(db, project, user, force=bool(req and req.force))
    tasks.add_task(
        hub.broadcast,
        project.id,
        {"type": "build.done", "ok": result.ok, "by": user.username, "changed": result.changed, "rebuilt": result.rebuilt_units},
        x_client_id,
    )
    return result


@router.post("/run", response_model=RunResult)
def run_project(project_id: str, db: DbSession, user: CurrentUser, req: BuildRequest | None = None):
    """Incremental build + short-lived run token. The token scopes the preview files and
    the runtime DB proxy (allow-listed statements only) to this project."""
    project, _ = load_project(db, project_id, user, write=True)
    result = builder.build(db, project, user, force=bool(req and req.force))
    if not result.ok:
        return RunResult(ok=False, build=result)
    token = run_token(project.id)
    main = project.main_form
    return RunResult(
        ok=True,
        build=result,
        url=f"/preview/{project.id}/{token}/{main}.html",
        token=token,
        expires_in=settings.run_token_ttl_seconds,
    )


@router.post("/preview-token")
def preview_token(project_id: str, db: DbSession, user: CurrentUser):
    """Token for design-time asset previews (TImage) without running a build."""
    project, _ = load_project(db, project_id, user)
    return {"token": run_token(project.id), "base": f"/preview/{project.id}/", "expires_in": settings.run_token_ttl_seconds}


@router.post("/export")
def export_project(project_id: str, db: DbSession, user: CurrentUser, include_data: bool = False):
    project, _ = load_project(db, project_id, user)
    data, result = builder.export_zip(db, project, user, include_data=include_data)
    filename = f"{slugify(project.name)}.zip"
    return Response(
        content=data,
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-Build-Ok": "1" if result.ok else "0",
            "Cache-Control": "no-store",
        },
    )
