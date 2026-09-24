"""Shared pytest fixtures. Environment must be prepared before ``backend`` is imported."""
from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

_TMP = Path(tempfile.mkdtemp(prefix="jsd-tests-"))
os.environ.setdefault("JSD_DATA_DIR", str(_TMP / "data"))
os.environ.setdefault("JSD_PROJECTS_DIR", str(_TMP / "projects"))
os.environ.setdefault("JSD_SEED_DEMO", "0")
os.environ.setdefault("JSD_FRONTEND_DIST", str(_TMP / "no-dist"))

REPO = Path(__file__).resolve().parents[2]
if str(REPO) not in sys.path:
    sys.path.insert(0, str(REPO))

import pytest  # noqa: E402

from backend.db import SessionLocal, init_db  # noqa: E402

init_db()


@pytest.fixture()
def db_session():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def tmp_root() -> Path:
    return _TMP


@pytest.fixture()
def client():
    """TestClient on the full application (requires every router to import)."""
    from fastapi.testclient import TestClient

    from backend.main import create_app

    with TestClient(create_app()) as c:
        yield c


def dev_headers(client, username: str = "tester") -> dict[str, str]:
    res = client.post("/api/auth/dev", json={"username": username})
    assert res.status_code == 200, res.text
    return {"Authorization": f"Bearer {res.json()['token']}"}


@pytest.fixture()
def auth_headers(client):
    return dev_headers(client)
