"""Alembic-like migrations with declarative JSON operations.

A revision is a list of ``upgrade_ops`` and ``downgrade_ops`` (create_table, drop_table,
add_column, drop_column, alter_column, create_index, drop_index, rename_table) stored in
the ``migrations`` table and mirrored to ``projects/<id>/data/migrations/*.json`` so they
can live in git. Operations are applied with ``alembic.operations.Operations`` (SQLite
uses batch "move and copy" for column changes); the applied head is tracked in the
target database table ``jsd_migrations`` (like ``alembic_version``).

``autogenerate`` diffs a *target schema* (designed in the IDE's table designer) against
the live database with ``alembic.autogenerate.compare_metadata``.
"""
from __future__ import annotations

import io
import json
import re
import secrets
from typing import Any, Literal

import sqlalchemy as sa
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from alembic.operations import Operations
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.config import settings
from backend.models import DbConnection, Migration
from backend.services.data.adapters.sql import SqlAdapter
from backend.services.data.connection_manager import get_adapter
from backend.services.data.errors import DataConflict, DataError, DataNotFound
from backend.services.data.introspection import INTERNAL_TABLES

VERSION_TABLE = "jsd_migrations"
_NAME_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]{0,63}$")
_SIMPLE_TYPES: dict[str, type[sa.types.TypeEngine[Any]]] = {
    "Integer": sa.Integer,
    "BigInteger": sa.BigInteger,
    "SmallInteger": sa.SmallInteger,
    "Text": sa.Text,
    "Boolean": sa.Boolean,
    "Date": sa.Date,
    "DateTime": sa.DateTime,
    "Time": sa.Time,
    "Float": sa.Float,
    "LargeBinary": sa.LargeBinary,
}
_STRING_RE = re.compile(r"^String\((\d{1,5})\)$")
_NUMERIC_RE = re.compile(r"^Numeric\((\d{1,2})\s*,\s*(\d{1,2})\)$")
OP_KINDS = ("create_table", "drop_table", "rename_table", "add_column", "drop_column", "alter_column", "create_index", "drop_index")


class ColumnDef(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str
    type: str = "String(255)"
    nullable: bool = True
    primary_key: bool = False
    autoincrement: bool = False
    default: str | int | float | bool | None = None
    unique: bool = False


class IndexDef(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str | None = None
    columns: list[str] = Field(min_length=1)
    unique: bool = False


class ForeignKeyDef(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str | None = None
    columns: list[str] = Field(min_length=1)
    ref_table: str
    ref_columns: list[str] = Field(min_length=1)


class TableDef(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str
    columns: list[ColumnDef] = Field(min_length=1)
    indexes: list[IndexDef] = Field(default_factory=list)
    foreign_keys: list[ForeignKeyDef] = Field(default_factory=list)


class TargetSchema(BaseModel):
    model_config = ConfigDict(extra="forbid")
    tables: list[TableDef] = Field(default_factory=list)


class MigrationCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    message: str = Field(default="", max_length=200)
    upgrade_ops: list[dict[str, Any]] | None = None
    downgrade_ops: list[dict[str, Any]] | None = None
    autogenerate: bool = False
    target_schema: TargetSchema | None = None
    allow_drop: bool = False


class MigrationTarget(BaseModel):
    model_config = ConfigDict(extra="forbid")
    target: str = "head"


# --------------------------------------------------------------------------- types


def parse_type(text: str) -> sa.types.TypeEngine[Any]:
    t = (text or "").strip()
    if t in _SIMPLE_TYPES:
        return _SIMPLE_TYPES[t]()
    if m := _STRING_RE.match(t):
        return sa.String(int(m.group(1)))
    if m := _NUMERIC_RE.match(t):
        return sa.Numeric(int(m.group(1)), int(m.group(2)))
    raise DataError(f"Desteklenmeyen kolon tipi: {text!r}")


def type_to_str(type_: sa.types.TypeEngine[Any]) -> str:
    """Portable name of a (reflected) SQLAlchemy type."""
    if isinstance(type_, sa.Boolean):
        return "Boolean"
    if isinstance(type_, sa.BigInteger):
        return "BigInteger"
    if isinstance(type_, sa.SmallInteger):
        return "SmallInteger"
    if isinstance(type_, sa.Integer):
        return "Integer"
    if isinstance(type_, sa.Float):
        return "Float"
    if isinstance(type_, sa.Numeric):
        precision = type_.precision or 18
        scale = type_.scale if type_.scale is not None else 2
        return f"Numeric({precision},{scale})"
    if isinstance(type_, sa.DateTime):
        return "DateTime"
    if isinstance(type_, sa.Date):
        return "Date"
    if isinstance(type_, sa.Time):
        return "Time"
    if isinstance(type_, sa.Text):
        return "Text"
    if isinstance(type_, sa.String):
        return f"String({type_.length})" if type_.length else "Text"
    if isinstance(type_, sa.types._Binary):
        return "LargeBinary"
    return "Text"


def _check_name(name: Any, what: str) -> str:
    if not isinstance(name, str) or not _NAME_RE.match(name) or name.lower() in INTERNAL_TABLES:
        raise DataError(f"Geçersiz {what} adı: {name!r}")
    return name


def column_from_def(c: ColumnDef) -> sa.Column[Any]:
    _check_name(c.name, "kolon")
    kwargs: dict[str, Any] = {"nullable": c.nullable and not c.primary_key, "primary_key": c.primary_key, "unique": c.unique or None}
    if c.primary_key and c.autoincrement:
        kwargs["autoincrement"] = True
    if c.default is not None:
        if isinstance(c.default, bool):
            kwargs["server_default"] = sa.true() if c.default else sa.false()
        elif isinstance(c.default, (int, float)):
            kwargs["server_default"] = sa.text(repr(c.default))
        else:
            kwargs["server_default"] = str(c.default)
    return sa.Column(c.name, parse_type(c.type), **kwargs)


def column_to_def(col: sa.Column[Any]) -> dict[str, Any]:
    default = None
    if col.server_default is not None and hasattr(col.server_default, "arg"):
        arg = col.server_default.arg
        default = str(arg.text if hasattr(arg, "text") else arg).strip("'")
    return ColumnDef(
        name=col.name,
        type=type_to_str(col.type),
        nullable=bool(col.nullable),
        primary_key=bool(col.primary_key),
        autoincrement=bool(col.primary_key and isinstance(col.type, sa.Integer) and col.autoincrement in (True, "auto")),
        default=default,
        unique=bool(col.unique),
    ).model_dump(exclude_defaults=False)


def table_to_op(table: sa.Table) -> dict[str, Any]:
    return {
        "op": "create_table",
        "table": table.name,
        "columns": [column_to_def(c) for c in table.columns],
        "foreign_keys": [
            {
                "name": fk.name,
                "columns": [e.parent.name for e in fk.elements],
                "ref_table": fk.elements[0].column.table.name,
                "ref_columns": [e.column.name for e in fk.elements],
            }
            for fk in table.foreign_key_constraints
        ],
        "indexes": [{"name": ix.name, "columns": [c.name for c in ix.columns], "unique": bool(ix.unique)} for ix in table.indexes],
    }


def schema_to_metadata(target: TargetSchema) -> sa.MetaData:
    md = sa.MetaData()
    for t in target.tables:
        _check_name(t.name, "tablo")
        cols = [column_from_def(c) for c in t.columns]
        constraints: list[Any] = [
            sa.ForeignKeyConstraint(fk.columns, [f"{fk.ref_table}.{rc}" for rc in fk.ref_columns], name=fk.name) for fk in t.foreign_keys
        ]
        table = sa.Table(t.name, md, *cols, *constraints)
        for ix in t.indexes:
            sa.Index(ix.name or f"ix_{t.name}_{'_'.join(ix.columns)}", *[table.c[c] for c in ix.columns], unique=ix.unique)
    return md


def live_schema_as_target(adapter: SqlAdapter) -> dict[str, Any]:
    """Current database schema in TargetSchema form (starting point of the table designer)."""
    tables = []
    for t in adapter.get_schema(refresh=True)["tables"]:
        if t["kind"] != "table":
            continue
        table = adapter.reflect_table(None if t.get("schema") in (None, adapter.get_schema().get("default_schema")) else t["schema"], t["name"])
        op = table_to_op(table)
        tables.append({"name": op["table"], "columns": op["columns"], "indexes": op["indexes"], "foreign_keys": op["foreign_keys"]})
    return {"tables": tables}


# --------------------------------------------------------------------------- ops


def validate_ops(ops: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out = []
    for raw in ops:
        if not isinstance(raw, dict) or raw.get("op") not in OP_KINDS:
            raise DataError(f"Bilinmeyen migration işlemi: {raw.get('op') if isinstance(raw, dict) else raw!r}")
        op = dict(raw)
        _check_name(op.get("table"), "tablo")
        kind = op["op"]
        if kind == "create_table":
            TableDef(name=op["table"], columns=op.get("columns") or [], indexes=op.get("indexes") or [], foreign_keys=op.get("foreign_keys") or [])
            for c in op["columns"]:
                parse_type(ColumnDef(**c).type)
        elif kind == "rename_table":
            _check_name(op.get("new_name"), "tablo")
        elif kind == "add_column":
            parse_type(ColumnDef(**op.get("column", {})).type)
            _check_name(op["column"]["name"], "kolon")
        elif kind in ("drop_column", "alter_column"):
            _check_name(op.get("column"), "kolon")
            if kind == "alter_column":
                if "type" in op:
                    parse_type(op["type"])
                if "new_name" in op:
                    _check_name(op["new_name"], "kolon")
        elif kind in ("create_index", "drop_index"):
            _check_name(op.get("name"), "indeks")
            if kind == "create_index":
                for c in op.get("columns") or []:
                    _check_name(c, "kolon")
                if not op.get("columns"):
                    raise DataError("İndeks için kolon listesi gerekli")
        out.append(op)
    return out


def _existing_column(connection: sa.Connection, table: str, column: str) -> dict[str, Any]:
    for c in sa.inspect(connection).get_columns(table):
        if c["name"] == column:
            return c
    raise DataNotFound(f"{table}.{column} kolonu bulunamadı")


def apply_ops(connection: sa.Connection, ops: list[dict[str, Any]], *, dialect: str, offline: bool = False) -> None:
    ctx = MigrationContext.configure(connection) if not offline else connection  # type: ignore[assignment]
    op = Operations(ctx)
    sqlite = dialect == "sqlite"
    for o in ops:
        kind, table = o["op"], o["table"]
        if kind == "create_table":
            cols = [column_from_def(ColumnDef(**c)) for c in o["columns"]]
            fks = [sa.ForeignKeyConstraint(fk["columns"], [f"{fk['ref_table']}.{rc}" for rc in fk["ref_columns"]], name=fk.get("name")) for fk in o.get("foreign_keys") or []]
            op.create_table(table, *cols, *fks)
            for ix in o.get("indexes") or []:
                op.create_index(ix.get("name") or f"ix_{table}_{'_'.join(ix['columns'])}", table, ix["columns"], unique=bool(ix.get("unique")))
        elif kind == "drop_table":
            op.drop_table(table)
        elif kind == "rename_table":
            op.rename_table(table, o["new_name"])
        elif kind == "add_column":
            col = column_from_def(ColumnDef(**o["column"]))
            if sqlite and (col.primary_key or col.unique) and not offline:
                with op.batch_alter_table(table) as batch:
                    batch.add_column(col)
            else:
                op.add_column(table, col)
        elif kind == "drop_column":
            if sqlite and not offline:
                with op.batch_alter_table(table) as batch:
                    batch.drop_column(o["column"])
            else:
                op.drop_column(table, o["column"])
        elif kind == "alter_column":
            kwargs: dict[str, Any] = {}
            if "nullable" in o:
                kwargs["nullable"] = bool(o["nullable"])
            if "type" in o:
                kwargs["type_"] = parse_type(o["type"])
            if o.get("new_name"):
                kwargs["new_column_name"] = o["new_name"]
            if not offline:
                existing = _existing_column(connection, table, o["column"])
                kwargs["existing_type"] = existing["type"]
                kwargs["existing_nullable"] = existing.get("nullable", True)
            if sqlite and not offline:
                with op.batch_alter_table(table) as batch:
                    batch.alter_column(o["column"], **kwargs)
            else:
                op.alter_column(table, o["column"], **kwargs)
        elif kind == "create_index":
            op.create_index(o["name"], table, o["columns"], unique=bool(o.get("unique")))
        elif kind == "drop_index":
            op.drop_index(o["name"], table_name=table)


def render_sql(adapter: SqlAdapter, ops: list[dict[str, Any]]) -> str:
    """Offline SQL preview (alembic ``as_sql``)."""
    buf = io.StringIO()
    ctx = MigrationContext.configure(dialect_name=adapter.dialect_name, opts={"as_sql": True, "output_buffer": buf})
    try:
        apply_ops(ctx, validate_ops(ops), dialect=adapter.dialect_name, offline=True)  # type: ignore[arg-type]
    except Exception as exc:  # noqa: BLE001 - offline rendering is best effort
        buf.write(f"-- SQL önizlemesi oluşturulamadı: {exc}\n")
    return buf.getvalue().strip()


# --------------------------------------------------------------------------- version table


def _version_table() -> sa.Table:
    return sa.Table(VERSION_TABLE, sa.MetaData(), sa.Column("version_num", sa.String(32), primary_key=True))


def current_revision(connection: sa.Connection) -> str | None:
    if not sa.inspect(connection).has_table(VERSION_TABLE):
        return None
    return connection.execute(select(_version_table().c.version_num)).scalar()


def _set_revision(connection: sa.Connection, revision: str | None) -> None:
    table = _version_table()
    table.create(connection, checkfirst=True)
    connection.execute(table.delete())
    if revision:
        connection.execute(table.insert().values(version_num=revision))


# --------------------------------------------------------------------------- revisions


def _sql_adapter(conn: DbConnection) -> SqlAdapter:
    adapter = get_adapter(conn)
    if not isinstance(adapter, SqlAdapter):
        raise DataError("Migration yalnızca SQL veritabanlarında desteklenir")
    if conn.read_only:
        raise DataError("Salt okunur bağlantıda migration çalıştırılamaz")
    return adapter


def ordered_revisions(db: Session, conn: DbConnection) -> list[Migration]:
    rows = db.scalars(select(Migration).where(Migration.connection_id == conn.id)).all()
    by_parent: dict[str | None, list[Migration]] = {}
    for r in rows:
        by_parent.setdefault(r.down_revision, []).append(r)
    ordered: list[Migration] = []
    parent: str | None = None
    while parent in by_parent:
        children = by_parent[parent]
        if len(children) > 1:
            raise DataConflict("Migration zinciri dallanmış; sürümleri birleştirin")
        ordered.append(children[0])
        parent = children[0].revision
    if len(ordered) != len(rows):
        raise DataConflict("Migration zinciri kopuk")
    return ordered


def _status(connection_current: str | None, revisions: list[Migration]) -> list[dict[str, Any]]:
    ids = [r.revision for r in revisions]
    applied_upto = ids.index(connection_current) if connection_current in ids else -1
    return [
        {
            "revision": r.revision,
            "down_revision": r.down_revision,
            "message": r.message,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "applied": i <= applied_upto,
            "upgrade_ops": json.loads(r.upgrade_ops_json),
            "downgrade_ops": json.loads(r.downgrade_ops_json),
        }
        for i, r in enumerate(revisions)
    ]


def list_migrations(db: Session, conn: DbConnection) -> dict[str, Any]:
    adapter = get_adapter(conn)
    revisions = ordered_revisions(db, conn)
    current = None
    if isinstance(adapter, SqlAdapter):
        with adapter.session(read_only=True) as c:
            current = current_revision(c)
    return {"current": current, "head": revisions[-1].revision if revisions else None, "revisions": _status(current, revisions)}


def _mirror(conn: DbConnection, m: Migration) -> None:
    from backend.services.file_service import files

    slug = re.sub(r"[^a-z0-9]+", "_", (m.message or "migration").lower()).strip("_")[:40] or "migration"
    payload = {
        "format": "jsd-migration",
        "connection": conn.name,
        "revision": m.revision,
        "down_revision": m.down_revision,
        "message": m.message,
        "upgrade": json.loads(m.upgrade_ops_json),
        "downgrade": json.loads(m.downgrade_ops_json),
    }
    path = files.path(conn.project_id, "data", "migrations", f"{m.revision}_{slug}.json")
    files.write_atomic(path, json.dumps(payload, indent=2, ensure_ascii=False) + "\n")


def autogenerate_ops(adapter: SqlAdapter, target: TargetSchema, allow_drop: bool) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[str]]:
    metadata = schema_to_metadata(target)
    wanted = {t.name for t in target.tables}

    def include(obj: Any, name: str | None, type_: str, reflected: bool, _compare_to: Any) -> bool:
        if type_ == "table" and name in INTERNAL_TABLES:
            return False
        return True

    with adapter.session(read_only=True) as c:
        mc = MigrationContext.configure(c, opts={"compare_type": True, "include_object": include})
        diffs = compare_metadata(mc, metadata)
    up: list[dict[str, Any]] = []
    down: list[dict[str, Any]] = []
    notes: list[str] = []

    def emit(u: dict[str, Any], d: dict[str, Any] | None) -> None:
        up.append(u)
        if d is not None:
            down.insert(0, d)

    for diff in diffs:
        if isinstance(diff, list):
            for m in diff:
                kind, _schema, tname, cname = m[0], m[1], m[2], m[3]
                if kind == "modify_nullable":
                    emit({"op": "alter_column", "table": tname, "column": cname, "nullable": m[6]}, {"op": "alter_column", "table": tname, "column": cname, "nullable": m[5]})
                elif kind == "modify_type":
                    emit({"op": "alter_column", "table": tname, "column": cname, "type": type_to_str(m[6])}, {"op": "alter_column", "table": tname, "column": cname, "type": type_to_str(m[5])})
                else:
                    notes.append(f"{tname}.{cname}: '{kind}' değişikliği atlandı")
            continue
        kind = diff[0]
        if kind == "add_table":
            table = diff[1]
            emit(table_to_op(table), {"op": "drop_table", "table": table.name})
        elif kind == "remove_table":
            table = diff[1]
            if allow_drop and table.name not in wanted:
                emit({"op": "drop_table", "table": table.name}, table_to_op(table))
            else:
                notes.append(f"'{table.name}' tablosu hedef şemada yok (silmek için 'tabloları sil' seçeneğini açın)")
        elif kind == "add_column":
            _s, tname, col = diff[1], diff[2], diff[3]
            emit({"op": "add_column", "table": tname, "column": column_to_def(col)}, {"op": "drop_column", "table": tname, "column": col.name})
        elif kind == "remove_column":
            _s, tname, col = diff[1], diff[2], diff[3]
            if allow_drop:
                emit({"op": "drop_column", "table": tname, "column": col.name}, {"op": "add_column", "table": tname, "column": column_to_def(col)})
            else:
                notes.append(f"{tname}.{col.name} kolonu hedef şemada yok (silinmedi)")
        elif kind == "add_index":
            ix = diff[1]
            emit(
                {"op": "create_index", "table": ix.table.name, "name": ix.name, "columns": [c.name for c in ix.columns], "unique": bool(ix.unique)},
                {"op": "drop_index", "table": ix.table.name, "name": ix.name},
            )
        elif kind == "remove_index":
            ix = diff[1]
            if allow_drop:
                emit(
                    {"op": "drop_index", "table": ix.table.name, "name": ix.name},
                    {"op": "create_index", "table": ix.table.name, "name": ix.name, "columns": [c.name for c in ix.columns], "unique": bool(ix.unique)},
                )
        else:
            notes.append(f"'{kind}' farkı otomatik migration'a dahil edilmedi")
    return up, down, notes


def create_migration(db: Session, conn: DbConnection, data: MigrationCreate) -> dict[str, Any]:
    adapter = _sql_adapter(conn)
    notes: list[str] = []
    if data.autogenerate:
        if data.target_schema is None:
            raise DataError("Otomatik migration için hedef şema gerekli")
        up, down, notes = autogenerate_ops(adapter, data.target_schema, data.allow_drop)
    else:
        up = validate_ops(data.upgrade_ops or [])
        down = validate_ops(data.downgrade_ops or [])
    if not up:
        raise DataError("Veritabanı hedef şemayla aynı; oluşturulacak değişiklik yok")
    revisions = ordered_revisions(db, conn)
    m = Migration(
        connection_id=conn.id,
        revision=secrets.token_hex(6),
        down_revision=revisions[-1].revision if revisions else None,
        message=data.message or "Şema değişikliği",
        upgrade_ops_json=json.dumps(up, ensure_ascii=False),
        downgrade_ops_json=json.dumps(down, ensure_ascii=False),
    )
    db.add(m)
    db.flush()
    _mirror(conn, m)
    return {
        "revision": m.revision,
        "down_revision": m.down_revision,
        "message": m.message,
        "upgrade_ops": up,
        "downgrade_ops": down,
        "notes": notes,
        "sql": render_sql(adapter, up),
    }


def _timeout() -> float:
    return float(max(60, settings.db_timeout_seconds))


def upgrade(db: Session, conn: DbConnection, target: str = "head") -> dict[str, Any]:
    adapter = _sql_adapter(conn)
    revisions = ordered_revisions(db, conn)
    ids = [r.revision for r in revisions]
    applied: list[str] = []
    with adapter.ddl_session(timeout_seconds=_timeout()) as c:
        current = current_revision(c)
        if current is not None and current not in ids:
            raise DataConflict(f"Veritabanındaki sürüm ({current}) bilinmiyor")
        start = ids.index(current) + 1 if current else 0
        end = len(ids) if target == "head" else (ids.index(target) + 1 if target in ids else -1)
        if end < 0:
            raise DataNotFound(f"Sürüm bulunamadı: {target}")
        if end < start:
            raise DataError("Hedef sürüm geride; downgrade kullanın")
        for r in revisions[start:end]:
            apply_ops(c, json.loads(r.upgrade_ops_json), dialect=adapter.dialect_name)
            applied.append(r.revision)
        if applied:
            _set_revision(c, applied[-1])
        adapter.commit_ddl(c)
    adapter.invalidate_schema()
    return {"applied": applied, "current": applied[-1] if applied else current}


def downgrade(db: Session, conn: DbConnection, target: str = "-1") -> dict[str, Any]:
    adapter = _sql_adapter(conn)
    revisions = ordered_revisions(db, conn)
    ids = [r.revision for r in revisions]
    reverted: list[str] = []
    with adapter.ddl_session(timeout_seconds=_timeout()) as c:
        current = current_revision(c)
        if current is None:
            raise DataError("Geri alınacak migration yok")
        if current not in ids:
            raise DataConflict(f"Veritabanındaki sürüm ({current}) bilinmiyor")
        i = ids.index(current)
        if target == "-1":
            t = i - 1
        elif target == "base":
            t = -1
        elif target in ids and ids.index(target) < i:
            t = ids.index(target)
        else:
            raise DataError(f"Geçersiz downgrade hedefi: {target}")
        for r in reversed(revisions[t + 1 : i + 1]):
            apply_ops(c, json.loads(r.downgrade_ops_json), dialect=adapter.dialect_name)
            reverted.append(r.revision)
        _set_revision(c, ids[t] if t >= 0 else None)
        adapter.commit_ddl(c)
    adapter.invalidate_schema()
    return {"reverted": reverted, "current": ids[t] if t >= 0 else None}


def delete_migration(db: Session, conn: DbConnection, revision: str) -> None:
    revisions = ordered_revisions(db, conn)
    if not revisions or revisions[-1].revision != revision:
        raise DataError("Yalnızca en son (head) migration silinebilir")
    status = list_migrations(db, conn)
    if status["current"] == revision:
        raise DataError("Uygulanmış migration silinemez; önce downgrade yapın")
    db.delete(revisions[-1])
    db.flush()
    from backend.services.file_service import files

    folder = files.path(conn.project_id, "data", "migrations")
    for p in folder.glob(f"{revision}_*.json") if folder.exists() else []:
        p.unlink()


MigrationKind = Literal["upgrade", "downgrade"]
