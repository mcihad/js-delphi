"""Schema introspection (tables, views, columns, keys, indexes, procedures).

The functions in this module are pure with respect to connection management: they
work on an open SQLAlchemy ``Connection``. :func:`get_schema` is the cached entry point
used by the API; caching lives on the adapter (30 s, see ``Adapter.get_schema``).
"""
from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

import sqlalchemy as sa
from sqlalchemy.engine import Connection, Dialect
from sqlalchemy.engine.reflection import Inspector, ObjectKind
from sqlalchemy.types import TypeEngine

if TYPE_CHECKING:
    from backend.models import DbConnection

log = logging.getLogger(__name__)

SCHEMA_CACHE_SECONDS = 30.0
MAX_OBJECTS_PER_SCHEMA = 2000
# Tables maintained by JS-Delphi inside user databases; hidden from the IDE and the proxy.
INTERNAL_TABLES = frozenset({"jsd_migrations"})

FIELD_TYPES = (
    "ftString",
    "ftInteger",
    "ftFloat",
    "ftCurrency",
    "ftBoolean",
    "ftDate",
    "ftDateTime",
    "ftTime",
    "ftMemo",
    "ftBlob",
    "ftUnknown",
)

_PG_SYSTEM_SCHEMAS = frozenset({"information_schema", "pg_catalog", "pg_toast"})
_MSSQL_SYSTEM_SCHEMAS = frozenset({"sys", "INFORMATION_SCHEMA", "guest"})

_PROCEDURE_QUERIES: dict[str, str] = {
    "postgresql": (
        "SELECT DISTINCT routine_schema, routine_name, COALESCE(routine_type, 'FUNCTION') AS routine_type "
        "FROM information_schema.routines "
        "WHERE routine_schema NOT IN ('pg_catalog', 'information_schema') "
        "AND COALESCE(data_type, '') <> 'trigger' "
        "ORDER BY routine_schema, routine_name"
    ),
    "mysql": (
        "SELECT ROUTINE_SCHEMA, ROUTINE_NAME, ROUTINE_TYPE FROM information_schema.ROUTINES "
        "WHERE ROUTINE_SCHEMA = DATABASE() AND ROUTINE_TYPE = 'PROCEDURE' ORDER BY ROUTINE_NAME"
    ),
    "mssql": (
        "SELECT ROUTINE_SCHEMA, ROUTINE_NAME, ROUTINE_TYPE FROM INFORMATION_SCHEMA.ROUTINES "
        "WHERE ROUTINE_TYPE = 'PROCEDURE' ORDER BY ROUTINE_SCHEMA, ROUTINE_NAME"
    ),
}
_PROCEDURE_QUERIES["mariadb"] = _PROCEDURE_QUERIES["mysql"]


# --------------------------------------------------------------------------- types


def field_type_for_sqla_type(type_: TypeEngine[Any] | None) -> str:
    """Delphi ``TFieldType`` name for a SQLAlchemy type (subclasses are checked first)."""
    if type_ is None:
        return "ftUnknown"
    if isinstance(type_, sa.Boolean):
        return "ftBoolean"
    if isinstance(type_, sa.Integer):
        return "ftInteger"
    if isinstance(type_, sa.Float):
        return "ftFloat"
    if isinstance(type_, sa.Numeric):
        return "ftCurrency"
    if isinstance(type_, sa.DateTime):
        return "ftDateTime"
    if isinstance(type_, sa.Date):
        return "ftDate"
    if isinstance(type_, sa.Time):
        return "ftTime"
    if isinstance(type_, sa.Text):
        return "ftMemo"
    if isinstance(type_, sa.String):
        return "ftString"
    if isinstance(type_, sa.types._Binary):
        return "ftBlob"
    if isinstance(type_, sa.JSON):
        return "ftMemo"
    if isinstance(type_, sa.Uuid):
        return "ftString"
    name = type(type_).__name__.upper()
    if name in {"MONEY", "SMALLMONEY"}:
        return "ftCurrency"
    if name in {"INTERVAL", "INET", "CIDR", "MACADDR", "CITEXT"}:
        return "ftString"
    return "ftUnknown"


def type_name(type_: TypeEngine[Any] | None, dialect: Dialect | None = None) -> str:
    """Database specific type name (``VARCHAR(50)``); ``""`` when it cannot be rendered."""
    if type_ is None or isinstance(type_, sa.types.NullType):
        return ""
    try:
        return str(type_.compile(dialect=dialect))
    except Exception:  # noqa: BLE001 - some reflected types cannot be compiled standalone
        return type(type_).__name__.upper()


# --------------------------------------------------------------------------- schema


def get_schema(conn: DbConnection, *, refresh: bool = False) -> dict[str, Any]:
    """Cached schema of a saved connection (tables, views, procedures)."""
    # Deferred import: connection_manager -> adapters -> introspection.
    from backend.services.data.connection_manager import get_adapter

    return get_adapter(conn).get_schema(refresh=refresh)


def inspect_sql_schema(connection: Connection, driver: str) -> dict[str, Any]:
    """Reflect the connected database with ``sqlalchemy.inspect``."""
    inspector = sa.inspect(connection)
    default_schema = inspector.default_schema_name
    tables: list[dict[str, Any]] = []
    truncated = False
    for schema in _schemas_to_scan(inspector, driver):
        schema_tables, schema_truncated = _inspect_schema(inspector, connection.dialect, schema, default_schema, driver)
        tables.extend(schema_tables)
        truncated = truncated or schema_truncated
    return {
        "driver": driver,
        "default_schema": default_schema,
        "tables": tables,
        "procedures": list_procedures(connection, driver, default_schema),
        "truncated": truncated,
    }


def _schemas_to_scan(inspector: Inspector, driver: str) -> list[str | None]:
    """Default schema first; PostgreSQL and SQL Server add their other user schemas."""
    if driver not in ("postgresql", "mssql"):
        return [None]
    try:
        names = inspector.get_schema_names()
    except sa.exc.SQLAlchemyError:
        log.debug("could not list schemas", exc_info=True)
        return [None]
    default = inspector.default_schema_name
    extra = []
    for name in names:
        if name == default:
            continue
        if driver == "postgresql" and (name in _PG_SYSTEM_SCHEMAS or name.startswith("pg_")):
            continue
        if driver == "mssql" and (name in _MSSQL_SYSTEM_SCHEMAS or name.startswith("db_")):
            continue
        extra.append(name)
    return [None, *sorted(extra)]


def _inspect_schema(
    inspector: Inspector, dialect: Dialect, schema: str | None, default_schema: str | None, driver: str
) -> tuple[list[dict[str, Any]], bool]:
    table_names = sorted(n for n in inspector.get_table_names(schema=schema) if n not in INTERNAL_TABLES)
    view_names = sorted(inspector.get_view_names(schema=schema))
    names = table_names + view_names
    truncated = len(names) > MAX_OBJECTS_PER_SCHEMA
    names = names[:MAX_OBJECTS_PER_SCHEMA]
    kept = set(names)
    table_names = [n for n in table_names if n in kept]
    if not names:
        return [], truncated
    views = set(view_names)

    columns = inspector.get_multi_columns(schema=schema, filter_names=names, kind=ObjectKind.ANY)
    if table_names:
        pks = inspector.get_multi_pk_constraint(schema=schema, filter_names=table_names, kind=ObjectKind.TABLE)
        fks = inspector.get_multi_foreign_keys(schema=schema, filter_names=table_names, kind=ObjectKind.TABLE)
        indexes = inspector.get_multi_indexes(schema=schema, filter_names=table_names, kind=ObjectKind.TABLE)
    else:
        pks, fks, indexes = {}, {}, {}

    result = []
    for name in names:
        key = (schema, name)
        pk_columns = list((pks.get(key) or {}).get("constrained_columns") or [])
        result.append(
            {
                "name": name,
                "schema": schema or default_schema,
                "kind": "view" if name in views else "table",
                "columns": [_column_info(c, pk_columns, dialect, driver) for c in columns.get(key, [])],
                "primary_key": pk_columns,
                "foreign_keys": [_foreign_key_info(fk) for fk in fks.get(key, [])],
                "indexes": [_index_info(ix) for ix in indexes.get(key, [])],
            }
        )
    return result, truncated


def _column_info(column: dict[str, Any], pk_columns: list[str], dialect: Dialect, driver: str) -> dict[str, Any]:
    name = column["name"]
    type_ = column.get("type")
    is_pk = name in pk_columns
    default = column.get("default")
    return {
        "name": name,
        "type": type_name(type_, dialect),
        "field_type": field_type_for_sqla_type(type_),
        # SQLite reports PRIMARY KEY columns as nullable; a key can never be NULL.
        "nullable": bool(column.get("nullable", True)) and not is_pk,
        "default": None if default is None else str(default),
        "primary_key": is_pk,
        "autoincrement": _is_autoincrement(column, pk_columns, driver),
    }


def _is_autoincrement(column: dict[str, Any], pk_columns: list[str], driver: str) -> bool:
    if column.get("identity"):
        return True
    if column.get("autoincrement") is True:
        return True
    default = str(column.get("default") or "").lower()
    if default.startswith("nextval("):
        return True
    # SQLite: a single INTEGER PRIMARY KEY column is an alias of the rowid.
    return (
        driver == "sqlite"
        and pk_columns == [column["name"]]
        and isinstance(column.get("type"), sa.Integer)
    )


def _foreign_key_info(fk: dict[str, Any]) -> dict[str, Any]:
    return {
        "name": fk.get("name"),
        "columns": list(fk.get("constrained_columns") or []),
        "ref_table": fk.get("referred_table"),
        "ref_schema": fk.get("referred_schema"),
        "ref_columns": list(fk.get("referred_columns") or []),
    }


def _index_info(index: dict[str, Any]) -> dict[str, Any]:
    return {
        "name": index.get("name"),
        "columns": [c for c in (index.get("column_names") or []) if c],
        "unique": bool(index.get("unique")),
    }


def list_procedures(connection: Connection, driver: str, default_schema: str | None = None) -> list[dict[str, Any]]:
    """Stored procedures (PostgreSQL: functions and procedures). SQLite has none."""
    query = _PROCEDURE_QUERIES.get(driver)
    if query is None:
        return []
    try:
        rows = connection.exec_driver_sql(query).fetchall()
    except sa.exc.SQLAlchemyError:
        # Missing privileges on information_schema must not break the whole schema view.
        log.debug("could not list procedures", exc_info=True)
        return []
    seen: set[tuple[str, str]] = set()
    procedures = []
    for schema, name, routine_type in rows:
        if (schema, name) in seen:
            continue  # overloaded PostgreSQL functions
        seen.add((schema, name))
        procedures.append(
            {
                "name": name,
                "schema": schema or default_schema,
                "kind": "procedure" if str(routine_type).upper() == "PROCEDURE" else "function",
            }
        )
    return procedures
