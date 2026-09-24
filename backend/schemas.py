"""Pydantic request/response schemas of the public API."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

IDENT_PATTERN = r"^[A-Za-z_][A-Za-z0-9_]{0,63}$"


class ApiModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# --------------------------------------------------------------------------- auth


class LoginRequest(BaseModel):
    username: str = Field(min_length=2, max_length=64, pattern=r"^[A-Za-z0-9_.\-]+$")
    password: str = Field(min_length=1, max_length=256)


class RegisterRequest(LoginRequest):
    display_name: str = Field(default="", max_length=128)
    password: str = Field(min_length=8, max_length=256)


class DevLoginRequest(BaseModel):
    username: str = Field(default="developer", min_length=2, max_length=64, pattern=r"^[A-Za-z0-9_.\-]+$")
    display_name: str = Field(default="", max_length=128)


class UserOut(ApiModel):
    id: int
    username: str
    display_name: str
    color: str
    is_admin: bool


class TokenOut(BaseModel):
    token: str
    user: UserOut
    expires_in: int


# --------------------------------------------------------------------------- projects


class ProjectSettings(BaseModel):
    model_config = ConfigDict(extra="allow")

    gridSize: int = Field(default=8, ge=2, le=64)
    snapToGrid: bool = True
    showGrid: bool = True
    showGuides: bool = True
    allowAdHocSql: bool = False
    livePreview: bool = False
    theme: Literal["dark", "light"] = "light"


class ProjectCreate(BaseModel):
    name: str = Field(default="Project1", pattern=IDENT_PATTERN)
    title: str = Field(default="", max_length=200)
    description: str = Field(default="", max_length=4000)
    template: Literal["blank", "demo"] = "blank"


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, pattern=IDENT_PATTERN)
    title: str | None = Field(default=None, max_length=200)
    description: str | None = Field(default=None, max_length=4000)
    main_form: str | None = Field(default=None, pattern=IDENT_PATTERN)
    settings: dict[str, Any] | None = None


class FormSummary(ApiModel):
    id: str
    name: str
    version: int
    auto_create: bool
    sort_order: int
    design_hash: str
    code_hash: str
    updated_at: datetime


class ProjectOut(ApiModel):
    id: str
    name: str
    title: str
    description: str
    main_form: str
    version: int
    owner_id: int
    settings: dict[str, Any]
    created_at: datetime
    updated_at: datetime
    forms: list[FormSummary] = []
    role: str = "owner"


class ProjectListItem(ApiModel):
    id: str
    name: str
    title: str
    main_form: str
    updated_at: datetime
    form_count: int
    role: str


class MemberAdd(BaseModel):
    username: str
    role: Literal["editor", "viewer"] = "editor"


# --------------------------------------------------------------------------- forms


class FormCreate(BaseModel):
    name: str | None = Field(default=None, pattern=IDENT_PATTERN)
    caption: str | None = Field(default=None, max_length=200)
    design: dict[str, Any] | None = None
    code: str | None = None
    code_js: str | None = None


class FormUpdate(BaseModel):
    """Partial update. ``base_version`` enables optimistic concurrency (409 on mismatch)."""

    base_version: int | None = None
    name: str | None = Field(default=None, pattern=IDENT_PATTERN)
    design: dict[str, Any] | None = None
    code: str | None = Field(default=None, max_length=2_000_000)
    code_js: str | None = Field(default=None, max_length=2_000_000)
    auto_create: bool | None = None
    sort_order: int | None = None
    message: str | None = Field(default=None, max_length=300)


class FormOut(ApiModel):
    id: str
    project_id: str
    name: str
    version: int
    design: dict[str, Any]
    code: str
    code_js: str
    design_hash: str
    code_hash: str
    auto_create: bool
    sort_order: int
    updated_at: datetime
    warnings: list[str] = []


class RevisionOut(ApiModel):
    id: int
    version: int
    name: str
    content_hash: str
    message: str
    author: str | None = None
    created_at: datetime


class RevisionDetail(RevisionOut):
    design: dict[str, Any]
    code: str


# --------------------------------------------------------------------------- build


class BuildMessage(BaseModel):
    level: Literal["error", "warning", "info", "hint"] = "warning"
    message: str
    file: str | None = None
    line: int | None = None
    component: str | None = None


class BuildFile(BaseModel):
    path: str
    sha256: str
    size: int
    changed: bool
    unit: str = ""


class BuildResult(BaseModel):
    ok: bool
    files: list[BuildFile]
    warnings: list[BuildMessage]
    errors: list[BuildMessage] = []
    build_id: int | None = None
    duration_ms: int = 0
    changed: int = 0
    skipped_units: list[str] = []
    rebuilt_units: list[str] = []
    user_code_lines: dict[str, int] = {}  # Form1 -> first line of user code inside Form1.js


class BuildRequest(BaseModel):
    force: bool = False


class RunResult(BaseModel):
    ok: bool
    build: BuildResult
    url: str | None = None
    token: str | None = None
    expires_in: int = 0
