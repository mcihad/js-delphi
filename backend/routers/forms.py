"""/api/projects/{id}/forms — form CRUD (design + unit), revision history and restore.

Saves arrive debounced (300 ms) from the IDE. ``base_version`` gives optimistic
concurrency; every successful change is broadcast to the other collaborators.
"""
from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Header
from sqlalchemy import select

from backend.deps import CurrentUser, DbSession, load_project
from backend.models import Form
from backend.schemas import FormCreate, FormOut, FormUpdate, RevisionDetail, RevisionOut
from backend.services.project_service import projects
from backend.services.sync_service import hub

router = APIRouter(prefix="/api/projects/{project_id}/forms", tags=["forms"])


@router.get("", response_model=list[FormOut])
def list_forms(project_id: str, db: DbSession, user: CurrentUser):
    project, _ = load_project(db, project_id, user)
    forms = db.scalars(select(Form).where(Form.project_id == project.id).order_by(Form.sort_order, Form.name)).all()
    return [projects.form_out(db, project, f) for f in forms]


@router.post("", response_model=FormOut, status_code=201)
def create_form(
    project_id: str,
    data: FormCreate,
    db: DbSession,
    user: CurrentUser,
    tasks: BackgroundTasks,
    x_client_id: str | None = Header(default=None),
):
    project, _ = load_project(db, project_id, user, write=True)
    form = projects.create_form(db, project, user, data)
    projects.write_meta(db, project)
    db.commit()
    db.refresh(form)
    out = projects.form_out(db, project, form)
    tasks.add_task(hub.broadcast, project.id, {"type": "form.created", "form": out.model_dump(mode="json"), "by": user.username}, x_client_id)
    return out


@router.get("/{form_id}", response_model=FormOut)
def get_form(project_id: str, form_id: str, db: DbSession, user: CurrentUser):
    project, _ = load_project(db, project_id, user)
    out = projects.form_out(db, project, projects.get_form(db, project, form_id))
    out.warnings = projects.design_warnings(db, project, out.design)
    return out


@router.put("/{form_id}", response_model=FormOut)
def update_form(
    project_id: str,
    form_id: str,
    data: FormUpdate,
    db: DbSession,
    user: CurrentUser,
    tasks: BackgroundTasks,
    x_client_id: str | None = Header(default=None),
):
    project, _ = load_project(db, project_id, user, write=True)
    form = projects.get_form(db, project, form_id)
    form, changed, warnings = projects.update_form(db, project, form, user, data)
    out = projects.form_out(db, project, form, warnings)
    if changed:
        event = {
            "type": "form.saved",
            "form_id": form.id,
            "name": form.name,
            "version": form.version,
            "by": user.username,
            "design": out.design if data.design is not None or data.name is not None else None,
            "code": out.code if data.code is not None else None,
            "code_js": out.code_js if data.code_js is not None or data.code is not None else None,
        }
        tasks.add_task(hub.broadcast, project.id, event, x_client_id)
    return out


@router.delete("/{form_id}", status_code=204)
def delete_form(
    project_id: str,
    form_id: str,
    db: DbSession,
    user: CurrentUser,
    tasks: BackgroundTasks,
    x_client_id: str | None = Header(default=None),
):
    project, _ = load_project(db, project_id, user, write=True)
    form = projects.get_form(db, project, form_id)
    name = form.name
    projects.delete_form(db, project, form)
    tasks.add_task(hub.broadcast, project.id, {"type": "form.deleted", "form_id": form_id, "name": name, "by": user.username}, x_client_id)


@router.get("/{form_id}/revisions", response_model=list[RevisionOut])
def list_revisions(project_id: str, form_id: str, db: DbSession, user: CurrentUser):
    project, _ = load_project(db, project_id, user)
    return projects.list_revisions(db, projects.get_form(db, project, form_id))


@router.get("/{form_id}/revisions/{revision_id}", response_model=RevisionDetail)
def get_revision(project_id: str, form_id: str, revision_id: int, db: DbSession, user: CurrentUser):
    project, _ = load_project(db, project_id, user)
    return projects.get_revision(db, projects.get_form(db, project, form_id), revision_id)


@router.post("/{form_id}/revisions/{revision_id}/restore", response_model=FormOut)
def restore_revision(
    project_id: str,
    form_id: str,
    revision_id: int,
    db: DbSession,
    user: CurrentUser,
    tasks: BackgroundTasks,
    x_client_id: str | None = Header(default=None),
):
    project, _ = load_project(db, project_id, user, write=True)
    form = projects.restore_revision(db, project, projects.get_form(db, project, form_id), user, revision_id)
    out = projects.form_out(db, project, form)
    tasks.add_task(
        hub.broadcast,
        project.id,
        {"type": "form.saved", "form_id": form.id, "name": form.name, "version": form.version, "by": user.username, "design": out.design, "code": out.code, "code_js": out.code_js},
        x_client_id,
    )
    return out
