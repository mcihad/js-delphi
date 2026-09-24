"""FileService — every filesystem access of a project goes through here.

Layout of ``projects/<project_id>/``::

    project.tson                 project metadata (no secrets)
    forms/Form1.design.tson      component tree (Delphi .dfm equivalent)
    forms/Form1.ts               unit source written in the IDE
    data/                        SQLite files, migrations/*.json
    assets/                      images referenced by TImage.Picture
    build/                       BuildService output (served under /preview)

All paths are resolved with ``Path.resolve`` and locked to the project root.
"""
from __future__ import annotations

import json
import os
import shutil
import tempfile
from pathlib import Path
from typing import Any

from backend.config import settings
from backend.security import is_valid_identifier, lock_path, sha256_hex

ASSET_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".ico"}
MAX_ASSET_BYTES = 5 * 1024 * 1024


class FileService:
    def __init__(self, root: Path | None = None):
        self.root = (root or settings.projects_dir).resolve()

    # ------------------------------------------------------------------ paths

    def project_dir(self, project_id: str) -> Path:
        if not project_id.isalnum():
            raise ValueError("geçersiz proje kimliği")
        return lock_path(self.root, project_id)

    def path(self, project_id: str, *parts: str) -> Path:
        return lock_path(self.project_dir(project_id), *parts)

    def build_dir(self, project_id: str) -> Path:
        return self.path(project_id, "build")

    def data_dir(self, project_id: str) -> Path:
        return self.path(project_id, "data")

    def ensure_project_dirs(self, project_id: str) -> Path:
        root = self.project_dir(project_id)
        for sub in ("forms", "data", "assets", "build"):
            (root / sub).mkdir(parents=True, exist_ok=True)
        return root

    # ----------------------------------------------------------------- writes

    @staticmethod
    def write_atomic(path: Path, data: bytes | str) -> None:
        """Write via temp file + ``os.replace`` so readers never see partial files."""
        payload = data.encode("utf-8") if isinstance(data, str) else data
        path.parent.mkdir(parents=True, exist_ok=True)
        fd, tmp = tempfile.mkstemp(prefix=".tmp-", dir=str(path.parent))
        try:
            with os.fdopen(fd, "wb") as fh:
                fh.write(payload)
            os.replace(tmp, path)
        except BaseException:
            try:
                os.unlink(tmp)
            except FileNotFoundError:
                pass
            raise

    def write_project_meta(self, project_id: str, meta: dict[str, Any]) -> None:
        self.write_atomic(self.path(project_id, "project.tson"), dumps_json(meta))

    def write_form_files(self, project_id: str, name: str, design_text: str, code: str) -> None:
        if not is_valid_identifier(name):
            raise ValueError(f"geçersiz form adı: {name!r}")
        self.write_atomic(self.path(project_id, "forms", f"{name}.design.tson"), design_text)
        self.write_atomic(self.path(project_id, "forms", f"{name}.ts"), code)

    def delete_form_files(self, project_id: str, name: str) -> None:
        for fname in (f"{name}.design.tson", f"{name}.ts"):
            p = self.path(project_id, "forms", fname)
            if p.exists():
                p.unlink()

    def rename_form_files(self, project_id: str, old: str, new: str) -> None:
        for suffix in (".design.tson", ".ts"):
            src = self.path(project_id, "forms", f"{old}{suffix}")
            if src.exists():
                os.replace(src, self.path(project_id, "forms", f"{new}{suffix}"))

    def delete_project(self, project_id: str) -> None:
        root = self.project_dir(project_id)
        if root.exists():
            shutil.rmtree(root)

    # ----------------------------------------------------------------- assets

    def save_asset(self, project_id: str, filename: str, data: bytes) -> str:
        name = Path(filename).name
        stem, ext = os.path.splitext(name)
        ext = ext.lower()
        if ext not in ASSET_EXTENSIONS:
            raise ValueError("desteklenmeyen dosya türü")
        if len(data) > MAX_ASSET_BYTES:
            raise ValueError("dosya çok büyük (en fazla 5 MB)")
        safe_stem = "".join(ch for ch in stem if ch.isalnum() or ch in "-_")[:48] or "asset"
        final = f"{safe_stem}-{sha256_hex(data)[:8]}{ext}"
        self.write_atomic(self.path(project_id, "assets", final), data)
        return f"assets/{final}"

    def list_assets(self, project_id: str) -> list[str]:
        folder = self.path(project_id, "assets")
        if not folder.exists():
            return []
        return sorted(f"assets/{p.name}" for p in folder.iterdir() if p.is_file() and p.suffix.lower() in ASSET_EXTENSIONS)


def dumps_json(value: Any) -> str:
    """Deterministic, diff friendly JSON (2-space indent, UTF-8, trailing newline)."""
    return json.dumps(value, indent=2, ensure_ascii=False) + "\n"


def file_sha256(path: Path) -> str:
    return sha256_hex(path.read_bytes())


files = FileService()
