"""Error types of the data access layer.

Every error carries an HTTP status code and a Turkish, client-safe message (never a
password, a connection URL or raw driver internals). They subclass FastAPI's
``HTTPException`` so that any router calling the data services gets the right status
code without an extra exception handler.
"""
from __future__ import annotations

import re
from collections.abc import Iterable
from urllib.parse import quote, quote_plus

from fastapi import HTTPException

MAX_ERROR_MESSAGE = 400

_SECRET_ASSIGNMENT_RE = re.compile(r"(?i)\b(password|passwd|pwd)\s*=\s*('[^']*'|\"[^\"]*\"|[^\s;,&)]+)")
_URL_USERINFO_RE = re.compile(r"(?i)\b([a-z][a-z0-9+.\-]*://)[^\s/@]+@")
_SQLALCHEMY_SUFFIX_RE = re.compile(r"\(Background on this error at:[^)]*\)")


class DataError(HTTPException):
    """Base class: a request the data layer refuses or could not complete (400)."""

    default_status = 400

    def __init__(self, message: str, status_code: int | None = None) -> None:
        super().__init__(status_code=status_code or self.default_status, detail=message)

    @property
    def message(self) -> str:
        return str(self.detail)


class DataNotFound(DataError):
    default_status = 404


class DataForbidden(DataError):
    default_status = 403


class DataConflict(DataError):
    default_status = 409


class DataUnavailable(DataError):
    """The target database cannot be reached (connect/login failure)."""

    default_status = 502


class DataTimeout(DataError):
    """The statement exceeded the configured execution time."""

    default_status = 504


def sanitize_error(exc: BaseException, secrets: Iterable[str | None] = ()) -> str:
    """Client-safe, single-line text of a driver/SQLAlchemy exception.

    Uses the DBAPI exception when available (SQLAlchemy's own text appends the SQL and
    its parameters), masks the given secrets (plain and URL-encoded), ``password=...``
    assignments and URL user-info, and truncates the result.
    """
    orig = getattr(exc, "orig", None)
    source = orig if isinstance(orig, BaseException) else exc
    text = _exception_text(source)
    text = text.split("[SQL:", 1)[0]
    text = _SQLALCHEMY_SUFFIX_RE.sub("", text)
    for secret in secrets:
        if not secret:
            continue
        for variant in {secret, quote(secret, safe=""), quote_plus(secret)}:
            text = text.replace(variant, "***")
    text = _SECRET_ASSIGNMENT_RE.sub(lambda m: f"{m.group(1)}=***", text)
    text = _URL_USERINFO_RE.sub(lambda m: f"{m.group(1)}***@", text)
    text = " ".join(text.split())
    if len(text) > MAX_ERROR_MESSAGE:
        text = text[: MAX_ERROR_MESSAGE - 1] + "…"
    return text or type(source).__name__


def _exception_text(exc: BaseException) -> str:
    """Readable text of an exception; handles ``(code, message)`` style DBAPI errors."""
    args = getattr(exc, "args", ())
    if len(args) >= 2 and isinstance(args[0], int) and isinstance(args[1], (str, bytes)):
        message = args[1].decode("utf-8", "replace") if isinstance(args[1], bytes) else args[1]
        return f"{message} ({args[0]})"
    if len(args) == 1 and isinstance(args[0], bytes):
        return args[0].decode("utf-8", "replace")
    return str(exc)
