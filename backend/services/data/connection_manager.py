"""Connection manager: encrypted connection definitions and cached live adapters.

* Definitions are stored in ``DbConnection.config_enc`` as AES-256-GCM ciphertext whose
  associated data is the connection id; decrypted configs only live in memory here.
* The IDE only ever receives :func:`connection_summary` (no password, no URL).
* SQLite files are locked to ``projects/<id>/data`` (``Path.resolve`` containment).
* One adapter (engine + pools + schema cache) is cached per connection and rebuilt when
  the definition changes.
"""
from __future__ import annotations

import json
import re
import threading
import time
from pathlib import Path
from typing import Any
from urllib.parse import parse_qsl, unquote, urlsplit

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, select
from sqlalchemy.engine import make_url
from sqlalchemy.exc import ArgumentError
from sqlalchemy.orm import Session

from backend.config import settings
from backend.models import DbConnection, Project, new_id, utcnow
from backend.security import PathSecurityError, lock_path, secret_box, sha256_hex
from backend.services.data.adapters.base import Adapter, ConnectionConfig
from backend.services.data.drivers import MONGO_FAMILY, ensure_available, get_driver, resolve_driver_name
from backend.services.data.errors import DataConflict, DataError, DataNotFound, sanitize_error

IDENT = r"^[A-Za-z_][A-Za-z0-9_]{0,63}$"
_HOST_RE = re.compile(r"^[A-Za-z0-9._\-:\[\]]{1,253}$")
_SQLITE_SUFFIXES = (".db", ".sqlite", ".sqlite3", ".db3")


class ConnectionIn(BaseModel):
    """Connection definition sent by the IDE. ``password`` is write-only:
    ``None`` keeps the stored password on update, ``""`` clears it."""

    model_config = ConfigDict(extra="forbid")

    project_id: str = Field(min_length=1, max_length=32)
    name: str = Field(pattern=IDENT)
    driver: str = Field(min_length=1, max_length=32)
    host: str | None = Field(default=None, max_length=253)
    port: int | None = Field(default=None, ge=1, le=65535)
    database: str | None = Field(default=None, max_length=512)
    username: str | None = Field(default=None, max_length=128)
    password: str | None = Field(default=None, max_length=1024)
    options: dict[str, str] = Field(default_factory=dict)
    url: str | None = Field(default=None, max_length=2048)
    read_only: bool = False


# --------------------------------------------------------------------------- config


def _parse_url(url: str) -> dict[str, Any]:
    """Split a SQLAlchemy/Mongo URL into ConnectionIn fields (credentials included)."""
    scheme = url.split("://", 1)[0].lower() if "://" in url else ""
    if scheme.startswith("mongodb"):
        parts = urlsplit(url)
        return {
            "driver": "mongodb",
            "host": parts.hostname,
            "port": parts.port,
            "database": (parts.path or "/").lstrip("/") or None,
            "username": unquote(parts.username) if parts.username else None,
            "password": unquote(parts.password) if parts.password else None,
            "options": {**dict(parse_qsl(parts.query)), **({"srv": "true"} if scheme == "mongodb+srv" else {})},
        }
    try:
        u = make_url(url)
    except ArgumentError as exc:
        raise DataError("Bağlantı dizesi çözümlenemedi") from exc
    return {
        "driver": u.get_backend_name(),
        "host": u.host,
        "port": u.port,
        "database": u.database,
        "username": u.username,
        "password": u.password if u.password is None else str(u.password),
        "options": {k: v if isinstance(v, str) else v[-1] for k, v in u.query.items()},
    }


def build_config(data: ConnectionIn, existing: ConnectionConfig | None = None) -> ConnectionConfig:
    fields: dict[str, Any] = {
        "driver": data.driver,
        "host": data.host,
        "port": data.port,
        "database": data.database,
        "username": data.username,
        "password": data.password,
        "options": dict(data.options),
    }
    if data.url:
        parsed = _parse_url(data.url.strip())
        for key, value in parsed.items():
            if value not in (None, "", {}):
                fields[key] = value
    driver = resolve_driver_name(str(fields["driver"]))
    spec = get_driver(driver)
    options = {str(k): str(v) for k, v in (fields.get("options") or {}).items()}
    bad = sorted(k for k in options if k not in spec.options)
    if bad:
        raise DataError(f"İzin verilmeyen bağlantı seçenekleri: {', '.join(bad)}")
    host = (fields.get("host") or "").strip() or None
    if spec.needs_host:
        if not host:
            raise DataError("Sunucu (host) zorunlu")
        if not _HOST_RE.match(host):
            raise DataError("Geçersiz sunucu adı")
    database = (fields.get("database") or "").strip() or None
    if any(f.name == "database" and f.required for f in spec.fields) and not database:
        raise DataError("Veritabanı adı zorunlu")
    password = fields.get("password")
    if password is None and existing is not None:
        password = existing.password
    return ConnectionConfig(
        driver=driver,
        host=host if spec.needs_host else None,
        port=fields.get("port") if spec.needs_host else None,
        database=database,
        username=(fields.get("username") or None) if spec.needs_host else None,
        password=(password or None) if spec.needs_host else None,
        options=options,
    )


def sqlite_path(project_id: str, database: str | None) -> Path:
    """Resolve a SQLite database name inside ``projects/<id>/data`` (no escapes, no URIs)."""
    name = (database or "").strip()
    if not name or name == ":memory:" or name.lower().startswith("file:") or "\x00" in name:
        raise DataError("Geçersiz SQLite veritabanı adı")
    if Path(name).is_absolute() or name.startswith(("/", "\\")) or re.match(r"^[A-Za-z]:", name):
        raise DataError("SQLite yolu proje veri klasörüne göre göreli olmalı")
    if not name.lower().endswith(_SQLITE_SUFFIXES):
        raise DataError("SQLite dosyası .db, .sqlite, .sqlite3 veya .db3 uzantılı olmalı")
    from backend.services.file_service import files

    try:
        return lock_path(files.data_dir(project_id), name)
    except PathSecurityError as exc:
        raise DataError("SQLite yolu proje veri klasörünün dışına çıkamaz") from exc


def decrypt_config(conn: DbConnection) -> ConnectionConfig:
    try:
        return ConnectionConfig.from_json(secret_box.decrypt_json(conn.config_enc, aad=conn.id))
    except Exception as exc:  # noqa: BLE001 - tampered or foreign ciphertext
        raise DataError("Bağlantı tanımı çözülemedi (anahtar değişmiş olabilir)", 500) from exc


def summary_of(config: ConnectionConfig) -> dict[str, Any]:
    return {
        "host": config.host,
        "port": config.port,
        "database": config.database,
        "username": config.username,
        "has_password": bool(config.password),
        "options": sorted(config.options),
    }


def connection_summary(conn: DbConnection) -> dict[str, Any]:
    """Everything the IDE may know about a connection — never the password or a URL."""
    try:
        summary = json.loads(conn.summary_json or "{}")
    except json.JSONDecodeError:
        summary = {}
    spec = get_driver(conn.driver)
    return {
        "id": conn.id,
        "project_id": conn.project_id,
        "name": conn.name,
        "driver": conn.driver,
        "driver_label": spec.label,
        "family": spec.family,
        "host": summary.get("host"),
        "port": summary.get("port"),
        "database": summary.get("database"),
        "username": summary.get("username"),
        "has_password": bool(summary.get("has_password")),
        "options": summary.get("options", []),
        "read_only": conn.read_only,
        "last_test_ok": conn.last_test_ok,
        "last_test_message": conn.last_test_message,
        "last_test_at": conn.last_test_at.isoformat() if conn.last_test_at else None,
        "created_at": conn.created_at.isoformat() if conn.created_at else None,
        "updated_at": conn.updated_at.isoformat() if conn.updated_at else None,
    }


def _store(conn: DbConnection, config: ConnectionConfig) -> None:
    conn.driver = config.driver
    conn.config_enc = secret_box.encrypt_json(config.to_json(), aad=conn.id)
    conn.summary_json = json.dumps(summary_of(config))


# --------------------------------------------------------------------------- CRUD


def _check_unique_name(db: Session, project_id: str, name: str, exclude: str | None = None) -> None:
    clash = db.scalar(select(DbConnection).where(DbConnection.project_id == project_id, func.lower(DbConnection.name) == name.lower()))
    if clash is not None and clash.id != exclude:
        raise DataConflict(f"'{name}' adında bir bağlantı zaten var")


def create_connection(db: Session, project: Project, data: ConnectionIn) -> DbConnection:
    if data.project_id != project.id:
        raise DataError("Bağlantı başka bir projeye ait")
    _check_unique_name(db, project.id, data.name)
    config = build_config(data)
    if config.driver == "sqlite":
        sqlite_path(project.id, config.database)
    conn = DbConnection(id=new_id(), project_id=project.id, name=data.name, driver=config.driver, config_enc="", read_only=data.read_only)
    _store(conn, config)
    db.add(conn)
    db.flush()
    return conn


def update_connection(db: Session, conn: DbConnection, data: ConnectionIn) -> DbConnection:
    if data.project_id != conn.project_id:
        raise DataError("Bağlantı başka bir projeye taşınamaz")
    _check_unique_name(db, conn.project_id, data.name, exclude=conn.id)
    config = build_config(data, existing=decrypt_config(conn))
    if config.driver == "sqlite":
        sqlite_path(conn.project_id, config.database)
    conn.name = data.name
    conn.read_only = data.read_only
    _store(conn, config)
    conn.updated_at = utcnow()
    conn.last_test_ok = None
    conn.last_test_message = ""
    dispose(conn.id)
    db.flush()
    return conn


def delete_connection(db: Session, conn: DbConnection) -> None:
    dispose(conn.id)
    db.delete(conn)
    db.flush()


def get_connection(db: Session, connection_id: str) -> DbConnection:
    conn = db.get(DbConnection, connection_id) if connection_id.isalnum() else None
    if conn is None:
        raise DataNotFound("Bağlantı bulunamadı")
    return conn


# --------------------------------------------------------------------------- adapters

_cache: dict[str, tuple[str, Adapter]] = {}
_cache_lock = threading.Lock()


def _make_adapter(project_id: str, config: ConnectionConfig, read_only: bool) -> Adapter:
    spec = get_driver(config.driver)
    ensure_available(spec)
    timeout = float(settings.db_timeout_seconds)
    if spec.family == MONGO_FAMILY:
        from backend.services.data.adapters.mongo import MongoAdapter

        return MongoAdapter(config, read_only=read_only, timeout_seconds=timeout)
    from backend.services.data.adapters.sql import create_sql_adapter

    path = sqlite_path(project_id, config.database) if config.driver == "sqlite" else None
    if path is not None and read_only and not path.exists():
        raise DataNotFound("SQLite veritabanı dosyası bulunamadı")
    return create_sql_adapter(config, sqlite_path=path, read_only=read_only, timeout_seconds=timeout)


def get_adapter(conn: DbConnection) -> Adapter:
    """Cached adapter for a saved connection (rebuilt when its definition changes)."""
    fingerprint = sha256_hex(conn.config_enc, str(conn.read_only))
    with _cache_lock:
        cached = _cache.get(conn.id)
        if cached and cached[0] == fingerprint:
            return cached[1]
    adapter = _make_adapter(conn.project_id, decrypt_config(conn), conn.read_only)
    with _cache_lock:
        old = _cache.get(conn.id)
        _cache[conn.id] = (fingerprint, adapter)
    if old and old[1] is not adapter:
        old[1].dispose()
    return adapter


def dispose(connection_id: str) -> None:
    with _cache_lock:
        cached = _cache.pop(connection_id, None)
    if cached:
        cached[1].dispose()


def test_connection(db: Session, project: Project, target: ConnectionIn | DbConnection) -> dict[str, Any]:
    """Opens a connection and runs a trivial statement. Saved connections record the outcome."""
    started = time.perf_counter()
    temporary: Adapter | None = None
    secrets: tuple[str, ...] = ()
    try:
        if isinstance(target, DbConnection):
            config = decrypt_config(target)
            secrets = config.secrets
            adapter = get_adapter(target)
        else:
            existing = None
            config = build_config(target, existing)
            secrets = config.secrets
            temporary = adapter = _make_adapter(project.id, config, read_only=target.read_only)
        version = adapter.test()
        result = {"ok": True, "message": "Bağlantı başarılı", "server_version": version}
    except DataError as exc:
        result = {"ok": False, "message": exc.message, "server_version": None}
    except Exception as exc:  # noqa: BLE001 - driver specific failures
        result = {"ok": False, "message": sanitize_error(exc, secrets), "server_version": None}
    finally:
        if temporary is not None:
            temporary.dispose()
    result["elapsed_ms"] = int((time.perf_counter() - started) * 1000)
    if isinstance(target, DbConnection):
        target.last_test_ok = bool(result["ok"])
        target.last_test_message = str(result["message"])[:500]
        target.last_test_at = utcnow()
        db.flush()
    return result
