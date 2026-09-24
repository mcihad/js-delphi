"""Adapter contract shared by the SQL and MongoDB drivers, plus value serialisation."""
from __future__ import annotations

import math
import threading
import time
import uuid
from abc import ABC, abstractmethod
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from datetime import time as dtime
from decimal import Decimal
from typing import Any, Literal, Optional, Union

from pydantic import BaseModel, ConfigDict, Field

from backend.services.data.introspection import SCHEMA_CACHE_SECONDS

JS_MAX_SAFE_INTEGER = 2**53 - 1
MAX_OFFSET = 10_000_000

Scalar = Optional[Union[bool, int, float, str]]

GENERIC_TYPE_NAMES = {
    "ftBoolean": "BOOLEAN",
    "ftInteger": "INTEGER",
    "ftFloat": "FLOAT",
    "ftCurrency": "NUMERIC",
    "ftDate": "DATE",
    "ftDateTime": "DATETIME",
    "ftTime": "TIME",
    "ftBlob": "BLOB",
    "ftString": "VARCHAR",
    "ftMemo": "TEXT",
    "ftUnknown": "",
}

# (type name, field type or None = decide from the first non-null value)
ColumnHint = Optional[tuple[str, Optional[str]]]


@dataclass(frozen=True)
class ConnectionConfig:
    """Decrypted connection settings. Lives in memory only (never logged: ``repr=False``)."""

    driver: str
    host: str | None = None
    port: int | None = None
    database: str | None = None
    username: str | None = None
    password: str | None = field(default=None, repr=False)
    options: Mapping[str, str] = field(default_factory=dict)

    def to_json(self) -> dict[str, Any]:
        return {
            "driver": self.driver,
            "host": self.host,
            "port": self.port,
            "database": self.database,
            "username": self.username,
            "password": self.password,
            "options": dict(self.options),
        }

    @classmethod
    def from_json(cls, data: Mapping[str, Any]) -> ConnectionConfig:
        return cls(
            driver=str(data["driver"]),
            host=data.get("host"),
            port=data.get("port"),
            database=data.get("database"),
            username=data.get("username"),
            password=data.get("password"),
            options=dict(data.get("options") or {}),
        )

    @property
    def secrets(self) -> tuple[str, ...]:
        return (self.password,) if self.password else ()


class OrderByItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    column: str = Field(min_length=1, max_length=128)
    desc: bool = False


class TableRequest(BaseModel):
    """Body of ``POST /api/db/{id}/table`` (TTable style access, one table, keyed writes)."""

    model_config = ConfigDict(extra="forbid")

    op: Literal["select", "insert", "update", "delete"]
    table: str = Field(min_length=1, max_length=256)
    columns: list[str] | None = Field(default=None, max_length=1000)
    where: dict[str, Scalar] | None = None
    order_by: list[OrderByItem] | None = Field(default=None, max_length=32)
    limit: int | None = Field(default=None, ge=1)
    offset: int = Field(default=0, ge=0, le=MAX_OFFSET)
    values: dict[str, Scalar] | None = None
    key: dict[str, Scalar] | None = None


@dataclass
class QueryResult:
    columns: list[dict[str, Any]] = field(default_factory=list)
    rows: list[list[Any]] = field(default_factory=list)
    truncated: bool = False
    rows_affected: int | None = None
    last_insert_id: Any = None
    elapsed_ms: int = 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "columns": self.columns,
            "rows": self.rows,
            "row_count": len(self.rows),
            "truncated": self.truncated,
            "rows_affected": self.rows_affected,
            "last_insert_id": self.last_insert_id,
            "elapsed_ms": self.elapsed_ms,
        }


def elapsed_ms(started: float) -> int:
    return int(round((time.perf_counter() - started) * 1000))


# --------------------------------------------------------------------------- values


def serialize_value(value: Any) -> Any:
    """JSON-safe representation of a database value.

    datetime/date/time -> ISO 8601, Decimal -> float when that round-trips exactly
    (else str), bytes -> ``"<binary N bytes>"``, UUID -> str. Integers outside the
    JavaScript safe range and non-finite floats become strings.
    """
    if value is None or isinstance(value, (bool, str)):
        return value
    if isinstance(value, int):
        return value if -JS_MAX_SAFE_INTEGER <= value <= JS_MAX_SAFE_INTEGER else str(value)
    if isinstance(value, float):
        return value if math.isfinite(value) else str(value)
    if isinstance(value, Decimal):
        return _serialize_decimal(value)
    if isinstance(value, (datetime, date, dtime)):
        return value.isoformat()
    if isinstance(value, timedelta):
        return str(value)
    if isinstance(value, memoryview):
        return f"<binary {value.nbytes} bytes>"
    if isinstance(value, (bytes, bytearray)):
        return f"<binary {len(value)} bytes>"
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, Mapping):
        return {str(k): serialize_value(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set, frozenset)):
        return [serialize_value(v) for v in value]
    return str(value)


def _serialize_decimal(value: Decimal) -> float | str:
    if not value.is_finite():
        return str(value)
    as_float = float(value)
    if math.isfinite(as_float) and Decimal(repr(as_float)) == value:
        return as_float
    return str(value)


def field_type_from_value(value: Any) -> str:
    """Delphi field type inferred from a Python value (``ftUnknown`` for None)."""
    if value is None:
        return "ftUnknown"
    if isinstance(value, bool):
        return "ftBoolean"
    if isinstance(value, int):
        return "ftInteger"
    if isinstance(value, float):
        return "ftFloat"
    if isinstance(value, Decimal):
        return "ftCurrency"
    if isinstance(value, datetime):
        return "ftDateTime"
    if isinstance(value, date):
        return "ftDate"
    if isinstance(value, dtime):
        return "ftTime"
    if isinstance(value, (bytes, bytearray, memoryview)):
        return "ftBlob"
    if isinstance(value, (str, timedelta, uuid.UUID)):
        return "ftString"
    if isinstance(value, (Mapping, list, tuple)):
        return "ftMemo"
    return "ftUnknown"


def describe_columns(
    names: Sequence[str], hints: Sequence[ColumnHint], rows: Sequence[Sequence[Any]]
) -> list[dict[str, Any]]:
    """Result column descriptors; driver type hints win, values fill the gaps."""
    columns = []
    for index, name in enumerate(names):
        hint = hints[index] if index < len(hints) else None
        type_label, field_type = hint if hint else ("", None)
        sample = next((row[index] for row in rows if row[index] is not None), None)
        if isinstance(sample, (bytes, bytearray, memoryview)):
            field_type = "ftBlob"
        elif field_type == "ftBlob" and isinstance(sample, str):
            field_type, type_label = "ftMemo", "TEXT"  # MySQL reports TEXT columns as BLOB
        elif field_type is None:
            field_type = _field_type_from_values([row[index] for row in rows])
        columns.append(
            {"name": str(name), "type": type_label or GENERIC_TYPE_NAMES[field_type], "field_type": field_type}
        )
    return columns


def _field_type_from_values(values: Sequence[Any]) -> str:
    """Field type from all non-null values (SQLite stores 1975.00 in a NUMERIC column as 1975)."""
    kinds = {field_type_from_value(v) for v in values if v is not None}
    if not kinds:
        return "ftUnknown"
    if len(kinds) == 1:
        return kinds.pop()
    if kinds <= {"ftInteger", "ftFloat", "ftCurrency"}:
        return "ftCurrency" if "ftCurrency" in kinds else "ftFloat"
    if kinds <= {"ftDate", "ftDateTime"}:
        return "ftDateTime"
    return "ftString"


# --------------------------------------------------------------------------- adapter


class Adapter(ABC):
    """One live database target (engine/client + caches) for one saved connection."""

    family: str = ""

    def __init__(self, driver: str, *, read_only: bool, timeout_seconds: float, secrets: tuple[str, ...] = ()):
        self.driver = driver
        self.read_only = read_only
        self.timeout_seconds = timeout_seconds
        self._secrets = secrets
        self._schema_lock = threading.Lock()
        self._schema: tuple[float, dict[str, Any]] | None = None

    @property
    def dialect_name(self) -> str:
        return self.driver

    # -- schema cache -------------------------------------------------------------

    def get_schema(self, *, refresh: bool = False) -> dict[str, Any]:
        with self._schema_lock:
            cached = self._schema
        if cached and not refresh and time.monotonic() - cached[0] < SCHEMA_CACHE_SECONDS:
            return cached[1]
        schema = self.introspect()
        with self._schema_lock:
            self._schema = (time.monotonic(), schema)
        return schema

    def invalidate_schema(self) -> None:
        with self._schema_lock:
            self._schema = None

    # -- operations ---------------------------------------------------------------

    @abstractmethod
    def test(self) -> str:
        """Open a connection, run a trivial statement and return the server version."""

    @abstractmethod
    def introspect(self) -> dict[str, Any]:
        """Uncached schema description (see ``introspection.inspect_sql_schema``)."""

    @abstractmethod
    def execute(
        self, statement: str, params: Mapping[str, Any], *, limit: int, offset: int, mode: str, kind: str
    ) -> QueryResult:
        """Run one validated statement with bound parameters."""

    @abstractmethod
    def table_op(self, request: TableRequest, *, limit: int) -> dict[str, Any]:
        """TTable style select/insert/update/delete on one table."""

    @abstractmethod
    def call_procedure(self, name: str, params: Mapping[str, Any], *, limit: int) -> QueryResult:
        """Call an introspected stored procedure with bound parameters."""

    def dispose(self) -> None:
        """Release pooled connections."""
