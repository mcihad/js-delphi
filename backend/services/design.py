"""Design documents (``Form1.design.tson``) — the Delphi ``.dfm`` of JS-Delphi.

* ``canonical_design`` / ``dumps_design`` produce a deterministic, diff friendly JSON.
* ``flatten_design`` validates a component tree against the runtime RTTI manifest
  (``runtime/vcl.manifest.json``, produced from vcl.ts) and turns it into an ordered
  flat list the Jinja2 templates can render. Anything that is not declared in the
  manifest (classes, properties, events, enum members, identifiers) is rejected, so
  the templates never receive attacker controlled code — only validated data.
"""
from __future__ import annotations

import json
import math
import re
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any

from backend.config import settings
from backend.security import RESERVED_IDENTIFIERS, is_valid_identifier, sha256_hex

DESIGN_FORMAT = "jsd-design"
DESIGN_VERSION = 1
NODE_KEYS = ("class", "name", "props", "events", "children")
MAX_COMPONENTS = 2000
MAX_DEPTH = 32
MAX_STRING = 100_000

_COLOR_RE = re.compile(r"^(#[0-9a-fA-F]{6}|\$[0-9a-fA-F]{8})$")
_FONT_NAME_RE = re.compile(r"^[A-Za-z0-9 _\-]{1,64}$")
_PARAM_NAME_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]{0,63}$")
_UNSAFE_URL_SCHEME = re.compile(r"^[a-z][a-z0-9+.\-]*:", re.IGNORECASE)
_SAFE_DATA_IMAGE = re.compile(r"^data:image/(png|jpe?g|gif|webp|bmp|svg\+xml|x-icon);", re.IGNORECASE)


class DesignError(ValueError):
    """Structural error that makes a design unusable."""


# --------------------------------------------------------------------------- manifest


@dataclass(frozen=True)
class PropInfo:
    name: str
    kind: str
    category: str
    default: Any
    values: tuple[str, ...] | None
    ref_class: str | None
    stored: bool
    design_only: bool
    minimum: float | None
    maximum: float | None


@dataclass(frozen=True)
class ClassInfo:
    name: str
    parent: str | None
    ancestors: tuple[str, ...]
    visual: bool
    container: bool
    abstract: bool
    palette: str | None
    props: tuple[PropInfo, ...]
    events: dict[str, str]  # name -> TS parameter list ("Sender: $Self, e?: MouseEvent")

    def prop(self, name: str) -> PropInfo | None:
        for p in self.props:
            if p.name == name:
                return p
        return None

    def is_a(self, base: str) -> bool:
        return self.name == base or base in self.ancestors


class RuntimeManifest:
    """Read-only view of ``vcl.manifest.json`` (RTTI exported by the fixed runtime)."""

    def __init__(self, data: dict[str, Any]):
        if data.get("format") != "jsd-vcl-manifest":
            raise RuntimeError("vcl.manifest.json biçimi tanınmadı")
        self.raw = data
        self.version: str = data.get("version", "")
        self.exports: tuple[str, ...] = tuple(data.get("exports", ()))
        self.type_exports: tuple[str, ...] = tuple(data.get("type_exports", ()))
        self.reserved_members: frozenset[str] = frozenset(data.get("reserved_member_names", ()))
        self.colors: frozenset[str] = frozenset(data.get("colors", ()))
        self.enums: dict[str, tuple[str, ...]] = {k: tuple(v) for k, v in data.get("enums", {}).items()}
        self.source_sha256: str = data.get("source_sha256", "")
        self.classes: dict[str, ClassInfo] = {}
        for c in data.get("classes", []):
            props = tuple(
                PropInfo(
                    name=p["name"],
                    kind=p["kind"],
                    category=p.get("category", "Misc"),
                    default=p.get("default"),
                    values=tuple(p["values"]) if p.get("values") is not None else None,
                    ref_class=p.get("refClass"),
                    stored=p.get("stored", True) is not False,
                    design_only=bool(p.get("designOnly")),
                    minimum=p.get("min"),
                    maximum=p.get("max"),
                )
                for p in c.get("props", [])
            )
            self.classes[c["name"]] = ClassInfo(
                name=c["name"],
                parent=c.get("parent"),
                ancestors=tuple(c.get("ancestors", [])),
                visual=bool(c.get("visual")),
                container=bool(c.get("container")),
                abstract=bool(c.get("abstract")),
                palette=c.get("palette"),
                props=props,
                events={e["name"]: e.get("params", "Sender: $Self") for e in c.get("events", [])},
            )
        self.digest = sha256_hex(json.dumps(data, sort_keys=True))

    def get(self, name: str) -> ClassInfo | None:
        return self.classes.get(name)


@lru_cache(maxsize=4)
def _load_manifest(path: str, mtime: float) -> RuntimeManifest:  # noqa: ARG001 - mtime busts the cache
    return RuntimeManifest(json.loads(Path(path).read_text("utf-8")))


def load_manifest(path: Path | None = None) -> RuntimeManifest:
    p = (path or settings.runtime_dir / "vcl.manifest.json").resolve()
    if not p.is_file():
        raise RuntimeError("runtime/vcl.manifest.json bulunamadı — 'npm run build:runtime' çalıştırın")
    return _load_manifest(str(p), p.stat().st_mtime)


# --------------------------------------------------------------------------- canonical


def _canonical_node(node: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {"class": node.get("class"), "name": node.get("name")}
    props = node.get("props") or {}
    out["props"] = {k: props[k] for k in sorted(props)}
    events = node.get("events") or {}
    if events:
        out["events"] = {k: events[k] for k in sorted(events)}
    children = node.get("children") or []
    if children:
        out["children"] = [_canonical_node(c) for c in children]
    return out


def canonical_design(doc: dict[str, Any]) -> dict[str, Any]:
    """Stable key order (class, name, props, events, children); props/events sorted."""
    if not isinstance(doc, dict) or not isinstance(doc.get("form"), dict):
        raise DesignError("tasarım belgesi 'form' düğümü içermiyor")
    return {"format": DESIGN_FORMAT, "version": DESIGN_VERSION, "form": _canonical_node(doc["form"])}


def dumps_design(doc: dict[str, Any]) -> str:
    return json.dumps(canonical_design(doc), indent=2, ensure_ascii=False) + "\n"


def design_hash(doc: dict[str, Any]) -> str:
    return sha256_hex(dumps_design(doc))


def new_form_design(name: str, caption: str | None = None, client_width: int = 624, client_height: int = 441) -> dict[str, Any]:
    return canonical_design(
        {
            "form": {
                "class": "TForm",
                "name": name,
                "props": {"Caption": caption if caption is not None else name, "ClientWidth": client_width, "ClientHeight": client_height},
                "children": [],
            }
        }
    )


def new_unit_code(form_name: str) -> str:
    return (
        f"// {form_name}.ts — {form_name} formunun kod birimi (unit).\n"
        f"// Olay işleyicileri {form_name}.prototype üzerine tanımlanır; `this` formun kendisidir.\n"
        f"// Tasarımcıda bir olaya çift tıklayınca buraya otomatik iskelet (stub) eklenir.\n\n"
    )


# --------------------------------------------------------------------------- flatten


@dataclass
class FlatProp:
    name: str
    kind: str
    value: Any
    emit: str  # assign | font | strings | params


@dataclass
class FlatComponent:
    index: int
    name: str
    class_name: str
    var: str
    parent: str | None  # component name, "" for the form itself, None for non-visual
    visual: bool
    depth: int
    props: list[FlatProp] = field(default_factory=list)
    refs: list[tuple[str, str]] = field(default_factory=list)  # (prop, target component)
    events: list[tuple[str, str]] = field(default_factory=list)  # (event, handler)


@dataclass
class Statement:
    connection: str
    kind: str  # sql | table | proc
    text: str
    read_only: bool
    source: str


@dataclass
class FlatForm:
    name: str
    class_name: str  # TForm (runtime base)
    caption: str
    props: list[FlatProp]
    refs: list[tuple[str, str]]
    events: list[tuple[str, str]]
    components: list[FlatComponent]
    handlers: dict[str, str]  # handler -> TypeScript signature
    used_classes: list[str]
    statements: list[Statement]
    warnings: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)


class _Validator:
    def __init__(self, manifest: RuntimeManifest, warnings: list[str]):
        self.m = manifest
        self.warnings = warnings

    def warn(self, where: str, msg: str) -> None:
        self.warnings.append(f"{where}: {msg}")

    # value validators return (ok, normalised value)
    def check(self, where: str, info: PropInfo, value: Any) -> tuple[bool, Any]:
        kind = info.kind
        try:
            if kind in ("int", "modalresult"):
                if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
                    raise ValueError("tam sayı bekleniyor")
                iv = int(round(value))
                if info.minimum is not None and iv < info.minimum:
                    raise ValueError(f"en az {info.minimum:g} olmalı")
                if info.maximum is not None and iv > info.maximum:
                    raise ValueError(f"en fazla {info.maximum:g} olmalı")
                if abs(iv) > 10_000_000:
                    raise ValueError("değer aralık dışında")
                return True, iv
            if kind == "float":
                if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
                    raise ValueError("sayı bekleniyor")
                return True, float(value)
            if kind == "bool":
                if not isinstance(value, bool):
                    raise ValueError("true/false bekleniyor")
                return True, value
            if kind in ("enum", "cursor"):
                if not isinstance(value, str) or (info.values is not None and value not in info.values):
                    raise ValueError(f"geçersiz değer {value!r}")
                return True, value
            if kind == "set":
                if not isinstance(value, list) or not all(isinstance(v, str) for v in value):
                    raise ValueError("dizi bekleniyor")
                allowed = info.values or ()
                bad = [v for v in value if v not in allowed]
                if bad:
                    raise ValueError(f"geçersiz küme üyesi {bad!r}")
                return True, [v for v in allowed if v in value]  # canonical order, unique
            if kind == "color":
                if not isinstance(value, str) or not (value in self.m.colors or _COLOR_RE.match(value)):
                    raise ValueError(f"geçersiz renk {value!r}")
                return True, value
            if kind == "font":
                return True, self._font(value)
            if kind in ("strings", "sql"):
                if isinstance(value, str):
                    value = value.splitlines()
                if not isinstance(value, list) or not all(isinstance(v, str) for v in value):
                    raise ValueError("metin satırları (dizi) bekleniyor")
                if sum(len(v) for v in value) > MAX_STRING:
                    raise ValueError("metin çok uzun")
                return True, list(value)
            if kind == "params":
                return True, self._params(value)
            if kind == "columns":
                return True, self._columns(value)
            if kind == "image":
                if not isinstance(value, str) or len(value) > 2_000_000:
                    raise ValueError("resim kaynağı metin olmalı")
                v = value.strip()
                if v and not (_SAFE_DATA_IMAGE.match(v) or v.lower().startswith(("https:", "http:", "blob:")) or (not _UNSAFE_URL_SCHEME.match(v) and not v.startswith("//"))):
                    raise ValueError("güvensiz resim kaynağı")
                return True, v
            if kind in ("connection", "table", "procname", "datafield", "fieldlist", "fontname", "string", "text"):
                if not isinstance(value, str):
                    raise ValueError("metin bekleniyor")
                if len(value) > MAX_STRING:
                    raise ValueError("metin çok uzun")
                return True, value
        except ValueError as exc:
            self.warn(where, f"{info.name} — {exc}; özellik atlandı")
            return False, None
        self.warn(where, f"{info.name} — desteklenmeyen özellik türü {kind!r}")
        return False, None

    def _font(self, value: Any) -> dict[str, Any]:
        if not isinstance(value, dict):
            raise ValueError("yazı tipi nesnesi bekleniyor")
        extra = set(value) - {"Name", "Size", "Color", "Style"}
        if extra:
            raise ValueError(f"bilinmeyen yazı tipi alanları {sorted(extra)}")
        name = value.get("Name", "Segoe UI")
        size = value.get("Size", 9)
        color = value.get("Color", "clWindowText")
        style = value.get("Style", [])
        if not isinstance(name, str) or not _FONT_NAME_RE.match(name):
            raise ValueError("geçersiz yazı tipi adı")
        if isinstance(size, bool) or not isinstance(size, (int, float)) or not (1 <= size <= 400):
            raise ValueError("geçersiz punto")
        if not isinstance(color, str) or not (color in self.m.colors or _COLOR_RE.match(color)):
            raise ValueError("geçersiz yazı rengi")
        allowed = self.m.enums.get("TFontStyle", ())
        if not isinstance(style, list) or any(s not in allowed for s in style):
            raise ValueError("geçersiz yazı stili")
        return {"Name": name, "Size": size, "Color": color, "Style": sorted(set(style))}

    def _params(self, value: Any) -> list[dict[str, Any]]:
        if not isinstance(value, list):
            raise ValueError("parametre listesi bekleniyor")
        types = self.m.enums.get("TFieldType", ())
        out = []
        for p in value:
            if not isinstance(p, dict) or not isinstance(p.get("Name"), str) or not _PARAM_NAME_RE.match(p["Name"]):
                raise ValueError("geçersiz parametre")
            item: dict[str, Any] = {"Name": p["Name"], "DataType": p.get("DataType", "ftUnknown")}
            if item["DataType"] not in types:
                raise ValueError(f"geçersiz parametre tipi {item['DataType']!r}")
            if "Value" in p and p["Value"] is not None:
                if not isinstance(p["Value"], (str, int, float, bool)):
                    raise ValueError("parametre değeri skaler olmalı")
                item["Value"] = p["Value"]
            if p.get("ParamType") not in (None, "ptInput", "ptOutput", "ptInputOutput"):
                raise ValueError("geçersiz ParamType")
            if p.get("ParamType") not in (None, "ptInput"):
                item["ParamType"] = p["ParamType"]
            out.append(item)
        return out

    def _columns(self, value: Any) -> list[dict[str, Any]]:
        if not isinstance(value, list):
            raise ValueError("kolon listesi bekleniyor")
        aligns = self.m.enums.get("TAlignment", ())
        out = []
        for c in value:
            if not isinstance(c, dict) or not isinstance(c.get("FieldName"), str) or not c["FieldName"]:
                raise ValueError("kolonda FieldName zorunlu")
            item: dict[str, Any] = {"FieldName": c["FieldName"][:128]}
            if isinstance(c.get("Title"), str):
                item["Title"] = c["Title"][:256]
            if isinstance(c.get("Width"), int) and not isinstance(c.get("Width"), bool):
                item["Width"] = max(10, min(2000, c["Width"]))
            if c.get("Alignment") in aligns:
                item["Alignment"] = c["Alignment"]
            if isinstance(c.get("Visible"), bool):
                item["Visible"] = c["Visible"]
            if isinstance(c.get("DisplayFormat"), str) and re.fullmatch(r"[#0.,]{1,32}", c["DisplayFormat"]):
                item["DisplayFormat"] = c["DisplayFormat"]
            out.append(item)
        return out


_EMIT = {"font": "font", "strings": "strings", "sql": "strings", "params": "params"}


def _is_reserved_name(manifest: RuntimeManifest, name: str) -> bool:
    return name in manifest.reserved_members or name in RESERVED_IDENTIFIERS or name in manifest.exports


def flatten_design(
    doc: dict[str, Any],
    manifest: RuntimeManifest,
    *,
    form_names: tuple[str, ...] = (),
) -> FlatForm:
    """Validate a design and flatten its tree (pre-order: parents before children).

    Structural problems (unknown root, duplicate/invalid names) are *errors*; invalid
    property values are *warnings* and the property is skipped.
    """
    warnings: list[str] = []
    errors: list[str] = []
    v = _Validator(manifest, warnings)
    root = canonical_design(doc)["form"]

    form_name = root.get("name")
    if not isinstance(form_name, str) or not is_valid_identifier(form_name) or form_name in manifest.exports:
        raise DesignError(f"geçersiz form adı {form_name!r}")
    root_cls = manifest.get(root.get("class", ""))
    if root_cls is None or not root_cls.is_a("TCustomForm"):
        raise DesignError("kök bileşen bir TForm olmalı")

    names: dict[str, str] = {form_name.lower(): root_cls.name}
    nodes: list[tuple[dict[str, Any], ClassInfo, str | None, int]] = []

    def collect(children: list[Any], parent: str | None, parent_cls: ClassInfo, depth: int) -> None:
        if depth > MAX_DEPTH:
            errors.append(f"{parent}: iç içe geçme çok derin")
            return
        for child in children:
            if len(nodes) >= MAX_COMPONENTS:
                errors.append(f"en fazla {MAX_COMPONENTS} bileşen desteklenir")
                return
            if not isinstance(child, dict):
                errors.append("geçersiz bileşen düğümü")
                continue
            cname, klass = child.get("name"), child.get("class")
            info = manifest.get(klass) if isinstance(klass, str) else None
            if info is None or info.abstract or info.is_a("TCustomForm"):
                errors.append(f"{cname}: bilinmeyen veya kullanılamaz sınıf {klass!r}")
                continue
            if not isinstance(cname, str) or not is_valid_identifier(cname):
                errors.append(f"geçersiz bileşen adı {cname!r}")
                continue
            if _is_reserved_name(manifest, cname):
                errors.append(f"'{cname}' adı ayrılmış (form üyesi/çalışma zamanı adı); başka bir ad seçin")
                continue
            if cname.lower() in names:
                errors.append(f"'{cname}' adı birden çok kez kullanılmış")
                continue
            if info.visual and parent is not None and not parent_cls.container:
                errors.append(f"{cname}: {parent_cls.name} alt kontrol içeremez")
                continue
            names[cname.lower()] = info.name
            # non-visual components never have a Parent (owned by the form only)
            nodes.append((child, info, (parent or "") if info.visual else None, depth))
            kids = child.get("children") or []
            if kids:
                if not info.container:
                    errors.append(f"{cname}: {info.name} alt bileşen içeremez")
                else:
                    collect(kids, cname, info, depth + 1)

    collect(root.get("children") or [], None, root_cls, 1)

    lookup = {n.lower(): n for n in [form_name] + [c.get("name") for c, *_ in nodes]}
    handlers: dict[str, str] = {}
    handler_conflicts: set[str] = set()

    def props_of(where: str, node: dict[str, Any], info: ClassInfo) -> tuple[list[FlatProp], list[tuple[str, str]]]:
        raw = node.get("props") or {}
        known = {p.name for p in info.props}
        for key in raw:
            if key not in known:
                v.warn(where, f"bilinmeyen özellik '{key}' atlandı")
        flat: list[FlatProp] = []
        refs: list[tuple[str, str]] = []
        for p in info.props:  # RTTI order == runtime LoadDesign order
            if p.name not in raw or not p.stored or p.design_only or p.name == "Name":
                continue
            value = raw[p.name]
            if p.kind == "component":
                if value in (None, ""):
                    continue
                target = lookup.get(str(value).lower()) if isinstance(value, str) else None
                if target is None:
                    v.warn(where, f"{p.name} — '{value}' bileşeni bulunamadı")
                    continue
                target_cls = manifest.get(names[target.lower()])
                if p.ref_class and (target_cls is None or not target_cls.is_a(p.ref_class)):
                    v.warn(where, f"{p.name} — {target} bir {p.ref_class} değil")
                    continue
                refs.append((p.name, target))
                continue
            ok, norm = v.check(where, p, value)
            if ok:
                flat.append(FlatProp(p.name, p.kind, norm, _EMIT.get(p.kind, "assign")))
        return flat, refs

    def events_of(where: str, node: dict[str, Any], info: ClassInfo, self_class: str) -> list[tuple[str, str]]:
        out = []
        for ev, handler in (node.get("events") or {}).items():
            if ev not in info.events:
                v.warn(where, f"bilinmeyen olay '{ev}' atlandı")
                continue
            if not isinstance(handler, str) or not handler:
                continue
            if not is_valid_identifier(handler) or _is_reserved_name(manifest, handler) or handler.lower() in names:
                errors.append(f"{where}.{ev}: geçersiz olay işleyici adı {handler!r}")
                continue
            sig = info.events[ev].replace("$Self", self_class)
            if handlers.get(handler, sig) != sig:
                handler_conflicts.add(handler)
            handlers.setdefault(handler, sig)
            out.append((ev, handler))
        return out

    form_props, form_refs = props_of(form_name, root, root_cls)
    form_events = events_of(form_name, root, root_cls, form_name)

    components: list[FlatComponent] = []
    used = {root_cls.name}
    statements: list[Statement] = []
    for index, (node, info, parent, depth) in enumerate(nodes, start=1):
        cname = node["name"]
        props, refs = props_of(cname, node, info)
        comp = FlatComponent(
            index=index,
            name=cname,
            class_name=info.name,
            var=f"c{index}",
            parent=parent,
            visual=info.visual,
            depth=depth,
            props=props,
            refs=refs,
            events=events_of(cname, node, info, info.name),
        )
        components.append(comp)
        used.add(info.name)

    for h in handler_conflicts:
        handlers[h] = "Sender: TObject, e?: any"

    # SQL / table / procedure allow-list for the runtime DB proxy
    by_name = {c.name: c for c in components}

    def conn_name_of(comp: FlatComponent) -> str | None:
        target = dict(comp.refs).get("Connection")
        conn = by_name.get(target) if target else None
        if conn is None:
            return None
        for p in conn.props:
            if p.name == "ConnectionDefName" and p.value:
                return p.value
        return None

    for comp in components:
        info = manifest.get(comp.class_name)
        if info is None or not info.is_a("TDataSet"):
            continue
        conn = conn_name_of(comp)
        values = {p.name: p.value for p in comp.props}
        source = f"{form_name}.{comp.name}"
        if info.is_a("TQuery"):
            sql = "\n".join(values.get("SQL") or []).strip()
            if sql and conn:
                statements.append(Statement(conn, "sql", sql, _is_select(sql), source))
            elif sql:
                v.warn(comp.name, "Connection atanmamış; sorgu çalışma zamanında yürütülemez")
        elif info.is_a("TTable"):
            table = str(values.get("TableName") or "").strip()
            if table and conn:
                statements.append(Statement(conn, "table", table, bool(values.get("ReadOnly")), source))
        elif info.is_a("TStoredProc"):
            proc = str(values.get("StoredProcName") or "").strip()
            if proc and conn:
                statements.append(Statement(conn, "proc", proc, False, source))

    known_forms = {n.lower() for n in form_names}
    for n in form_names:
        if n.lower() in names and n != form_name:
            errors.append(f"'{n}' hem form hem bileşen adı olarak kullanılmış")
    del known_forms

    caption = next((p.value for p in form_props if p.name == "Caption"), form_name)
    return FlatForm(
        name=form_name,
        class_name=root_cls.name,
        caption=str(caption),
        props=form_props,
        refs=form_refs,
        events=form_events,
        components=components,
        handlers=dict(sorted(handlers.items())),
        used_classes=sorted(used),
        statements=statements,
        warnings=warnings,
        errors=errors,
    )


def _is_select(sql: str) -> bool:
    head = re.sub(r"(--[^\n]*\n|/\*.*?\*/|\s)+", " ", sql, flags=re.S).strip().lower()
    return head.startswith(("select", "with"))
