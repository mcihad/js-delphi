"""ProjectService — projects, forms and revision history.

SQLite is the source of truth for the IDE; every save is mirrored (write-through) to
``projects/<id>/`` as canonical, diff friendly files so a project can live in git.
"""
from __future__ import annotations

import json
import re
from datetime import timedelta
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.models import DbConnection, Form, FormRevision, Project, ProjectMember, User, utcnow
from backend.schemas import (
    FormCreate,
    FormOut,
    FormSummary,
    FormUpdate,
    ProjectCreate,
    ProjectListItem,
    ProjectOut,
    ProjectSettings,
    ProjectUpdate,
    RevisionDetail,
    RevisionOut,
)
from backend.security import is_valid_identifier, sha256_hex
from backend.services.design import (
    DesignError,
    canonical_design,
    design_hash,
    dumps_design,
    flatten_design,
    load_manifest,
    new_form_design,
    new_unit_code,
)
from backend.services.file_service import files

MAX_DESIGN_BYTES = 5 * 1024 * 1024
REVISION_COALESCE = timedelta(minutes=2)


def _settings(project: Project) -> dict[str, Any]:
    try:
        raw = json.loads(project.settings_json or "{}")
    except json.JSONDecodeError:
        raw = {}
    return ProjectSettings(**raw).model_dump()


def code_hash(code: str, code_js: str) -> str:
    return sha256_hex(code, code_js)


class ProjectService:
    # ------------------------------------------------------------ projects

    def list_projects(self, db: Session, user: User) -> list[ProjectListItem]:
        member_ids = select(ProjectMember.project_id).where(ProjectMember.user_id == user.id)
        rows = db.scalars(
            select(Project).where((Project.owner_id == user.id) | (Project.id.in_(member_ids))).order_by(Project.updated_at.desc())
        ).all()
        counts = dict(
            db.execute(select(Form.project_id, func.count(Form.id)).where(Form.project_id.in_([p.id for p in rows])).group_by(Form.project_id)).all()
        )
        roles = dict(db.execute(select(ProjectMember.project_id, ProjectMember.role).where(ProjectMember.user_id == user.id)).all())
        return [
            ProjectListItem(
                id=p.id,
                name=p.name,
                title=p.title or p.name,
                main_form=p.main_form,
                updated_at=p.updated_at,
                form_count=counts.get(p.id, 0),
                role="owner" if p.owner_id == user.id else roles.get(p.id, "viewer"),
            )
            for p in rows
        ]

    def create_project(self, db: Session, user: User, data: ProjectCreate) -> Project:
        project = Project(
            name=data.name,
            title=data.title or data.name,
            description=data.description,
            owner_id=user.id,
            main_form="Form1",
            settings_json=json.dumps(ProjectSettings().model_dump()),
        )
        db.add(project)
        db.flush()
        files.ensure_project_dirs(project.id)
        if data.template == "demo":
            from backend.services.seed import populate_demo_project

            populate_demo_project(db, project, user)
        else:
            self.create_form(db, project, user, FormCreate(name="Form1", caption=project.title or "Form1"))
        self.write_meta(db, project)
        db.commit()
        db.refresh(project)
        return project

    def project_out(self, db: Session, project: Project, role: str) -> ProjectOut:
        forms = db.scalars(select(Form).where(Form.project_id == project.id).order_by(Form.sort_order, Form.name)).all()
        return ProjectOut(
            id=project.id,
            name=project.name,
            title=project.title,
            description=project.description,
            main_form=project.main_form,
            version=project.version,
            owner_id=project.owner_id,
            settings=_settings(project),
            created_at=project.created_at,
            updated_at=project.updated_at,
            forms=[FormSummary.model_validate(f) for f in forms],
            role=role,
        )

    def update_project(self, db: Session, project: Project, data: ProjectUpdate) -> Project:
        if data.name is not None:
            project.name = data.name
        if data.title is not None:
            project.title = data.title
        if data.description is not None:
            project.description = data.description
        if data.main_form is not None:
            if not db.scalar(select(Form).where(Form.project_id == project.id, Form.name == data.main_form)):
                raise HTTPException(status.HTTP_400_BAD_REQUEST, f"'{data.main_form}' formu yok")
            project.main_form = data.main_form
        if data.settings is not None:
            merged = {**_settings(project), **data.settings}
            project.settings_json = json.dumps(ProjectSettings(**merged).model_dump())
        project.version += 1
        self.write_meta(db, project)
        db.commit()
        db.refresh(project)
        return project

    def delete_project(self, db: Session, project: Project) -> None:
        pid = project.id
        db.delete(project)
        db.commit()
        files.delete_project(pid)

    def write_meta(self, db: Session, project: Project) -> None:
        forms = db.scalars(select(Form).where(Form.project_id == project.id).order_by(Form.sort_order, Form.name)).all()
        conns = db.scalars(select(DbConnection).where(DbConnection.project_id == project.id).order_by(DbConnection.name)).all()
        files.write_project_meta(
            project.id,
            {
                "format": "jsd-project",
                "version": 1,
                "id": project.id,
                "name": project.name,
                "title": project.title,
                "description": project.description,
                "mainForm": project.main_form,
                "forms": [
                    {"name": f.name, "design": f"forms/{f.name}.design.tson", "unit": f"forms/{f.name}.ts", "autoCreate": f.auto_create}
                    for f in forms
                ],
                # connection *definitions* only — credentials live encrypted in the metadata DB
                "connections": [{"name": c.name, "driver": c.driver} for c in conns],
                "settings": _settings(project),
            },
        )

    # --------------------------------------------------------------- forms

    def get_form(self, db: Session, project: Project, form_id: str) -> Form:
        form = db.get(Form, form_id)
        if form is None or form.project_id != project.id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Form bulunamadı")
        return form

    def _next_form_name(self, db: Session, project: Project) -> str:
        existing = {n.lower() for n in db.scalars(select(Form.name).where(Form.project_id == project.id))}
        i = 1
        while f"form{i}" in existing:
            i += 1
        return f"Form{i}"

    def _check_name(self, db: Session, project: Project, name: str, exclude: str | None = None) -> None:
        if not is_valid_identifier(name):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"'{name}' geçerli bir form adı değil")
        manifest = load_manifest()
        if name in manifest.exports or name in manifest.reserved_members:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"'{name}' ayrılmış bir ad")
        clash = db.scalar(select(Form).where(Form.project_id == project.id, func.lower(Form.name) == name.lower()))
        if clash and clash.id != exclude:
            raise HTTPException(status.HTTP_409_CONFLICT, f"'{name}' adında bir form zaten var")

    def _validate_design(self, design: dict[str, Any], name: str) -> dict[str, Any]:
        try:
            canon = canonical_design(design)
        except DesignError as exc:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
        if canon["form"].get("name") != name:
            canon["form"]["name"] = name
        text = dumps_design(canon)
        if len(text.encode("utf-8")) > MAX_DESIGN_BYTES:
            raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Tasarım çok büyük")
        return canon

    def design_warnings(self, db: Session, project: Project, design: dict[str, Any]) -> list[str]:
        try:
            names = tuple(db.scalars(select(Form.name).where(Form.project_id == project.id)))
            flat = flatten_design(design, load_manifest(), form_names=names)
            return flat.errors + flat.warnings
        except (DesignError, RuntimeError) as exc:
            return [str(exc)]

    def create_form(self, db: Session, project: Project, user: User, data: FormCreate) -> Form:
        name = data.name or self._next_form_name(db, project)
        self._check_name(db, project, name)
        design = self._validate_design(data.design, name) if data.design else new_form_design(name, data.caption)
        code = data.code if data.code is not None else new_unit_code(name)
        code_js = data.code_js if data.code_js is not None else code
        order = (db.scalar(select(func.max(Form.sort_order)).where(Form.project_id == project.id)) or 0) + 1
        form = Form(
            project_id=project.id,
            name=name,
            design_json=dumps_design(design),
            code=code,
            code_js=code_js,
            design_hash=design_hash(design),
            code_hash=code_hash(code, code_js),
            version=1,
            sort_order=order,
            updated_by=user.id,
        )
        db.add(form)
        db.flush()
        self._record_revision(db, form, user, "Form oluşturuldu", force_new=True)
        files.write_form_files(project.id, form.name, form.design_json, form.code)
        project.version += 1
        return form

    def form_out(self, db: Session, project: Project, form: Form, warnings: list[str] | None = None) -> FormOut:
        return FormOut(
            id=form.id,
            project_id=form.project_id,
            name=form.name,
            version=form.version,
            design=json.loads(form.design_json),
            code=form.code,
            code_js=form.code_js,
            design_hash=form.design_hash,
            code_hash=form.code_hash,
            auto_create=form.auto_create,
            sort_order=form.sort_order,
            updated_at=form.updated_at,
            warnings=warnings if warnings is not None else [],
        )

    def update_form(self, db: Session, project: Project, form: Form, user: User, data: FormUpdate) -> tuple[Form, bool, list[str]]:
        if data.base_version is not None and data.base_version != form.version:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                detail={"message": "Form başka bir oturumda değişti", "version": form.version},
            )
        changed = False
        warnings: list[str] = []
        old_name = form.name
        if data.name is not None and data.name != form.name:
            self._check_name(db, project, data.name, exclude=form.id)
            files.rename_form_files(project.id, form.name, data.name)
            design = json.loads(form.design_json)
            design["form"]["name"] = data.name
            form.design_json = dumps_design(design)
            form.design_hash = design_hash(design)
            if project.main_form == old_name:
                project.main_form = data.name
            form.name = data.name
            changed = True
        if data.design is not None:
            design = self._validate_design(data.design, form.name)
            new_hash = design_hash(design)
            if new_hash != form.design_hash:
                form.design_json = dumps_design(design)
                form.design_hash = new_hash
                changed = True
            warnings = self.design_warnings(db, project, design)
        if data.code is not None or data.code_js is not None:
            code = data.code if data.code is not None else form.code
            code_js = data.code_js if data.code_js is not None else (code if data.code is not None else form.code_js)
            h = code_hash(code, code_js)
            if h != form.code_hash:
                form.code, form.code_js, form.code_hash = code, code_js, h
                changed = True
        if data.auto_create is not None and data.auto_create != form.auto_create:
            form.auto_create = data.auto_create
            changed = True
        if data.sort_order is not None and data.sort_order != form.sort_order:
            form.sort_order = data.sort_order
            changed = True
        if changed:
            form.version += 1
            form.updated_by = user.id
            form.updated_at = utcnow()
            project.version += 1
            self._record_revision(db, form, user, data.message or "")
            files.write_form_files(project.id, form.name, form.design_json, form.code)
            self.write_meta(db, project)
        db.commit()
        db.refresh(form)
        return form, changed, warnings

    def delete_form(self, db: Session, project: Project, form: Form) -> None:
        count = db.scalar(select(func.count(Form.id)).where(Form.project_id == project.id)) or 0
        if count <= 1:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Projede en az bir form kalmalı")
        name = form.name
        db.delete(form)
        db.flush()
        if project.main_form == name:
            first = db.scalar(select(Form).where(Form.project_id == project.id).order_by(Form.sort_order, Form.name))
            project.main_form = first.name if first else "Form1"
        project.version += 1
        files.delete_form_files(project.id, name)
        self.write_meta(db, project)
        db.commit()

    # ------------------------------------------------------------ revisions

    def _record_revision(self, db: Session, form: Form, user: User, message: str, force_new: bool = False) -> None:
        content = sha256_hex(form.design_json, form.code)
        last = db.scalar(select(FormRevision).where(FormRevision.form_id == form.id).order_by(FormRevision.version.desc()).limit(1))
        if last and last.content_hash == content and not message:
            return
        coalesce = (
            last is not None
            and not force_new
            and not message
            and not last.message
            and last.author_id == user.id
            and last.name == form.name
            and _age(last.created_at) < REVISION_COALESCE
        )
        if coalesce:
            last.design_json, last.code, last.code_js = form.design_json, form.code, form.code_js
            last.content_hash = content
            last.version = form.version
            return
        db.add(
            FormRevision(
                form_id=form.id,
                project_id=form.project_id,
                version=form.version,
                name=form.name,
                design_json=form.design_json,
                code=form.code,
                code_js=form.code_js,
                content_hash=content,
                message=message,
                author_id=user.id,
            )
        )

    def list_revisions(self, db: Session, form: Form) -> list[RevisionOut]:
        rows = db.execute(
            select(FormRevision, User.username)
            .join(User, User.id == FormRevision.author_id, isouter=True)
            .where(FormRevision.form_id == form.id)
            .order_by(FormRevision.version.desc())
            .limit(200)
        ).all()
        return [
            RevisionOut(
                id=r.id, version=r.version, name=r.name, content_hash=r.content_hash, message=r.message, author=u, created_at=r.created_at
            )
            for r, u in rows
        ]

    def get_revision(self, db: Session, form: Form, revision_id: int) -> RevisionDetail:
        r = db.get(FormRevision, revision_id)
        if r is None or r.form_id != form.id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Sürüm bulunamadı")
        author = db.get(User, r.author_id) if r.author_id else None
        return RevisionDetail(
            id=r.id,
            version=r.version,
            name=r.name,
            content_hash=r.content_hash,
            message=r.message,
            author=author.username if author else None,
            created_at=r.created_at,
            design=json.loads(r.design_json),
            code=r.code,
        )

    def restore_revision(self, db: Session, project: Project, form: Form, user: User, revision_id: int) -> Form:
        r = db.get(FormRevision, revision_id)
        if r is None or r.form_id != form.id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Sürüm bulunamadı")
        design = json.loads(r.design_json)
        design["form"]["name"] = form.name
        form, _, _ = self.update_form(
            db,
            project,
            form,
            user,
            FormUpdate(design=design, code=r.code, code_js=r.code_js, message=f"v{r.version} sürümüne geri dönüldü"),
        )
        return form


def _age(created_at) -> timedelta:
    now = utcnow()
    if created_at.tzinfo is None:
        now = now.replace(tzinfo=None)
    return now - created_at


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-") or "project"


projects = ProjectService()
