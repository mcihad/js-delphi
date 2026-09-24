"""Application settings, read once from environment variables (``JSD_*``)."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent
REPO_DIR = BACKEND_DIR.parent


def _env(name: str, default: str) -> str:
    return os.environ.get(name, default)


def _env_bool(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _env_int(name: str, default: int) -> int:
    raw = os.environ.get(name)
    return int(raw) if raw and raw.strip().isdigit() else default


def _env_path(name: str, default: Path) -> Path:
    raw = os.environ.get(name)
    return Path(raw).expanduser().resolve() if raw else default.resolve()


@dataclass(frozen=True)
class Settings:
    app_name: str = "JS-Delphi"
    version: str = "1.0.0"

    data_dir: Path = field(default_factory=lambda: _env_path("JSD_DATA_DIR", REPO_DIR / "data"))
    projects_dir: Path = field(default_factory=lambda: _env_path("JSD_PROJECTS_DIR", REPO_DIR / "projects"))
    runtime_dir: Path = BACKEND_DIR / "runtime"
    templates_dir: Path = BACKEND_DIR / "templates"
    frontend_dist: Path = field(
        default_factory=lambda: _env_path("JSD_FRONTEND_DIST", REPO_DIR / "frontend" / "dist")
    )

    # Metadata database (projects, forms, revisions, build hashes, encrypted connections).
    database_url: str = field(default_factory=lambda: _env("JSD_DATABASE_URL", ""))

    # Secrets. JSD_MASTER_KEY: base64url encoded 32 byte AES-256 key. When empty a key
    # file is generated inside data_dir with 0600 permissions.
    master_key_b64: str = field(default_factory=lambda: _env("JSD_MASTER_KEY", ""))

    # Auth
    dev_login: bool = field(default_factory=lambda: _env_bool("JSD_DEV_LOGIN", True))
    allow_register: bool = field(default_factory=lambda: _env_bool("JSD_ALLOW_REGISTER", True))
    token_ttl_seconds: int = field(default_factory=lambda: _env_int("JSD_TOKEN_TTL", 7 * 24 * 3600))
    run_token_ttl_seconds: int = field(default_factory=lambda: _env_int("JSD_RUN_TOKEN_TTL", 4 * 3600))

    # Data access guard rails
    db_max_rows: int = field(default_factory=lambda: _env_int("JSD_DB_MAX_ROWS", 5000))
    db_default_rows: int = 500
    db_timeout_seconds: int = field(default_factory=lambda: _env_int("JSD_DB_TIMEOUT", 15))

    # Live sync
    ws_max_message_bytes: int = 2 * 1024 * 1024
    save_debounce_ms: int = 300

    # Seed a demo project on first start
    seed_demo: bool = field(default_factory=lambda: _env_bool("JSD_SEED_DEMO", True))

    cors_origins: tuple[str, ...] = field(
        default_factory=lambda: tuple(
            o.strip() for o in _env("JSD_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if o.strip()
        )
    )

    @property
    def effective_database_url(self) -> str:
        return self.database_url or f"sqlite:///{(self.data_dir / 'jsdelphi.sqlite3').as_posix()}"

    @property
    def master_key_file(self) -> Path:
        return self.data_dir / "master.key"

    def ensure_dirs(self) -> None:
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.projects_dir.mkdir(parents=True, exist_ok=True)


settings = Settings()
