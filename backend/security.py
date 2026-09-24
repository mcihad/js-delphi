"""Security primitives: AES-256-GCM secret box, password hashing, signed tokens,
path locking and identifier validation.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import time
from pathlib import Path
from typing import Any

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from backend.config import settings

# ---------------------------------------------------------------------------
# helpers


def b64u_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def b64u_decode(data: str) -> bytes:
    pad = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + pad)


def sha256_hex(*parts: str | bytes) -> str:
    h = hashlib.sha256()
    for i, part in enumerate(parts):
        if i:
            h.update(b"\x00")
        h.update(part.encode("utf-8") if isinstance(part, str) else part)
    return h.hexdigest()


# ---------------------------------------------------------------------------
# master key + AES-256-GCM


def _load_master_key() -> bytes:
    if settings.master_key_b64:
        key = b64u_decode(settings.master_key_b64.strip())
        if len(key) != 32:
            raise RuntimeError("JSD_MASTER_KEY must decode to exactly 32 bytes")
        return key
    path = settings.master_key_file
    if path.exists():
        key = b64u_decode(path.read_text("ascii").strip())
        if len(key) != 32:
            raise RuntimeError(f"{path} does not contain a 32 byte key")
        return key
    settings.ensure_dirs()
    key = AESGCM.generate_key(bit_length=256)
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w", encoding="ascii") as fh:
        fh.write(b64u_encode(key))
    return key


class SecretBox:
    """AES-256-GCM authenticated encryption.

    Ciphertext format: ``v1.<key-id>.<b64u(nonce|ciphertext|tag)>``. The associated
    data (AAD) binds a ciphertext to its owner row (e.g. the connection id), so an
    attacker with DB write access cannot swap encrypted blobs between rows.
    """

    VERSION = "v1"

    def __init__(self, key: bytes):
        self._aead = AESGCM(key)
        self.key_id = hashlib.sha256(key).hexdigest()[:8]

    def encrypt(self, plaintext: str | bytes, aad: str) -> str:
        data = plaintext.encode("utf-8") if isinstance(plaintext, str) else plaintext
        nonce = os.urandom(12)
        ct = self._aead.encrypt(nonce, data, aad.encode("utf-8"))
        return f"{self.VERSION}.{self.key_id}.{b64u_encode(nonce + ct)}"

    def decrypt(self, token: str, aad: str) -> bytes:
        try:
            version, key_id, payload = token.split(".", 2)
        except ValueError as exc:  # pragma: no cover - defensive
            raise ValueError("invalid ciphertext") from exc
        if version != self.VERSION or key_id != self.key_id:
            raise ValueError("ciphertext was produced with another key")
        raw = b64u_decode(payload)
        return self._aead.decrypt(raw[:12], raw[12:], aad.encode("utf-8"))

    def encrypt_json(self, value: Any, aad: str) -> str:
        return self.encrypt(json.dumps(value, separators=(",", ":"), sort_keys=True), aad)

    def decrypt_json(self, token: str, aad: str) -> Any:
        return json.loads(self.decrypt(token, aad).decode("utf-8"))


_MASTER_KEY = _load_master_key()
secret_box = SecretBox(_MASTER_KEY)
# Token signing key is derived from the master key (HKDF-like domain separation).
_SIGNING_KEY = hmac.new(_MASTER_KEY, b"jsd-token-signing-v1", hashlib.sha256).digest()


# ---------------------------------------------------------------------------
# passwords (PBKDF2-HMAC-SHA256, stdlib only)

_PBKDF2_ITERATIONS = 310_000


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, _PBKDF2_ITERATIONS)
    return f"pbkdf2_sha256${_PBKDF2_ITERATIONS}${b64u_encode(salt)}${b64u_encode(dk)}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algo, iterations, salt, digest = stored.split("$")
        if algo != "pbkdf2_sha256":
            return False
        dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), b64u_decode(salt), int(iterations))
        return hmac.compare_digest(dk, b64u_decode(digest))
    except (ValueError, TypeError):
        return False


# ---------------------------------------------------------------------------
# signed tokens (compact, HMAC-SHA256)


def sign_token(payload: dict[str, Any], ttl_seconds: int) -> str:
    body = dict(payload)
    body["exp"] = int(time.time()) + int(ttl_seconds)
    body["n"] = secrets.token_hex(4)
    raw = b64u_encode(json.dumps(body, separators=(",", ":"), sort_keys=True).encode("utf-8"))
    sig = b64u_encode(hmac.new(_SIGNING_KEY, raw.encode("ascii"), hashlib.sha256).digest()[:24])
    return f"{raw}.{sig}"


def verify_token(token: str, typ: str) -> dict[str, Any] | None:
    try:
        raw, sig = token.split(".", 1)
        expected = b64u_encode(hmac.new(_SIGNING_KEY, raw.encode("ascii"), hashlib.sha256).digest()[:24])
        if not hmac.compare_digest(sig, expected):
            return None
        body = json.loads(b64u_decode(raw))
    except (ValueError, TypeError, json.JSONDecodeError):
        return None
    if body.get("typ") != typ or int(body.get("exp", 0)) < int(time.time()):
        return None
    return body


# ---------------------------------------------------------------------------
# path locking


class PathSecurityError(ValueError):
    pass


def lock_path(root: Path, *parts: str) -> Path:
    """Join ``parts`` under ``root`` and guarantee the result stays inside ``root``.

    ``Path.resolve`` normalises ``..`` segments and symlinks before the containment check.
    """
    root_resolved = root.resolve()
    candidate = root_resolved.joinpath(*parts).resolve()
    if candidate != root_resolved and not candidate.is_relative_to(root_resolved):
        raise PathSecurityError(f"path escapes project root: {'/'.join(parts)!r}")
    return candidate


# ---------------------------------------------------------------------------
# identifiers

IDENT_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]{0,63}$")

# JS/TS reserved words + names that would shadow runtime globals in generated code.
RESERVED_IDENTIFIERS = frozenset(
    """
    break case catch class const continue debugger default delete do else enum export extends
    false finally for function if import in instanceof new null return super switch this throw
    true try typeof var void while with yield let static implements interface package private
    protected public await async arguments eval undefined NaN Infinity globalThis window document
    constructor prototype __proto__ Object Function Array String Number Boolean Symbol Promise
    Application Screen Self Sender
    """.split()
)


def is_valid_identifier(name: str) -> bool:
    return bool(IDENT_RE.match(name or "")) and name not in RESERVED_IDENTIFIERS
