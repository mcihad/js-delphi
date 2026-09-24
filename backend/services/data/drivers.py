"""Registry of the supported database drivers (metadata only, no connections)."""
from __future__ import annotations

import importlib
from dataclasses import dataclass, field
from functools import lru_cache
from typing import Any

from backend.services.data.errors import DataError

SQL_FAMILY = "sql"
MONGO_FAMILY = "mongo"


@dataclass(frozen=True)
class DriverField:
    """A connection form field the IDE renders for a driver."""

    name: str
    label: str
    type: str = "text"  # text | number | password
    required: bool = False
    placeholder: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "label": self.label,
            "type": self.type,
            "required": self.required,
            "placeholder": self.placeholder,
        }


@dataclass(frozen=True)
class DriverSpec:
    driver: str
    label: str
    family: str  # sql | mongo
    dbapi_module: str  # imported to decide availability
    sqlalchemy_name: str | None  # "<dialect>+<dbapi>" for SQL drivers
    default_port: int | None
    fields: tuple[DriverField, ...]
    # Connection options a user may set (URL query parameters). Anything else is refused:
    # several driver options read local files or change security relevant behaviour.
    options: tuple[str, ...] = ()
    aliases: tuple[str, ...] = field(default_factory=tuple)

    @property
    def needs_host(self) -> bool:
        return any(f.name == "host" for f in self.fields)


def _server_fields(database_required: bool = False) -> tuple[DriverField, ...]:
    return (
        DriverField("host", "Sunucu", required=True, placeholder="localhost"),
        DriverField("port", "Port", type="number"),
        DriverField("database", "Veritabanı", required=database_required),
        DriverField("username", "Kullanıcı adı"),
        DriverField("password", "Parola", type="password"),
    )


DRIVERS: dict[str, DriverSpec] = {
    spec.driver: spec
    for spec in (
        DriverSpec(
            driver="sqlite",
            label="SQLite",
            family=SQL_FAMILY,
            dbapi_module="sqlite3",
            sqlalchemy_name="sqlite",
            default_port=None,
            fields=(DriverField("database", "Veritabanı dosyası", required=True, placeholder="app.db"),),
            aliases=("sqlite3",),
        ),
        DriverSpec(
            driver="postgresql",
            label="PostgreSQL",
            family=SQL_FAMILY,
            dbapi_module="psycopg",
            sqlalchemy_name="postgresql+psycopg",
            default_port=5432,
            fields=_server_fields(),
            options=("sslmode", "application_name", "connect_timeout", "target_session_attrs", "client_encoding"),
            aliases=("postgres", "pg", "psql"),
        ),
        DriverSpec(
            driver="mysql",
            label="MySQL",
            family=SQL_FAMILY,
            dbapi_module="pymysql",
            sqlalchemy_name="mysql+pymysql",
            default_port=3306,
            fields=_server_fields(),
            options=("charset", "connect_timeout", "read_timeout", "write_timeout"),
        ),
        DriverSpec(
            driver="mariadb",
            label="MariaDB",
            family=SQL_FAMILY,
            dbapi_module="pymysql",
            sqlalchemy_name="mariadb+pymysql",
            default_port=3306,
            fields=_server_fields(),
            options=("charset", "connect_timeout", "read_timeout", "write_timeout"),
        ),
        DriverSpec(
            driver="mssql",
            label="Microsoft SQL Server",
            family=SQL_FAMILY,
            dbapi_module="pymssql",
            sqlalchemy_name="mssql+pymssql",
            default_port=1433,
            fields=_server_fields(),
            options=("charset", "tds_version", "appname", "login_timeout"),
            aliases=("sqlserver",),
        ),
        DriverSpec(
            driver="mongodb",
            label="MongoDB",
            family=MONGO_FAMILY,
            dbapi_module="pymongo",
            sqlalchemy_name=None,
            default_port=27017,
            fields=_server_fields(database_required=True),
            options=(
                "authSource",
                "authMechanism",
                "replicaSet",
                "tls",
                "directConnection",
                "retryWrites",
                "readPreference",
                "appName",
                "srv",
            ),
            aliases=("mongo",),
        ),
    )
}

_ALIASES: dict[str, str] = {
    alias: spec.driver for spec in DRIVERS.values() for alias in (spec.driver, *spec.aliases)
}


def resolve_driver_name(name: str) -> str:
    """Canonical driver name for ``name`` (also accepts URL scheme aliases)."""
    key = (name or "").strip().lower()
    driver = _ALIASES.get(key)
    if driver is None:
        raise DataError(f"Desteklenmeyen veritabanı sürücüsü: {name or '(boş)'}")
    return driver


def get_driver(name: str) -> DriverSpec:
    return DRIVERS[resolve_driver_name(name)]


@lru_cache(maxsize=None)
def _module_importable(module: str) -> bool:
    try:
        importlib.import_module(module)
    except Exception:  # noqa: BLE001 - any import failure means "not available"
        return False
    return True


def is_available(driver: str) -> bool:
    """True when the DBAPI module of ``driver`` can be imported on this server."""
    return _module_importable(get_driver(driver).dbapi_module)


def ensure_available(spec: DriverSpec) -> None:
    if not _module_importable(spec.dbapi_module):
        raise DataError(f"{spec.label} sürücüsü sunucuda kurulu değil ({spec.dbapi_module})")


def list_drivers() -> list[dict[str, Any]]:
    """Driver catalogue for the IDE connection editor."""
    return [
        {
            "driver": spec.driver,
            "label": spec.label,
            "family": spec.family,
            "available": _module_importable(spec.dbapi_module),
            "default_port": spec.default_port,
            "fields": [f.to_dict() for f in spec.fields],
            "options": list(spec.options),
        }
        for spec in DRIVERS.values()
    ]
