"""BuildService — incremental, deterministic assembly of a runnable app.

Algorithm (per build):

1. Copy the fixed runtime (vcl.js / vcl.ts / vcl.css) when its hash changed.
2. For every form: ``flatten_design`` validates the design against the RTTI manifest.
   An *input hash* (design hash + unit hash + template hash + runtime manifest hash +
   sibling form list) is compared with the one stored for its outputs; unchanged forms
   are skipped, changed ones are rendered with Jinja2 into ``FormN.js`` (runtime module),
   ``FormN.ts`` (TypeScript source) and ``FormN.html``.
3. Project level files (``app.js``/``app.ts`` — the .dpr —, ``index.html`` menu,
   ``tsconfig.json``) are rendered the same way.
4. Stale outputs are deleted, file hashes are stored in ``build_artifacts`` and the SQL
   allow-list used by the runtime DB proxy is replaced (``build_statements``).

Every path is locked to ``projects/<id>/build`` with ``Path.resolve``.
"""
from __future__ import annotations

import io
import json
import time
import zipfile
from dataclasses import dataclass
from pathlib import Path

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from backend.config import settings
from backend.models import Build, BuildArtifact, BuildStatement, DbConnection, Form, Project, User
from backend.schemas import BuildFile, BuildMessage, BuildResult
from backend.security import lock_path, sha256_hex
from backend.services.design import DesignError, FlatForm, RuntimeManifest, flatten_design, load_manifest
from backend.services.file_service import dumps_json, files
from backend.services.project_service import slugify
from backend.services.template_service import templates

RUNTIME_FILES = ("vcl.js", "vcl.ts", "vcl.css")


@dataclass
class _Ctx:
    project: Project
    build_dir: Path
    artifacts: dict[str, BuildArtifact]
    planned: dict[str, BuildFile]
    force: bool
    db: Session


class BuildService:
    # ----------------------------------------------------------------- build

    def build(self, db: Session, project: Project, user: User | None = None, force: bool = False) -> BuildResult:
        t0 = time.perf_counter()
        warnings: list[BuildMessage] = []
        errors: list[BuildMessage] = []
        try:
            manifest = load_manifest()
        except RuntimeError as exc:
            return BuildResult(ok=False, files=[], warnings=[], errors=[BuildMessage(level="error", message=str(exc))])
        self._check_runtime(manifest, warnings)

        build_dir = files.build_dir(project.id)
        build_dir.mkdir(parents=True, exist_ok=True)
        ctx = _Ctx(
            project=project,
            build_dir=build_dir,
            artifacts={a.path: a for a in db.scalars(select(BuildArtifact).where(BuildArtifact.project_id == project.id))},
            planned={},
            force=force,
            db=db,
        )

        # 1. fixed runtime — copied, never generated
        for name in RUNTIME_FILES:
            data = (settings.runtime_dir / name).read_bytes()
            self._emit(ctx, name, data, unit="", input_hash=sha256_hex(data))

        # project assets (TImage.Picture = "assets/…") are copied next to the pages
        for asset in files.list_assets(project.id):
            data = files.path(project.id, asset).read_bytes()
            self._emit(ctx, asset, data, unit="", input_hash=sha256_hex(data))

        forms = db.scalars(select(Form).where(Form.project_id == project.id).order_by(Form.sort_order, Form.name)).all()
        form_names = tuple(f.name for f in forms)
        tpl_hash = templates.templates_hash()
        rebuilt: list[str] = []
        skipped: list[str] = []
        user_code_lines: dict[str, int] = {}
        flats: list[FlatForm] = []

        # 2. forms
        for form in forms:
            design_file = f"forms/{form.name}.design.tson"
            try:
                flat = flatten_design(json.loads(form.design_json), manifest, form_names=form_names)
            except (DesignError, json.JSONDecodeError) as exc:
                errors.append(BuildMessage(level="error", message=str(exc), file=design_file))
                continue
            warnings.extend(BuildMessage(level="warning", message=w, file=design_file, component=w.split(":", 1)[0]) for w in flat.warnings)
            if flat.errors:
                errors.extend(BuildMessage(level="error", message=e, file=design_file) for e in flat.errors)
                continue
            flats.append(flat)
            siblings = [n for n in form_names if n != form.name]
            input_hash = sha256_hex(form.design_hash, form.code_hash, tpl_hash, manifest.digest, ",".join(siblings))
            outputs = (f"{form.name}.js", f"{form.name}.ts", f"{form.name}.html")
            if not force and all(self._up_to_date(ctx, p, input_hash) for p in outputs):
                skipped.append(form.name)
                for p in outputs:
                    self._keep(ctx, p, unit=form.name)
                user_code_lines[form.name] = json.loads(ctx.artifacts[f"{form.name}.js"].meta_json or "{}").get("user_code_line", 0)
                continue
            marker = f"//#region unit: forms/{form.name}.ts"
            common = {
                "form": flat,
                "design_hash": form.design_hash,
                "unit_hash": form.code_hash,
                "vcl_version": manifest.version,
                "exports": list(manifest.exports),
                "type_exports": list(manifest.type_exports),
                "sibling_forms": siblings,
                "unit_marker": marker,
            }
            js = templates.render("form.js.j2", **common, unit_code=(form.code_js or form.code).rstrip())
            ts = templates.render("form.ts.j2", **common, unit_code=form.code.rstrip())
            html = templates.render("form.html.j2", form=flat, vcl_version=manifest.version)
            line = js.split("\n").index(marker) + 2
            user_code_lines[form.name] = line
            self._emit(ctx, f"{form.name}.js", js, unit=form.name, input_hash=input_hash, meta={"user_code_line": line})
            self._emit(ctx, f"{form.name}.ts", ts, unit=form.name, input_hash=input_hash)
            self._emit(ctx, f"{form.name}.html", html, unit=form.name, input_hash=input_hash)
            rebuilt.append(form.name)

        # 3. project level files
        if flats:
            self._emit_project_files(ctx, project, forms, flats, manifest, tpl_hash)
        elif not errors:
            errors.append(BuildMessage(level="error", message="Projede derlenecek form yok"))

        # 4. stale outputs + allow-list
        self._remove_stale(ctx)
        if not errors:
            self._store_statements(db, project, flats)

        duration = int((time.perf_counter() - t0) * 1000)
        changed = sum(1 for f in ctx.planned.values() if f.changed)
        record = Build(
            project_id=project.id,
            ok=not errors,
            input_hash=sha256_hex(*sorted(f"{p}:{f.sha256}" for p, f in ctx.planned.items())),
            warnings_json=json.dumps([w.model_dump() for w in warnings], ensure_ascii=False),
            errors_json=json.dumps([e.model_dump() for e in errors], ensure_ascii=False),
            changed_files=changed,
            duration_ms=duration,
            started_by=user.id if user else None,
        )
        db.add(record)
        db.commit()
        return BuildResult(
            ok=not errors,
            files=sorted(ctx.planned.values(), key=lambda f: f.path),
            warnings=warnings,
            errors=errors,
            build_id=record.id,
            duration_ms=duration,
            changed=changed,
            skipped_units=skipped,
            rebuilt_units=rebuilt,
            user_code_lines=user_code_lines,
        )

    # -------------------------------------------------------------- helpers

    def _check_runtime(self, manifest: RuntimeManifest, warnings: list[BuildMessage]) -> None:
        src = settings.runtime_dir / "vcl.ts"
        if manifest.source_sha256 and sha256_hex(src.read_bytes()) != manifest.source_sha256:
            warnings.append(
                BuildMessage(level="warning", message="vcl.js, vcl.ts ile güncel değil — 'npm run build:runtime' çalıştırın", file="runtime/vcl.ts")
            )

    def _target(self, ctx: _Ctx, rel: str) -> Path:
        return lock_path(ctx.build_dir, rel)

    def _up_to_date(self, ctx: _Ctx, rel: str, input_hash: str) -> bool:
        art = ctx.artifacts.get(rel)
        if art is None or art.input_hash != input_hash:
            return False
        target = self._target(ctx, rel)
        return target.is_file() and sha256_hex(target.read_bytes()) == art.sha256

    def _keep(self, ctx: _Ctx, rel: str, unit: str) -> None:
        art = ctx.artifacts[rel]
        ctx.planned[rel] = BuildFile(path=rel, sha256=art.sha256, size=art.size, changed=False, unit=unit)

    def _emit(self, ctx: _Ctx, rel: str, content: str | bytes, *, unit: str, input_hash: str, meta: dict | None = None) -> None:
        data = content.encode("utf-8") if isinstance(content, str) else content
        digest = sha256_hex(data)
        target = self._target(ctx, rel)
        art = ctx.artifacts.get(rel)
        on_disk = target.is_file() and sha256_hex(target.read_bytes()) == digest
        changed = ctx.force or not on_disk
        if changed:
            files.write_atomic(target, data)
        if art is None:
            art = BuildArtifact(project_id=ctx.project.id, path=rel)
            ctx.db.add(art)
            ctx.artifacts[rel] = art
        art.unit, art.input_hash, art.sha256, art.size = unit, input_hash, digest, len(data)
        art.meta_json = json.dumps(meta or {})
        ctx.planned[rel] = BuildFile(path=rel, sha256=digest, size=len(data), changed=changed, unit=unit)

    def _emit_project_files(self, ctx: _Ctx, project: Project, forms: list[Form], flats: list[FlatForm], manifest: RuntimeManifest, tpl_hash: str) -> None:
        ok_names = [f.name for f in flats]
        main = project.main_form if project.main_form in ok_names else ok_names[0]
        conns = ctx.db.scalars(select(DbConnection).where(DbConnection.project_id == project.id).order_by(DbConnection.name)).all()
        context = {
            "project": {"name": project.name, "title": project.title or project.name, "description": project.description, "main_form": main},
            "forms": [{"name": f.name, "caption": f.caption} for f in flats],
            "connections": {c.name: c.id for c in conns},
            "main_form": main,
            "auto_create": [f.name for f in forms if f.auto_create and f.name in ok_names],
            "vcl_version": manifest.version,
            "files": ["vcl.ts", "app.ts", *[f"{n}.ts" for n in ok_names]],
        }
        input_hash = sha256_hex(json.dumps(context, sort_keys=True, ensure_ascii=False), tpl_hash, manifest.digest)
        outputs = {"app.js": "app.js.j2", "app.ts": "app.ts.j2", "index.html": "index.html.j2", "tsconfig.json": "tsconfig.json.j2"}
        for rel, tpl in outputs.items():
            if not ctx.force and self._up_to_date(ctx, rel, input_hash):
                self._keep(ctx, rel, unit="")
            else:
                self._emit(ctx, rel, templates.render(tpl, **context), unit="", input_hash=input_hash)

    def _remove_stale(self, ctx: _Ctx) -> None:
        for rel, art in list(ctx.artifacts.items()):
            if rel in ctx.planned:
                continue
            try:
                target = self._target(ctx, rel)
                if target.is_file():
                    target.unlink()
            except ValueError:
                pass
            ctx.db.delete(art)
            del ctx.artifacts[rel]

    def _store_statements(self, db: Session, project: Project, flats: list[FlatForm]) -> None:
        from backend.services.data.sql_safety import statement_digest

        db.execute(delete(BuildStatement).where(BuildStatement.project_id == project.id))
        seen: set[tuple[str, str, str]] = set()
        for flat in flats:
            for st in flat.statements:
                digest = statement_digest(st.kind, st.text)
                key = (st.connection.lower(), st.kind, digest)
                if key in seen:
                    continue
                seen.add(key)
                db.add(
                    BuildStatement(
                        project_id=project.id,
                        connection_name=st.connection,
                        kind=st.kind,
                        digest=digest,
                        text=st.text,
                        read_only=st.read_only,
                        source=st.source,
                    )
                )

    # --------------------------------------------------------------- export

    def export_zip(self, db: Session, project: Project, user: User | None = None, include_data: bool = False) -> tuple[bytes, BuildResult]:
        """Deterministic zip: sources (project.tson, forms, assets) + build output."""
        result = self.build(db, project, user)
        root = files.project_dir(project.id)
        buf = io.BytesIO()
        forms = db.scalars(select(Form).where(Form.project_id == project.id).order_by(Form.sort_order, Form.name)).all()
        extras = {
            "README.md": templates.render("export_README.md.j2", project=project, forms=forms),
            "package.json": templates.render("export_package.json.j2", project=project, package_name=slugify(project.name)),
        }
        with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as zf:

            def add(arcname: str, data: bytes) -> None:
                info = zipfile.ZipInfo(arcname, date_time=(1980, 1, 1, 0, 0, 0))
                info.compress_type = zipfile.ZIP_DEFLATED
                info.external_attr = 0o644 << 16
                zf.writestr(info, data)

            for name, text in sorted(extras.items()):
                add(name, text.encode("utf-8"))
            for sub in ("project.tson", "forms", "assets", "build", "data"):
                base = root / sub
                paths = [base] if base.is_file() else sorted(p for p in base.rglob("*") if p.is_file()) if base.exists() else []
                for p in paths:
                    rel = p.relative_to(root).as_posix()
                    if rel.startswith("data/") and not include_data and not rel.startswith("data/migrations/"):
                        continue
                    if p.name.startswith(".tmp-"):
                        continue
                    add(rel, p.read_bytes())
        return buf.getvalue(), result


builder = BuildService()

__all__ = ["builder", "BuildService", "dumps_json"]
