"""FastAPI dependencies: authentication, project access and DB proxy principals."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.db import get_session
from backend.models import Project, ProjectMember, User
from backend.security import verify_token

DbSession = Annotated[Session, Depends(get_session)]


def _bearer(authorization: str | None) -> str | None:
    if not authorization:
        return None
    scheme, _, value = authorization.partition(" ")
    if scheme.lower() != "bearer" or not value:
        return None
    return value.strip()


def user_from_token(db: Session, token: str | None) -> User | None:
    if not token:
        return None
    body = verify_token(token, "user")
    if not body:
        return None
    return db.get(User, int(body.get("uid", 0)))


def get_current_user(db: DbSession, authorization: Annotated[str | None, Header()] = None) -> User:
    user = user_from_token(db, _bearer(authorization))
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Oturum gerekli", headers={"WWW-Authenticate": "Bearer"})
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def project_role(db: Session, project: Project, user: User) -> str | None:
    if project.owner_id == user.id:
        return "owner"
    member = db.scalar(
        select(ProjectMember).where(ProjectMember.project_id == project.id, ProjectMember.user_id == user.id)
    )
    return member.role if member else None


def load_project(db: Session, project_id: str, user: User, write: bool = False) -> tuple[Project, str]:
    project = db.get(Project, project_id)
    role = project_role(db, project, user) if project else None
    if project is None or role is None:
        # 404 for both cases: do not leak the existence of foreign projects.
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Proje bulunamadı")
    if write and role == "viewer":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Bu proje için yazma yetkiniz yok")
    return project, role


@dataclass
class DbPrincipal:
    """Who is calling the DB proxy.

    * ``user``  — the IDE (design-time): may run ad-hoc SQL on its own project's connections.
    * ``run``   — a generated app in the preview sandbox: only allow-listed statements.
    """

    kind: str  # "user" | "run"
    project_id: str | None = None  # fixed for run tokens
    user: User | None = None


def get_db_principal(db: DbSession, authorization: Annotated[str | None, Header()] = None) -> DbPrincipal:
    token = _bearer(authorization)
    user = user_from_token(db, token)
    if user is not None:
        return DbPrincipal(kind="user", user=user)
    body = verify_token(token or "", "run")
    if body:
        return DbPrincipal(kind="run", project_id=str(body.get("pid")))
    raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Geçerli bir oturum ya da çalıştırma anahtarı gerekli")


Principal = Annotated[DbPrincipal, Depends(get_db_principal)]
