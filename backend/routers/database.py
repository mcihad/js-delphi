"""/api/db — visual database support and the secure DB proxy.

IDE endpoints (user session) manage encrypted connection definitions, schema
introspection, data previews, the visual query builder and migrations. The query /
table / proc endpoints are shared by the IDE (design-time live data) and generated apps
(run token: only statements registered by the last build are executed).
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Query
from sqlalchemy import select

from backend.deps import DbPrincipal, DbSession, Principal, load_project
from backend.models import DbConnection, Project, User
from backend.services.data import connection_manager as cm
from backend.services.data import migrations as mig
from backend.services.data import query_service as qs
from backend.services.data.adapters.base import TableRequest
from backend.services.data.adapters.sql import SqlAdapter
from backend.services.data.drivers import list_drivers
from backend.services.data.errors import DataError, DataForbidden, DataNotFound
from backend.services.data.query_builder import QuerySpec, compile_query

router = APIRouter(prefix="/api/db", tags=["database"])


def _ide_user(principal: DbPrincipal) -> User:
    if principal.kind != "user" or principal.user is None:
        raise DataForbidden("Bu işlem yalnızca IDE oturumuyla yapılabilir")
    return principal.user


def _project(db: DbSession, principal: DbPrincipal, project_id: str, write: bool = False) -> Project:
    project, _ = load_project(db, project_id, _ide_user(principal), write=write)
    return project


def _connection(db: DbSession, principal: DbPrincipal, connection_id: str, *, write: bool = False, ide_only: bool = False) -> DbConnection:
    conn = cm.get_connection(db, connection_id)
    if principal.kind == "user" and principal.user is not None:
        load_project(db, conn.project_id, principal.user, write=write)
    elif ide_only:
        raise DataForbidden("Bu işlem yalnızca IDE oturumuyla yapılabilir")
    elif conn.project_id != principal.project_id:
        raise DataNotFound("Bağlantı bulunamadı")
    return conn


def _refresh_meta(db: DbSession, project_id: str) -> None:
    from backend.services.project_service import projects

    project = db.get(Project, project_id)
    if project is not None:
        projects.write_meta(db, project)


# --------------------------------------------------------------------------- drivers / connections


@router.get("/drivers")
def drivers(principal: Principal) -> list[dict[str, Any]]:
    _ide_user(principal)
    return list_drivers()


@router.get("/connections")
def list_connections(db: DbSession, principal: Principal, project_id: str = Query(...)) -> list[dict[str, Any]]:
    project = _project(db, principal, project_id)
    rows = db.scalars(select(DbConnection).where(DbConnection.project_id == project.id).order_by(DbConnection.name)).all()
    return [cm.connection_summary(c) for c in rows]


@router.post("/connections", status_code=201)
def create_connection(data: cm.ConnectionIn, db: DbSession, principal: Principal) -> dict[str, Any]:
    project = _project(db, principal, data.project_id, write=True)
    conn = cm.create_connection(db, project, data)
    _refresh_meta(db, project.id)
    db.commit()
    return cm.connection_summary(conn)


@router.post("/connections/test")
def test_unsaved(data: cm.ConnectionIn, db: DbSession, principal: Principal) -> dict[str, Any]:
    project = _project(db, principal, data.project_id)
    return cm.test_connection(db, project, data)


@router.get("/connections/{connection_id}")
def get_connection(connection_id: str, db: DbSession, principal: Principal) -> dict[str, Any]:
    return cm.connection_summary(_connection(db, principal, connection_id, ide_only=True))


@router.put("/connections/{connection_id}")
def update_connection(connection_id: str, data: cm.ConnectionIn, db: DbSession, principal: Principal) -> dict[str, Any]:
    conn = _connection(db, principal, connection_id, write=True, ide_only=True)
    cm.update_connection(db, conn, data)
    _refresh_meta(db, conn.project_id)
    db.commit()
    return cm.connection_summary(conn)


@router.delete("/connections/{connection_id}", status_code=204)
def delete_connection(connection_id: str, db: DbSession, principal: Principal) -> None:
    conn = _connection(db, principal, connection_id, write=True, ide_only=True)
    project_id = conn.project_id
    cm.delete_connection(db, conn)
    _refresh_meta(db, project_id)
    db.commit()


@router.post("/{connection_id}/test")
def test_saved(connection_id: str, db: DbSession, principal: Principal) -> dict[str, Any]:
    conn = _connection(db, principal, connection_id, ide_only=True)
    project = db.get(Project, conn.project_id)
    result = cm.test_connection(db, project, conn)
    db.commit()
    return result


# --------------------------------------------------------------------------- schema / preview


@router.get("/{connection_id}/schema")
def schema(connection_id: str, db: DbSession, principal: Principal, refresh: bool = False) -> dict[str, Any]:
    conn = _connection(db, principal, connection_id, ide_only=True)
    return cm.get_adapter(conn).get_schema(refresh=refresh)


@router.get("/{connection_id}/tables/{table}/preview")
def preview(
    connection_id: str,
    table: str,
    db: DbSession,
    principal: Principal,
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
) -> dict[str, Any]:
    conn = _connection(db, principal, connection_id, ide_only=True)
    return qs.preview_table(conn, table, limit=limit, offset=offset)


# --------------------------------------------------------------------------- proxy


@router.post("/{connection_id}/query")
def query(connection_id: str, req: qs.QueryRequest, db: DbSession, principal: Principal) -> dict[str, Any]:
    conn = _connection(db, principal, connection_id, write=req.mode == "exec")
    return qs.run_query(db, principal, conn, req.sql, dict(req.params), max_rows=req.max_rows, offset=req.offset, mode=req.mode)


@router.post("/{connection_id}/table")
def table(connection_id: str, req: TableRequest, db: DbSession, principal: Principal) -> dict[str, Any]:
    conn = _connection(db, principal, connection_id, write=req.op != "select")
    return qs.run_table_op(db, principal, conn, req)


@router.post("/{connection_id}/proc")
def proc(connection_id: str, req: qs.ProcRequest, db: DbSession, principal: Principal) -> dict[str, Any]:
    conn = _connection(db, principal, connection_id, write=True)
    return qs.run_proc(db, principal, conn, req)


# --------------------------------------------------------------------------- query builder


@router.post("/{connection_id}/query-builder")
def query_builder(connection_id: str, spec: QuerySpec, db: DbSession, principal: Principal) -> dict[str, Any]:
    conn = _connection(db, principal, connection_id, ide_only=True)
    adapter = cm.get_adapter(conn)
    if not isinstance(adapter, SqlAdapter):
        raise DataError("Görsel sorgu oluşturucu yalnızca SQL veritabanlarında kullanılabilir")
    return compile_query(adapter, spec)


# --------------------------------------------------------------------------- migrations


@router.get("/{connection_id}/migrations")
def migrations(connection_id: str, db: DbSession, principal: Principal) -> dict[str, Any]:
    return mig.list_migrations(db, _connection(db, principal, connection_id, ide_only=True))


@router.get("/{connection_id}/target-schema")
def target_schema(connection_id: str, db: DbSession, principal: Principal) -> dict[str, Any]:
    conn = _connection(db, principal, connection_id, ide_only=True)
    adapter = cm.get_adapter(conn)
    if not isinstance(adapter, SqlAdapter):
        raise DataError("Tablo tasarımcısı yalnızca SQL veritabanlarında kullanılabilir")
    return mig.live_schema_as_target(adapter)


@router.post("/{connection_id}/migrations", status_code=201)
def create_migration(connection_id: str, data: mig.MigrationCreate, db: DbSession, principal: Principal) -> dict[str, Any]:
    conn = _connection(db, principal, connection_id, write=True, ide_only=True)
    result = mig.create_migration(db, conn, data)
    db.commit()
    return result


@router.post("/{connection_id}/migrations/sql")
def migration_sql(connection_id: str, body: dict[str, Any], db: DbSession, principal: Principal) -> dict[str, str]:
    conn = _connection(db, principal, connection_id, ide_only=True)
    adapter = cm.get_adapter(conn)
    if not isinstance(adapter, SqlAdapter):
        raise DataError("Migration yalnızca SQL veritabanlarında desteklenir")
    return {"sql": mig.render_sql(adapter, list(body.get("ops") or []))}


@router.post("/{connection_id}/migrations/upgrade")
def migrations_upgrade(connection_id: str, body: mig.MigrationTarget, db: DbSession, principal: Principal) -> dict[str, Any]:
    conn = _connection(db, principal, connection_id, write=True, ide_only=True)
    return mig.upgrade(db, conn, body.target)


@router.post("/{connection_id}/migrations/downgrade")
def migrations_downgrade(connection_id: str, body: mig.MigrationTarget, db: DbSession, principal: Principal) -> dict[str, Any]:
    conn = _connection(db, principal, connection_id, write=True, ide_only=True)
    return mig.downgrade(db, conn, body.target if body.target != "head" else "-1")


@router.delete("/{connection_id}/migrations/{revision}", status_code=204)
def migrations_delete(connection_id: str, revision: str, db: DbSession, principal: Principal) -> None:
    conn = _connection(db, principal, connection_id, write=True, ide_only=True)
    mig.delete_migration(db, conn, revision)
    db.commit()
