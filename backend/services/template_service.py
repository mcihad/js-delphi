"""TemplateService — the only producer of output files.

Python never writes program code: it hands validated data (``FlatForm``) to fixed
Jinja2 templates. User supplied strings reach generated JavaScript/TypeScript only
through ``to_ts_literal`` which uses a *whitelist* escape: every character outside a
small safe set becomes a ``\\uXXXX`` escape, so quotes, backslashes, ``</script>``,
line separators (U+2028/2029) and control characters can never break out of a literal.
"""
from __future__ import annotations

import json
import math
from functools import lru_cache
from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader, StrictUndefined, select_autoescape

from backend.config import settings
from backend.security import is_valid_identifier, sha256_hex

# Characters that may appear verbatim inside a generated "…" literal.
_SAFE_CHARS = frozenset("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 _-.,:;!?()[]{}+*=%#@^~|$/")


def _escape_str(value: str) -> str:
    out: list[str] = ['"']
    for ch in value:
        if ch in _SAFE_CHARS:
            out.append(ch)
            continue
        code = ord(ch)
        if code > 0xFFFF:  # astral plane → surrogate pair
            code -= 0x10000
            out.append(f"\\u{0xD800 + (code >> 10):04x}\\u{0xDC00 + (code & 0x3FF):04x}")
        else:
            out.append(f"\\u{code:04x}")
    out.append('"')
    return "".join(out)


def to_ts_literal(value: Any, indent: int = 0) -> str:
    """Render a JSON-like Python value as a JS/TS literal with whitelist escaping."""
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, int):
        return str(value)
    if isinstance(value, float):
        if not math.isfinite(value):
            raise ValueError("NaN/Infinity cannot be emitted")
        return repr(value)
    if isinstance(value, str):
        return _escape_str(value)
    if isinstance(value, (list, tuple)):
        if not value:
            return "[]"
        return "[" + ", ".join(to_ts_literal(v) for v in value) + "]"
    if isinstance(value, dict):
        if not value:
            return "{}"
        parts = []
        for k, v in value.items():
            if not isinstance(k, str):
                raise ValueError("object keys must be strings")
            key = k if is_valid_identifier(k) else _escape_str(k)
            parts.append(f"{key}: {to_ts_literal(v)}")
        return "{ " + ", ".join(parts) + " }"
    raise TypeError(f"cannot emit {type(value).__name__} as a literal")


def ident(value: str) -> str:
    """Pass through an identifier after re-validating it (defence in depth)."""
    if not isinstance(value, str) or not (is_valid_identifier(value) or value in {"Application"}):
        raise ValueError(f"not an identifier: {value!r}")
    return value


def wrap_list(items: list[str], width: int = 96, indent: str = "  ") -> str:
    lines: list[str] = []
    line = ""
    for i, item in enumerate(items):
        piece = item + ("," if i < len(items) - 1 else "")
        if line and len(line) + 1 + len(piece) > width:
            lines.append(indent + line)
            line = piece
        else:
            line = f"{line} {piece}" if line else piece
    if line:
        lines.append(indent + line)
    return "\n".join(lines)


class TemplateService:
    def __init__(self, directory: Path | None = None):
        self.directory = (directory or settings.templates_dir).resolve()
        self.env = Environment(
            loader=FileSystemLoader(str(self.directory)),
            autoescape=select_autoescape(enabled_extensions=("html.j2",), default_for_string=False, default=False),
            undefined=StrictUndefined,
            keep_trailing_newline=True,
            trim_blocks=True,
            lstrip_blocks=True,
        )
        self.env.filters["to_ts_literal"] = to_ts_literal
        self.env.filters["ident"] = ident
        self.env.filters["wrap_list"] = wrap_list
        self.env.filters["tojson_pretty"] = lambda v: json.dumps(v, indent=2, ensure_ascii=False)

    def render(self, name: str, **context: Any) -> str:
        return self.env.get_template(name).render(**context)

    def templates_hash(self) -> str:
        return _templates_hash(str(self.directory), _dir_mtime(self.directory))


def _dir_mtime(directory: Path) -> float:
    return max((p.stat().st_mtime for p in directory.glob("*.j2")), default=0.0)


@lru_cache(maxsize=4)
def _templates_hash(directory: str, mtime: float) -> str:  # noqa: ARG001 - mtime busts the cache
    parts = []
    for p in sorted(Path(directory).glob("*.j2")):
        parts.append(p.name)
        parts.append(p.read_text("utf-8"))
    return sha256_hex(*parts)


templates = TemplateService()
