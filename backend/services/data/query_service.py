"""DataService — the backend proxy every TQuery/TTable/TStoredProc request goes through.

Rules enforced here (on top of the adapters' own guards):

* exactly one statement; DDL and "other" statements are refused;
* ``mode=query`` only runs SELECT, ``mode=exec`` only INSERT/UPDATE/DELETE;
* parameters are *always* bound (``sqlalchemy.text`` bind params) and must be JSON
  scalars; missing and unknown parameters are rejected;
* read-only connections accept SELECT only;
* generated apps (run tokens) may only execute statements, tables and procedures that
  the last build registered in ``build_statements`` for the same project/connection —
  so a compromised page cannot run arbitrary SQL. Projects can opt into ad-hoc
  *SELECT* statements during development with ``settings.allowAdHocSql``.
"""
from __future__ import annotations

import json
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.config import settings
from backend.deps import DbPrincipal
from backend.models import BuildStatement, DbConnection, Project
from backend.services.data.adapters.base import Scalar, TableRequest
from backend.services.data.connection_manager import get_adapter
from backend.services.data.errors import DataError, DataForbidden, DataNotFound
from backend.services.data.adapters.mongo import param_names as mongo_param_names
from backend.services.data.adapters.mongo import parse_find_spec
from backend.services.data.sql_safety import (
    SqlSafetyError,
    classify_sql,
    ensure_single_statement,
    extract_param_names,
    statement_digest,
)

MAX_SQL_LENGTH = 100_000


class QueryRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sql: str = Field(min_length=1, max_length=MAX_SQL_LENGTH)
    params: dict[str, Scalar] = Field(default_factory=dict)
    max_rows: int | None = Field(default=None, ge=1)
    offset: int = Field(default=0, ge=0, le=10_000_000)
    mode: Literal["query", "exec"] = "query"


class ProcRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=256)
    params: dict[str, Scalar] = Field(default_factory=dict)
    max_rows: int | None = Field(default=None, ge=1)


def row_limit(requested: int | None) -> int:
    return max(1, min(requested or settings.db_default_rows, settings.db_max_rows))


# --------------------------------------------------------------------------- allow-list


def is_statement_allowed(db: Session, project_id: str, connection_name: str, kind: str, text: str) -> bool:
    digest = statement_digest(kind, text)
    rows = db.scalars(
        select(BuildStatement).where(
            BuildStatement.project_id == project_id,
            BuildStatement.kind == kind,
            BuildStatement.digest == digest,
        )
    ).all()
    return any(r.connection_name.lower() == connection_name.lower() for r in rows)


def table_permission(db: Session, project_id: str, connection_name: str, table: str) -> str | None:
    """"write" / "read" for allow-listed tables, None when the build did not register it."""
    digest = statement_digest("table", table)
    rows = [
        r
        for r in db.scalars(
            select(BuildStatement).where(BuildStatement.project_id == project_id, BuildStatement.kind == "table", BuildStatement.digest == digest)
        ).all()
        if r.connection_name.lower() == connection_name.lower()
    ]
    if not rows:
        return None
    return "write" if any(not r.read_only for r in rows) else "read"


def _project_allows_adhoc(db: Session, project_id: str) -> bool:
    project = db.get(Project, project_id)
    try:
        return bool(project and json.loads(project.settings_json or "{}").get("allowAdHocSql"))
    except json.JSONDecodeError:
        return False


def _check_run_scope(principal: DbPrincipal, conn: DbConnection) -> None:
    if principal.kind == "run" and conn.project_id != principal.project_id:
        raise DataNotFound("Bağlantı bulunamadı")


def _check_params(names: list[str], params: dict[str, Any]) -> dict[str, Any]:
    missing = [n for n in names if n not in params]
    if missing:
        raise DataError(f"Eksik parametre: {', '.join(missing)}")
    unknown = sorted(set(params) - set(names))
    if unknown:
        raise DataError(f"SQL içinde bulunmayan parametre: {', '.join(unknown)}")
    return {n: params[n] for n in names}


# --------------------------------------------------------------------------- operations


def run_query(
    db: Session,
    principal: DbPrincipal,
    conn: DbConnection,
    sql: str,
    params: dict[str, Any],
    *,
    max_rows: int | None = None,
    offset: int = 0,
    mode: str = "query",
) -> dict[str, Any]:
    _check_run_scope(principal, conn)
    adapter = get_adapter(conn)
    limit = row_limit(max_rows)

    if adapter.family == "mongo":
        if principal.kind == "run" and not is_statement_allowed(db, conn.project_id, conn.name, "sql", sql):
            raise DataForbidden("Bu sorgu derleme manifestinde kayıtlı değil")
        bound = _check_params(mongo_param_names(parse_find_spec(sql)), params)
        return adapter.execute(sql, bound, limit=limit, offset=offset, mode=mode, kind="select").to_dict()

    try:
        statement = ensure_single_statement(sql, dialect=adapter.dialect_name)
    except SqlSafetyError as exc:
        raise DataError(str(exc)) from exc
    kind = classify_sql(statement)
    if kind in ("ddl", "other"):
        raise DataForbidden("Yalnızca SELECT, INSERT, UPDATE ve DELETE ifadeleri çalıştırılabilir (şema değişiklikleri için migration kullanın)")
    if mode == "query" and kind != "select":
        raise DataError("Sorgu (Open) modunda yalnızca SELECT çalıştırılabilir; değişiklik için ExecSQL kullanın")
    if mode == "exec" and kind == "select":
        raise DataError("ExecSQL ile SELECT çalıştırılamaz; veri kümesini Open ile açın")
    if kind != "select" and (conn.read_only or adapter.read_only):
        raise DataForbidden("Bu bağlantı salt okunur")
    if principal.kind == "run" and not is_statement_allowed(db, conn.project_id, conn.name, "sql", statement):
        if not (kind == "select" and _project_allows_adhoc(db, conn.project_id)):
            raise DataForbidden("Bu SQL ifadesi derleme manifestinde kayıtlı değil (yalnızca tasarımda tanımlı TQuery ifadeleri çalışır)")
    bound = _check_params(extract_param_names(statement), params)
    result = adapter.execute(statement, bound, limit=limit, offset=offset, mode=mode, kind=kind)
    return result.to_dict()


def run_table_op(db: Session, principal: DbPrincipal, conn: DbConnection, request: TableRequest) -> dict[str, Any]:
    _check_run_scope(principal, conn)
    adapter = get_adapter(conn)
    if principal.kind == "run":
        perm = table_permission(db, conn.project_id, conn.name, request.table)
        if perm is None:
            raise DataForbidden(f"'{request.table}' tablosu derleme manifestinde kayıtlı değil")
        if request.op != "select" and perm != "write":
            raise DataForbidden(f"'{request.table}' tablosu salt okunur (TTable.ReadOnly)")
    if request.op != "select" and (conn.read_only or adapter.read_only):
        raise DataForbidden("Bu bağlantı salt okunur")
    return adapter.table_op(request, limit=row_limit(request.limit))


def run_proc(db: Session, principal: DbPrincipal, conn: DbConnection, request: ProcRequest) -> dict[str, Any]:
    _check_run_scope(principal, conn)
    adapter = get_adapter(conn)
    if principal.kind == "run" and not is_statement_allowed(db, conn.project_id, conn.name, "proc", request.name):
        raise DataForbidden(f"'{request.name}' yordamı derleme manifestinde kayıtlı değil")
    if conn.read_only or adapter.read_only:
        raise DataForbidden("Bu bağlantı salt okunur; saklı yordam çağrılamaz")
    for key in request.params:
        if not key.isidentifier():
            raise DataError(f"Geçersiz parametre adı: {key}")
    return adapter.call_procedure(request.name, dict(request.params), limit=row_limit(request.max_rows)).to_dict()


def preview_table(conn: DbConnection, table: str, *, limit: int, offset: int) -> dict[str, Any]:
    adapter = get_adapter(conn)
    return adapter.table_op(TableRequest(op="select", table=table, offset=offset, limit=limit), limit=row_limit(limit))
