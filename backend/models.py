"""ORM models of the IDE metadata database.

SQLite keeps: project metadata, component-tree JSON blobs, user code, revision
history, build output hashes, the build allow-lists used by the runtime DB proxy
and AES-GCM encrypted database connection definitions.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def new_id() -> str:
    return uuid.uuid4().hex


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(128), default="")
    password_hash: Mapped[str] = mapped_column(String(256), default="")
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    color: Mapped[str] = mapped_column(String(16), default="#4fc1ff")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(String(64))  # identifier-safe name (Project1)
    title: Mapped[str] = mapped_column(String(200), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    main_form: Mapped[str] = mapped_column(String(64), default="Form1")
    settings_json: Mapped[str] = mapped_column(Text, default="{}")
    version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    forms: Mapped[list[Form]] = relationship(
        back_populates="project", cascade="all, delete-orphan", order_by="Form.sort_order"
    )
    members: Mapped[list[ProjectMember]] = relationship(cascade="all, delete-orphan")


class ProjectMember(Base):
    __tablename__ = "project_members"
    __table_args__ = (UniqueConstraint("project_id", "user_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(String(16), default="editor")  # editor | viewer


class Form(Base):
    __tablename__ = "forms"
    __table_args__ = (UniqueConstraint("project_id", "name"),)

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(64))  # Form1
    design_json: Mapped[str] = mapped_column(Text)  # canonical Form1.design.tson
    code: Mapped[str] = mapped_column(Text, default="")  # unit source (Form1.ts)
    code_js: Mapped[str] = mapped_column(Text, default="")  # type-stripped unit (IDE compiler output)
    design_hash: Mapped[str] = mapped_column(String(64), default="")
    code_hash: Mapped[str] = mapped_column(String(64), default="")
    version: Mapped[int] = mapped_column(Integer, default=1)
    auto_create: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    updated_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    project: Mapped[Project] = relationship(back_populates="forms")


class FormRevision(Base):
    """Immutable snapshot of a form (design + unit). Enables history, diff and restore."""

    __tablename__ = "form_revisions"
    __table_args__ = (UniqueConstraint("form_id", "version"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    form_id: Mapped[str] = mapped_column(ForeignKey("forms.id", ondelete="CASCADE"), index=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    version: Mapped[int] = mapped_column(Integer)
    name: Mapped[str] = mapped_column(String(64))
    design_json: Mapped[str] = mapped_column(Text)
    code: Mapped[str] = mapped_column(Text, default="")
    code_js: Mapped[str] = mapped_column(Text, default="")
    content_hash: Mapped[str] = mapped_column(String(64))
    message: Mapped[str] = mapped_column(String(300), default="")
    author_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Build(Base):
    __tablename__ = "builds"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    ok: Mapped[bool] = mapped_column(Boolean, default=False)
    input_hash: Mapped[str] = mapped_column(String(64), default="")
    warnings_json: Mapped[str] = mapped_column(Text, default="[]")
    errors_json: Mapped[str] = mapped_column(Text, default="[]")
    changed_files: Mapped[int] = mapped_column(Integer, default=0)
    duration_ms: Mapped[int] = mapped_column(Integer, default=0)
    started_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class BuildArtifact(Base):
    """Output file hash registry — drives incremental builds."""

    __tablename__ = "build_artifacts"
    __table_args__ = (UniqueConstraint("project_id", "path"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    path: Mapped[str] = mapped_column(String(300))  # relative to build/
    unit: Mapped[str] = mapped_column(String(64), default="")  # form name or "" for project level
    input_hash: Mapped[str] = mapped_column(String(64))  # hash of everything that produced the file
    sha256: Mapped[str] = mapped_column(String(64))  # hash of the file content
    size: Mapped[int] = mapped_column(Integer, default=0)
    meta_json: Mapped[str] = mapped_column(Text, default="{}")  # e.g. {"user_code_line": 57}
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class BuildStatement(Base):
    """SQL allow-list produced by the last build (TQuery/TStoredProc/TTable components).

    The runtime DB proxy only executes statements whose normalised hash appears here.
    """

    __tablename__ = "build_statements"
    __table_args__ = (UniqueConstraint("project_id", "connection_name", "kind", "digest"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    connection_name: Mapped[str] = mapped_column(String(64))
    kind: Mapped[str] = mapped_column(String(16))  # sql | table | proc
    digest: Mapped[str] = mapped_column(String(64))  # sha256 of normalised SQL / table / proc name
    text: Mapped[str] = mapped_column(Text)  # SQL text, table name or procedure name
    read_only: Mapped[bool] = mapped_column(Boolean, default=True)
    source: Mapped[str] = mapped_column(String(160), default="")  # Form1.Query1


class DbConnection(Base):
    """Database connection definition. Secrets live only inside ``config_enc`` (AES-256-GCM)."""

    __tablename__ = "db_connections"
    __table_args__ = (UniqueConstraint("project_id", "name"),)

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(64))  # ConnectionDefName used by TConnection
    driver: Mapped[str] = mapped_column(String(32))  # sqlite | postgresql | mysql | mariadb | mssql | mongodb
    config_enc: Mapped[str] = mapped_column(Text)  # encrypted JSON (host, port, user, password, ...)
    summary_json: Mapped[str] = mapped_column(Text, default="{}")  # non secret, safe for the IDE
    read_only: Mapped[bool] = mapped_column(Boolean, default=False)
    last_test_ok: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    last_test_message: Mapped[str] = mapped_column(String(500), default="")
    last_test_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class Migration(Base):
    """Alembic-like revision (declarative JSON operations) bound to a connection."""

    __tablename__ = "migrations"
    __table_args__ = (UniqueConstraint("connection_id", "revision"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    connection_id: Mapped[str] = mapped_column(ForeignKey("db_connections.id", ondelete="CASCADE"), index=True)
    revision: Mapped[str] = mapped_column(String(32))
    down_revision: Mapped[str | None] = mapped_column(String(32), nullable=True)
    message: Mapped[str] = mapped_column(String(200), default="")
    upgrade_ops_json: Mapped[str] = mapped_column(Text, default="[]")
    downgrade_ops_json: Mapped[str] = mapped_column(Text, default="[]")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
