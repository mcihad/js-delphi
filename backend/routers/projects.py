"""/api/projects — project CRUD, members and assets."""
from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, File, Header, HTTPException, UploadFile, status
from sqlalchemy import select

from backend.deps import CurrentUser, DbSession, load_project
from backend.models import ProjectMember, User
from backend.schemas import MemberAdd, ProjectCreate, ProjectListItem, ProjectOut, ProjectUpdate
from backend.services.file_service import files
from backend.services.project_service import projects
from backend.services.sync_service import hub

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.get("", response_model=list[ProjectListItem])
def list_projects(db: DbSession, user: CurrentUser):
    return projects.list_projects(db, user)


@router.post("", response_model=ProjectOut, status_code=201)
def create_project(data: ProjectCreate, db: DbSession, user: CurrentUser):
    project = projects.create_project(db, user, data)
    return projects.project_out(db, project, "owner")


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(project_id: str, db: DbSession, user: CurrentUser):
    project, role = load_project(db, project_id, user)
    return projects.project_out(db, project, role)


@router.put("/{project_id}", response_model=ProjectOut)
def update_project(
    project_id: str,
    data: ProjectUpdate,
    db: DbSession,
    user: CurrentUser,
    tasks: BackgroundTasks,
    x_client_id: str | None = Header(default=None),
):
    project, role = load_project(db, project_id, user, write=True)
    project = projects.update_project(db, project, data)
    out = projects.project_out(db, project, role)
    tasks.add_task(hub.broadcast, project.id, {"type": "project.updated", "project": out.model_dump(mode="json"), "by": user.username}, x_client_id)
    return out


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: str, db: DbSession, user: CurrentUser):
    project, role = load_project(db, project_id, user)
    if role != "owner":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Projeyi yalnızca sahibi silebilir")
    projects.delete_project(db, project)


@router.get("/{project_id}/members")
def list_members(project_id: str, db: DbSession, user: CurrentUser):
    project, _ = load_project(db, project_id, user)
    rows = db.execute(select(ProjectMember, User).join(User, User.id == ProjectMember.user_id).where(ProjectMember.project_id == project.id)).all()
    owner = db.get(User, project.owner_id)
    members = [{"username": owner.username, "display_name": owner.display_name, "role": "owner"}] if owner else []
    members += [{"username": u.username, "display_name": u.display_name, "role": m.role} for m, u in rows]
    return members


@router.post("/{project_id}/members", status_code=201)
def add_member(project_id: str, data: MemberAdd, db: DbSession, user: CurrentUser):
    project, role = load_project(db, project_id, user)
    if role != "owner":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Üye eklemeyi yalnızca proje sahibi yapabilir")
    target = db.scalar(select(User).where(User.username == data.username))
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Kullanıcı bulunamadı")
    if target.id == project.owner_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Proje sahibi zaten üyedir")
    member = db.scalar(select(ProjectMember).where(ProjectMember.project_id == project.id, ProjectMember.user_id == target.id))
    if member is None:
        db.add(ProjectMember(project_id=project.id, user_id=target.id, role=data.role))
    else:
        member.role = data.role
    db.commit()
    return {"username": target.username, "role": data.role}


@router.get("/{project_id}/assets")
def list_assets(project_id: str, db: DbSession, user: CurrentUser):
    project, _ = load_project(db, project_id, user)
    return {"assets": files.list_assets(project.id)}


@router.post("/{project_id}/assets", status_code=201)
async def upload_asset(project_id: str, db: DbSession, user: CurrentUser, file: UploadFile = File(...)):
    project, _ = load_project(db, project_id, user, write=True)
    data = await file.read(5 * 1024 * 1024 + 1)
    try:
        path = files.save_asset(project.id, file.filename or "asset.png", data)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return {"path": path}
