"""SQLAlchemy adapter for SQLite, PostgreSQL, MySQL, MariaDB and SQL Server.

Every unit of work runs through :meth:`SqlAdapter.session`, which applies the statement
timeout and the read-only guards of the dialect:

* SQLite: progress-handler deadline, ``PRAGMA query_only`` for reads, the file is opened
  with ``mode=ro`` for read-only connections and DDL is transactional (explicit BEGIN).
* PostgreSQL: ``SET TRANSACTION READ ONLY`` for reads and ``SET LOCAL statement_timeout``.
  The psycopg cursor always uses the extended query protocol, which refuses strings
  with more than one statement.
* MySQL/MariaDB: ``SET TRANSACTION READ ONLY`` for reads, ``MAX_EXECUTION_TIME``
  (MySQL, selects) / ``max_statement_time`` (MariaDB). PyMySQL never enables
  multi-statements.
* SQL Server: pymssql query timeout plus ``SET LOCK_TIMEOUT`` (best effort).
"""
from __future__ import annotations

import inspect
import logging
import math
import sqlite3
import threading
import time
from collections.abc import Iterator, Mapping, Sequence
from contextlib import contextmanager
from datetime import date, datetime
from datetime import time as dtime
from decimal import Decimal, InvalidOperation
from functools import lru_cache
from pathlib import Path
from typing import Any

import sqlalchemy as sa
from sqlalchemy import event
from sqlalchemy import exc as sa_exc
from sqlalchemy.engine import URL, Connection, CursorResult, Engine
from sqlalchemy.pool import QueuePool

from backend.services.data import introspection
from backend.services.data.adapters.base import (
    Adapter,
    ColumnHint,
    ConnectionConfig,
    QueryResult,
    TableRequest,
    describe_columns,
    elapsed_ms,
    serialize_value,
)
from backend.services.data.drivers import DRIVERS, get_driver
from backend.services.data.errors import (
    DataConflict,
    DataError,
    DataNotFound,
    DataTimeout,
    DataUnavailable,
    sanitize_error,
)
from backend.services.data.sql_safety import to_text_clause_sql

log = logging.getLogger(__name__)

CONNECT_TIMEOUT_SECONDS = 10
_INT_OPTIONS = frozenset({"connect_timeout", "read_timeout", "write_timeout", "login_timeout"})
_SKIP_BATCH = 1000
_SQLITE_PROGRESS_STEPS = 2000

# cursor.description type codes -> (type name, field type or None = decide from value)
_PG_TYPES: dict[int, tuple[str, str | None]] = {
    16: ("BOOLEAN", "ftBoolean"),
    17: ("BYTEA", "ftBlob"),
    18: ("CHAR", "ftString"),
    19: ("NAME", "ftString"),
    20: ("BIGINT", "ftInteger"),
    21: ("SMALLINT", "ftInteger"),
    23: ("INTEGER", "ftInteger"),
    25: ("TEXT", "ftMemo"),
    26: ("OID", "ftInteger"),
    114: ("JSON", "ftMemo"),
    142: ("XML", "ftMemo"),
    700: ("REAL", "ftFloat"),
    701: ("DOUBLE PRECISION", "ftFloat"),
    790: ("MONEY", "ftCurrency"),
    1042: ("CHAR", "ftString"),
    1043: ("VARCHAR", "ftString"),
    1082: ("DATE", "ftDate"),
    1083: ("TIME", "ftTime"),
    1114: ("TIMESTAMP", "ftDateTime"),
    1184: ("TIMESTAMPTZ", "ftDateTime"),
    1186: ("INTERVAL", "ftString"),
    1266: ("TIMETZ", "ftTime"),
    1700: ("NUMERIC", "ftCurrency"),
    2950: ("UUID", "ftString"),
    3802: ("JSONB", "ftMemo"),
}
_MYSQL_TYPES: dict[int, tuple[str, str | None]] = {
    0: ("DECIMAL", "ftCurrency"),
    1: ("TINYINT", "ftInteger"),
    2: ("SMALLINT", "ftInteger"),
    3: ("INT", "ftInteger"),
    4: ("FLOAT", "ftFloat"),
    5: ("DOUBLE", "ftFloat"),
    7: ("TIMESTAMP", "ftDateTime"),
    8: ("BIGINT", "ftInteger"),
    9: ("MEDIUMINT", "ftInteger"),
    10: ("DATE", "ftDate"),
    11: ("TIME", "ftTime"),
    12: ("DATETIME", "ftDateTime"),
    13: ("YEAR", "ftInteger"),
    14: ("DATE", "ftDate"),
    15: ("VARCHAR", "ftString"),
    16: ("BIT", None),
    245: ("JSON", "ftMemo"),
    246: ("DECIMAL", "ftCurrency"),
    247: ("ENUM", "ftString"),
    248: ("SET", "ftString"),
    249: ("TINYBLOB", "ftBlob"),
    250: ("MEDIUMBLOB", "ftBlob"),
    251: ("LONGBLOB", "ftBlob"),
    252: ("BLOB", "ftBlob"),
    253: ("VARCHAR", "ftString"),
    254: ("CHAR", "ftString"),
    255: ("GEOMETRY", "ftBlob"),
}
# pymssql only exposes the DB-API type groups.
_MSSQL_TYPES: dict[int, tuple[str, str | None]] = {
    1: ("VARCHAR", "ftString"),
    2: ("VARBINARY", "ftBlob"),
    3: ("NUMBER", None),
    4: ("DATETIME", None),
    5: ("DECIMAL", "ftCurrency"),
}
_DESCRIPTION_TYPES = {"postgresql": _PG_TYPES, "mysql": _MYSQL_TYPES, "mariadb": _MYSQL_TYPES, "mssql": _MSSQL_TYPES}


# --------------------------------------------------------------------------- engines


def create_sql_adapter(
    config: ConnectionConfig, *, sqlite_path: Path | None, read_only: bool, timeout_seconds: float
) -> SqlAdapter:
    engine = build_engine(config, sqlite_path=sqlite_path, read_only=read_only, timeout_seconds=timeout_seconds)
    return SqlAdapter(
        config.driver, engine, read_only=read_only, timeout_seconds=timeout_seconds, secrets=config.secrets
    )


def build_engine(
    config: ConnectionConfig, *, sqlite_path: Path | None, read_only: bool, timeout_seconds: float
) -> Engine:
    """SQLAlchemy engine for a validated config. Nothing connects until first use."""
    if config.driver == "sqlite":
        if sqlite_path is None:
            raise DataError("SQLite veritabanı yolu çözümlenemedi")
        return _sqlite_engine(sqlite_path, read_only=read_only)
    spec = get_driver(config.driver)
    url = build_url(config)
    return sa.create_engine(
        url,
        connect_args=_connect_args(config, read_only=read_only, timeout_seconds=timeout_seconds),
        pool_size=5,
        max_overflow=5,
        pool_timeout=10,
        pool_recycle=1800,
        pool_pre_ping=True,
        hide_parameters=True,
        logging_name=spec.driver,
    )


def build_url(config: ConnectionConfig) -> URL:
    """SQLAlchemy URL of a server database (options travel as connect args, not in the URL)."""
    spec = get_driver(config.driver)
    if spec.sqlalchemy_name is None or spec.driver == "sqlite":
        raise DataError(f"{spec.label} için SQLAlchemy URL'si oluşturulamaz")
    return URL.create(
        spec.sqlalchemy_name,
        username=config.username or None,
        password=config.password or None,
        host=config.host or None,
        port=config.port,
        database=config.database or None,
    )


def _connect_args(config: ConnectionConfig, *, read_only: bool, timeout_seconds: float) -> dict[str, Any]:
    driver = config.driver
    args: dict[str, Any]
    if driver == "postgresql":
        args = {"connect_timeout": CONNECT_TIMEOUT_SECONDS, "application_name": "JS-Delphi"}
        factory = single_statement_cursor_factory()
        if factory is not None:
            args["cursor_factory"] = factory
        if read_only:
            args["options"] = "-c default_transaction_read_only=on"
    elif driver in ("mysql", "mariadb"):
        args = {"connect_timeout": CONNECT_TIMEOUT_SECONDS, "charset": "utf8mb4"}
        if read_only:
            args["init_command"] = "SET SESSION TRANSACTION READ ONLY"
    elif driver == "mssql":
        args = {
            "login_timeout": CONNECT_TIMEOUT_SECONDS,
            "timeout": max(1, math.ceil(timeout_seconds)),
            "appname": "JS-Delphi",
        }
    else:  # pragma: no cover - guarded by the driver registry
        args = {}
    for key, value in config.options.items():
        args[key] = int(value) if key in _INT_OPTIONS else value
    return args


@lru_cache(maxsize=1)
def single_statement_cursor_factory() -> type | None:
    """psycopg cursor that always uses the extended query protocol.

    psycopg sends parameterless queries with the simple protocol, which executes every
    ``;``-separated statement of the string. The extended protocol refuses more than one
    statement, which backs up the lexical single-statement check. Returns None (default
    cursor) when psycopg's internals differ from what this override expects.
    """
    try:
        import psycopg
    except ImportError:
        return None
    send = getattr(psycopg.Cursor, "_execute_send", None)
    if send is None or "force_extended" not in inspect.signature(send).parameters:
        log.warning("psycopg Cursor._execute_send changed; multi-statement guard disabled")
        return None

    class SingleStatementCursor(psycopg.Cursor):  # type: ignore[misc, valid-type]
        def _execute_send(self, query: Any, *, force_extended: bool = False, binary: bool | None = None) -> None:
            super()._execute_send(query, force_extended=True, binary=binary)

    return SingleStatementCursor


def _sqlite_engine(path: Path, *, read_only: bool) -> Engine:
    if not read_only:
        path.parent.mkdir(parents=True, exist_ok=True)
    uri = f"{path.as_uri()}?mode={'ro' if read_only else 'rwc'}"

    def creator() -> sqlite3.Connection:
        return sqlite3.connect(uri, uri=True, check_same_thread=False, timeout=5.0, isolation_level=None)

    engine = sa.create_engine(
        "sqlite://",
        creator=creator,
        poolclass=QueuePool,
        pool_size=5,
        max_overflow=5,
        pool_timeout=10,
        hide_parameters=True,
    )

    @event.listens_for(engine, "connect")
    def _on_connect(dbapi_connection: sqlite3.Connection, _record: Any) -> None:
        # pysqlite's implicit transaction handling is disabled; BEGIN is emitted below so
        # that DDL (migrations) is transactional too.
        dbapi_connection.isolation_level = None
        dbapi_connection.execute("PRAGMA foreign_keys=ON")

    @event.listens_for(engine, "begin")
    def _on_begin(connection: Connection) -> None:
        connection.exec_driver_sql("BEGIN")

    return engine


# --------------------------------------------------------------------------- value coercion


def coerce_value(column: sa.Column[Any], value: Any) -> Any:
    """Convert a JSON scalar to the Python type the column's SQLAlchemy type expects."""
    if value is None:
        return None
    type_ = column.type
    try:
        if isinstance(type_, sa.Boolean):
            return _to_bool(value)
        if isinstance(type_, sa.Integer):
            return _to_int(value)
        if isinstance(type_, sa.Float):
            return _to_float(value)
        if isinstance(type_, sa.Numeric):
            return _to_decimal(value)
        if isinstance(type_, sa.DateTime):
            return _to_datetime(value)
        if isinstance(type_, sa.Date):
            return _to_date(value)
        if isinstance(type_, sa.Time):
            return dtime.fromisoformat(_require_str(value))
        if isinstance(type_, sa.types._Binary):
            raise ValueError("binary")
        if isinstance(type_, sa.String):
            return value if isinstance(value, str) else (str(value).lower() if isinstance(value, bool) else str(value))
    except (ValueError, TypeError, InvalidOperation, ArithmeticError) as exc:
        raise DataError(f"'{column.name}' sütunu için geçersiz değer: {value!r}") from exc
    return value


def _require_str(value: Any) -> str:
    if not isinstance(value, str):
        raise TypeError("string expected")
    return value


def _to_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, int) and value in (0, 1):
        return bool(value)
    if isinstance(value, str) and value.strip().lower() in {"true", "false", "1", "0"}:
        return value.strip().lower() in {"true", "1"}
    raise ValueError("boolean expected")


def _to_int(value: Any) -> int:
    if isinstance(value, bool):
        raise TypeError("integer expected")
    if isinstance(value, int):
        return value
    if isinstance(value, float) and value.is_integer():
        return int(value)
    if isinstance(value, str):
        return int(value.strip())
    raise TypeError("integer expected")


def _to_float(value: Any) -> float:
    if isinstance(value, bool):
        raise TypeError("number expected")
    result = float(value)
    if not math.isfinite(result):
        raise ValueError("finite number expected")
    return result


def _to_decimal(value: Any) -> Decimal:
    if isinstance(value, bool):
        raise TypeError("number expected")
    result = Decimal(str(value).strip())
    if not result.is_finite():
        raise ValueError("finite number expected")
    return result


def _to_datetime(value: Any) -> datetime:
    return datetime.fromisoformat(_require_str(value).strip())


def _to_date(value: Any) -> date:
    text = _require_str(value).strip()
    return date.fromisoformat(text) if len(text) == 10 else datetime.fromisoformat(text).date()


# --------------------------------------------------------------------------- adapter


class SqlAdapter(Adapter):
    family = "sql"

    def __init__(
        self,
        driver: str,
        engine: Engine,
        *,
        read_only: bool,
        timeout_seconds: float,
        secrets: tuple[str, ...] = (),
    ) -> None:
        super().__init__(driver, read_only=read_only, timeout_seconds=timeout_seconds, secrets=secrets)
        self.engine = engine
        self._tables: dict[tuple[str | None, str], tuple[float, sa.Table]] = {}
        self._tables_lock = threading.Lock()

    @property
    def dialect_name(self) -> str:
        return self.engine.dialect.name

    def dispose(self) -> None:
        self.engine.dispose()

    def invalidate_schema(self) -> None:
        super().invalidate_schema()
        with self._tables_lock:
            self._tables.clear()

    # -- sessions -----------------------------------------------------------------

    def _connect(self) -> Connection:
        try:
            return self.engine.connect()
        except sa_exc.SQLAlchemyError as exc:
            raise DataUnavailable(f"Veritabanına bağlanılamadı: {sanitize_error(exc, self._secrets)}") from exc

    @contextmanager
    def session(self, *, read_only: bool, timeout_seconds: float | None = None) -> Iterator[Connection]:
        """Connection with timeout/read-only guards. Callers commit writes explicitly;
        anything not committed is rolled back when the block ends."""
        timeout = self.timeout_seconds if timeout_seconds is None else timeout_seconds
        connection = self._connect()
        try:
            try:
                self._begin_guards(connection, read_only=read_only, timeout=timeout)
                yield connection
            except sa_exc.SQLAlchemyError as exc:
                raise self.translate_error(exc, timeout) from exc
            finally:
                self._end_guards(connection)
        finally:
            connection.close()

    @contextmanager
    def ddl_session(self, *, timeout_seconds: float) -> Iterator[Connection]:
        """Connection for schema migrations; finish with :meth:`commit_ddl`.

        SQLite: foreign key enforcement is switched off for the transaction (table
        rebuilds must not cascade) and verified with ``PRAGMA foreign_key_check`` before
        the commit, as recommended by the SQLite documentation.
        """
        sqlite = self.dialect_name == "sqlite"
        connection = self._connect()
        try:
            if sqlite:
                connection.connection.dbapi_connection.execute("PRAGMA foreign_keys=OFF")
            try:
                self._begin_guards(connection, read_only=False, timeout=timeout_seconds)
                yield connection
            except sa_exc.SQLAlchemyError as exc:
                raise self.translate_error(exc, timeout_seconds) from exc
            finally:
                self._end_guards(connection)
                if sqlite:
                    self._restore_sqlite_foreign_keys(connection)
        finally:
            connection.close()

    def commit_ddl(self, connection: Connection) -> None:
        if self.dialect_name == "sqlite":
            violations = connection.exec_driver_sql("PRAGMA foreign_key_check").fetchall()
            if violations:
                tables = sorted({str(row[0]) for row in violations})
                raise DataError(f"Migration yabancı anahtar ihlali oluşturdu: {', '.join(tables)}")
        connection.commit()

    @staticmethod
    def _restore_sqlite_foreign_keys(connection: Connection) -> None:
        try:
            if connection.in_transaction():
                connection.rollback()
            connection.connection.dbapi_connection.execute("PRAGMA foreign_keys=ON")
        except Exception:  # noqa: BLE001 - the pooled connection is invalidated below
            log.warning("could not restore SQLite foreign_keys pragma", exc_info=True)
            connection.invalidate()

    def _begin_guards(self, connection: Connection, *, read_only: bool, timeout: float) -> None:
        dialect = self.dialect_name
        if dialect == "sqlite":
            raw = connection.connection.dbapi_connection
            deadline = time.monotonic() + timeout
            raw.set_progress_handler(lambda: 1 if time.monotonic() > deadline else 0, _SQLITE_PROGRESS_STEPS)
            raw.execute(f"PRAGMA query_only = {1 if read_only else 0}")
        elif dialect == "postgresql":
            if read_only:
                connection.exec_driver_sql("SET TRANSACTION READ ONLY")
            connection.exec_driver_sql(f"SET LOCAL statement_timeout = {int(timeout * 1000)}")
        elif dialect in ("mysql", "mariadb"):
            statements = ["SET TRANSACTION READ ONLY"] if read_only else []
            if getattr(self.engine.dialect, "is_mariadb", False):
                statements.append(f"SET SESSION max_statement_time = {timeout:.3f}")
            else:
                statements.append(f"SET SESSION MAX_EXECUTION_TIME = {int(timeout * 1000)}")
            for statement in statements:
                try:
                    connection.exec_driver_sql(statement)
                except sa_exc.DBAPIError:
                    log.debug("MySQL guard not supported: %s", statement, exc_info=True)
        elif dialect == "mssql":
            connection.exec_driver_sql(f"SET LOCK_TIMEOUT {int(timeout * 1000)}")

    def _end_guards(self, connection: Connection) -> None:
        if self.dialect_name != "sqlite":
            return
        try:
            raw = connection.connection.dbapi_connection
            if raw is not None:
                raw.set_progress_handler(None, 0)
                raw.execute("PRAGMA query_only = 0")
        except Exception:  # noqa: BLE001 - connection already unusable; the pool discards it
            log.debug("could not reset SQLite guards", exc_info=True)

    def translate_error(self, exc: sa_exc.SQLAlchemyError, timeout: float) -> DataError:
        if _is_timeout(exc, self.dialect_name):
            return DataTimeout(f"Sorgu zaman aşımına uğradı ({timeout:g} sn)")
        message = sanitize_error(exc, self._secrets)
        if isinstance(exc, sa_exc.IntegrityError):
            return DataConflict(f"Bütünlük kısıtı ihlali: {message}")
        if isinstance(exc, sa_exc.DBAPIError):
            if exc.connection_invalidated:
                return DataUnavailable(f"Veritabanı bağlantısı koptu: {message}")
            return DataError(f"Veritabanı hatası: {message}")
        return DataError(f"SQL hatası: {message}")

    # -- basic operations ---------------------------------------------------------

    def test(self) -> str:
        with self.session(read_only=True) as connection:
            connection.exec_driver_sql("SELECT 1").close()
            if self.dialect_name == "sqlite":
                return f"SQLite {sqlite3.sqlite_version}"
            info = self.engine.dialect.server_version_info
            label = DRIVERS[self.driver].label if self.driver in DRIVERS else self.dialect_name
            return f"{label} {'.'.join(str(part) for part in info)}" if info else label

    def introspect(self) -> dict[str, Any]:
        with self.session(read_only=True) as connection:
            return introspection.inspect_sql_schema(connection, self.driver)

    def execute(
        self, statement: str, params: Mapping[str, Any], *, limit: int, offset: int, mode: str, kind: str
    ) -> QueryResult:
        clause = sa.text(to_text_clause_sql(statement))
        read = mode == "query"
        options: dict[str, Any] = {}
        if read and self.engine.dialect.supports_server_side_cursors:
            options = {"stream_results": True, "max_row_buffer": min(limit + 1, _SKIP_BATCH)}
        started = time.perf_counter()
        with self.session(read_only=read) as connection:
            result = connection.execute(clause, dict(params), execution_options=options)
            columns: list[dict[str, Any]] = []
            rows: list[list[Any]] = []
            truncated = False
            if result.returns_rows:
                columns, rows, truncated = self._fetch(result, limit=limit, offset=offset if read else 0)
            rows_affected = None if read else _rowcount(result)
            last_insert_id = _last_insert_id(result) if kind == "insert" else None
            result.close()
            if not read:
                connection.commit()
        return QueryResult(
            columns=columns,
            rows=rows,
            truncated=truncated,
            rows_affected=rows_affected,
            last_insert_id=last_insert_id,
            elapsed_ms=elapsed_ms(started),
        )

    def _fetch(
        self, result: CursorResult[Any], *, limit: int, offset: int
    ) -> tuple[list[dict[str, Any]], list[list[Any]], bool]:
        cursor = getattr(result, "cursor", None)
        description = list(getattr(cursor, "description", None) or [])
        names = list(result.keys())
        skipped = 0
        while skipped < offset:
            batch = result.fetchmany(min(_SKIP_BATCH, offset - skipped))
            if not batch:
                break
            skipped += len(batch)
        raw_rows = result.fetchmany(limit + 1)
        truncated = len(raw_rows) > limit
        raw_rows = raw_rows[:limit]
        columns = describe_columns(names, _description_hints(self.dialect_name, description), raw_rows)
        return columns, [[serialize_value(v) for v in row] for row in raw_rows], truncated

    # -- tables -------------------------------------------------------------------

    def resolve_table(self, requested: str) -> tuple[str | None, str]:
        """(schema or None for the default schema, table name) of an introspected table."""
        found = _match_object(self.get_schema()["tables"], requested, self.get_schema().get("default_schema"))
        if found is None:
            schema = self.get_schema(refresh=True)
            found = _match_object(schema["tables"], requested, schema.get("default_schema"))
        if found is None:
            raise DataNotFound(f"Tablo bulunamadı: {requested}")
        return found

    def reflect_table(self, schema: str | None, name: str) -> sa.Table:
        key = (schema, name)
        with self._tables_lock:
            cached = self._tables.get(key)
        if cached and time.monotonic() - cached[0] < introspection.SCHEMA_CACHE_SECONDS:
            return cached[1]
        with self.session(read_only=True) as connection:
            table = sa.Table(name, sa.MetaData(), schema=schema, autoload_with=connection)
        with self._tables_lock:
            self._tables[key] = (time.monotonic(), table)
        return table

    def get_table(self, requested: str) -> sa.Table:
        schema, name = self.resolve_table(requested)
        return self.reflect_table(schema, name)

    def table_op(self, request: TableRequest, *, limit: int) -> dict[str, Any]:
        table = self.get_table(request.table)
        started = time.perf_counter()
        if request.op == "select":
            result = self._select_rows(table, request, limit)
        elif request.op == "insert":
            result = self._insert_row(table, request)
        else:
            result = self._keyed_write(table, request)
        result["elapsed_ms"] = elapsed_ms(started)
        return result

    def _select_rows(self, table: sa.Table, request: TableRequest, limit: int) -> dict[str, Any]:
        columns = [find_column(table, name) for name in request.columns] if request.columns else list(table.c)
        stmt = sa.select(*columns)
        for condition in _equality_conditions(table, request.where or {}):
            stmt = stmt.where(condition)
        order = [
            find_column(table, item.column).desc() if item.desc else find_column(table, item.column).asc()
            for item in request.order_by or []
        ]
        if not order:
            # Stable paging (and SQL Server requires ORDER BY for OFFSET).
            order = list(table.primary_key.columns) or ([columns[0]] if request.offset else [])
        if order:
            stmt = stmt.order_by(*order)
        stmt = stmt.limit(limit + 1)
        if request.offset:
            stmt = stmt.offset(request.offset)
        with self.session(read_only=True) as connection:
            raw_rows = connection.execute(stmt).fetchall()
        truncated = len(raw_rows) > limit
        raw_rows = raw_rows[:limit]
        dialect = self.engine.dialect
        result = QueryResult(
            columns=[
                {
                    "name": c.name,
                    "type": introspection.type_name(c.type, dialect),
                    "field_type": introspection.field_type_for_sqla_type(c.type),
                }
                for c in columns
            ],
            rows=[[serialize_value(v) for v in row] for row in raw_rows],
            truncated=truncated,
        ).to_dict()
        result["primary_key"] = [c.name for c in table.primary_key.columns]
        return result

    def _insert_row(self, table: sa.Table, request: TableRequest) -> dict[str, Any]:
        values = _column_values(table, request.values or {})
        stmt = sa.insert(table).values(values) if values else sa.insert(table)
        with self.session(read_only=False) as connection:
            result = connection.execute(stmt)
            primary_key = result.inserted_primary_key
            rows_affected = _rowcount(result)
            connection.commit()
        inserted: dict[str, Any] = {}
        if primary_key is not None:
            for column, value in zip(table.primary_key.columns, primary_key):
                inserted[column.name] = serialize_value(value)
        return {"rows_affected": 1 if rows_affected is None else rows_affected, "inserted_primary_key": inserted}

    def _keyed_write(self, table: sa.Table, request: TableRequest) -> dict[str, Any]:
        pk_columns = list(table.primary_key.columns)
        if not pk_columns:
            raise DataError("Birincil anahtarı olmayan tabloda güncelleme veya silme yapılamaz")
        key = request.key or {}
        given = {find_column(table, name).name for name in key}
        missing = [c.name for c in pk_columns if c.name not in given]
        if missing:
            raise DataError(f"Birincil anahtarın tamamı gerekli; eksik anahtar sütunları: {', '.join(missing)}")
        conditions = _equality_conditions(table, key)
        if request.op == "update":
            values = _column_values(table, request.values or {})
            if not values:
                raise DataError("Güncellenecek değer belirtilmedi")
            stmt: Any = sa.update(table).where(*conditions).values(values)
        else:
            stmt = sa.delete(table).where(*conditions)
        with self.session(read_only=False) as connection:
            result = connection.execute(stmt)
            rows_affected = _rowcount(result)
            connection.commit()
        return {"rows_affected": rows_affected or 0}

    # -- procedures ---------------------------------------------------------------

    def find_procedure(self, requested: str) -> dict[str, Any]:
        schema = self.get_schema()
        found = _match_procedure(schema["procedures"], requested, schema.get("default_schema"))
        if found is None:
            schema = self.get_schema(refresh=True)
            found = _match_procedure(schema["procedures"], requested, schema.get("default_schema"))
        if found is None:
            raise DataNotFound(f"Saklı yordam bulunamadı: {requested}")
        return found

    def procedure_call_sql(self, procedure: Mapping[str, Any], param_names: Sequence[str]) -> str:
        """Dialect specific call statement with ``:name`` bind placeholders.

        ``param_names`` must already be validated identifiers; the procedure name comes
        from introspection and is quoted by the dialect.
        """
        preparer = self.engine.dialect.identifier_preparer
        name = preparer.quote(procedure["name"])
        if procedure.get("schema"):
            name = f"{preparer.quote_schema(procedure['schema'])}.{name}"
        binds = ", ".join(f":{p}" for p in param_names)
        dialect = self.dialect_name
        if dialect == "postgresql":
            if procedure.get("kind") == "procedure":
                return f"CALL {name}({binds})"
            return f"SELECT * FROM {name}({binds})"
        if dialect in ("mysql", "mariadb"):
            return f"CALL {name}({binds})"
        if dialect == "mssql":
            arguments = ", ".join(f"@{p} = :{p}" for p in param_names)
            return f"EXEC {name} {arguments}".rstrip()
        raise DataError("Bu veritabanı saklı yordamları desteklemiyor")

    def call_procedure(self, name: str, params: Mapping[str, Any], *, limit: int) -> QueryResult:
        if self.dialect_name == "sqlite":
            raise DataError("SQLite saklı yordamları desteklemiyor")
        procedure = self.find_procedure(name)
        clause = sa.text(self.procedure_call_sql(procedure, list(params)))
        started = time.perf_counter()
        with self.session(read_only=False) as connection:
            result = connection.execute(clause, dict(params))
            columns: list[dict[str, Any]] = []
            rows: list[list[Any]] = []
            truncated = False
            if result.returns_rows:
                columns, rows, truncated = self._fetch(result, limit=limit, offset=0)
            rows_affected = _rowcount(result)
            result.close()
            connection.commit()
        return QueryResult(
            columns=columns, rows=rows, truncated=truncated, rows_affected=rows_affected, elapsed_ms=elapsed_ms(started)
        )


# --------------------------------------------------------------------------- helpers


def find_column(table: sa.Table | sa.sql.Alias, name: str) -> sa.Column[Any]:
    """Column by exact name, falling back to a unique case-insensitive match."""
    column = table.c.get(name)
    if column is not None:
        return column
    matches = [c for c in table.c if c.name.lower() == str(name).lower()]
    if len(matches) == 1:
        return matches[0]
    raise DataError(f"Bilinmeyen sütun: {name}")


def _column_values(table: sa.Table, values: Mapping[str, Any]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for name, value in values.items():
        column = find_column(table, name)
        result[column.name] = coerce_value(column, value)
    return result


def _equality_conditions(table: sa.Table, values: Mapping[str, Any]) -> list[Any]:
    conditions = []
    for name, value in values.items():
        column = find_column(table, name)
        conditions.append(column.is_(None) if value is None else column == coerce_value(column, value))
    return conditions


def _match_object(
    objects: Sequence[Mapping[str, Any]], requested: str, default_schema: str | None
) -> tuple[str | None, str] | None:
    """Find ``name`` or ``schema.name`` among introspected objects (default schema first)."""
    wanted = (requested or "").strip()

    def key(obj: Mapping[str, Any]) -> tuple[str | None, str]:
        schema = obj.get("schema")
        return (None if schema in (None, default_schema) else schema, obj["name"])

    candidates: list[Mapping[str, Any]] = [o for o in objects if o["name"] == wanted]
    if not candidates and "." in wanted:
        schema, _, name = wanted.partition(".")
        candidates = [o for o in objects if o["name"] == name and o.get("schema") == schema]
    if not candidates:
        lowered = wanted.lower()
        candidates = [o for o in objects if o["name"].lower() == lowered]
    if not candidates:
        return None
    default_first = [o for o in candidates if o.get("schema") in (None, default_schema)]
    if default_first:
        return key(default_first[0])
    return key(candidates[0]) if len(candidates) == 1 else None


def _match_procedure(
    procedures: Sequence[Mapping[str, Any]], requested: str, default_schema: str | None
) -> dict[str, Any] | None:
    found = _match_object(procedures, requested, default_schema)
    if found is None:
        return None
    schema, name = found
    for procedure in procedures:
        if procedure["name"] == name and (procedure.get("schema") in (None, default_schema) if schema is None else procedure.get("schema") == schema):
            return dict(procedure)
    return None


def _description_hints(dialect: str, description: Sequence[Any]) -> list[ColumnHint]:
    table = _DESCRIPTION_TYPES.get(dialect)
    if not description or table is None:
        return []
    hints: list[ColumnHint] = []
    for entry in description:
        try:
            code = entry[1]
        except (IndexError, TypeError, KeyError):
            code = None
        hints.append(table.get(code) if isinstance(code, int) else None)
    return hints


def _rowcount(result: CursorResult[Any]) -> int | None:
    try:
        count = result.rowcount
    except Exception:  # noqa: BLE001 - some drivers raise when no count is available
        return None
    return count if isinstance(count, int) and count >= 0 else None


def _last_insert_id(result: CursorResult[Any]) -> Any:
    try:
        value = result.lastrowid
    except Exception:  # noqa: BLE001 - not every DBAPI implements lastrowid
        return None
    return serialize_value(value) if isinstance(value, int) and value > 0 else None


def _is_timeout(exc: sa_exc.SQLAlchemyError, dialect: str) -> bool:
    orig = getattr(exc, "orig", None)
    if orig is None:
        return False
    text = str(orig).lower()
    if dialect == "sqlite":
        return isinstance(orig, sqlite3.OperationalError) and "interrupted" in text
    if dialect == "postgresql":
        return getattr(orig, "sqlstate", None) == "57014" or "statement timeout" in text
    if dialect in ("mysql", "mariadb"):
        code = orig.args[0] if getattr(orig, "args", None) else None
        return code in (1317, 1969, 3024) or "max_statement_time" in text or "maximum statement execution time" in text
    if dialect == "mssql":
        return "timed out" in text or "timeout expired" in text
    return False
