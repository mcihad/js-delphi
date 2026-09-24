"""Optional MongoDB adapter (pymongo).

Queries are JSON *find specs* instead of SQL::

    {"collection": "musteriler", "filter": {"sehir": {"$param": "sehir"}},
     "projection": {"ad": 1}, "sort": [["ad", 1]], "limit": 50}

``{"$param": "name"}`` placeholders are replaced by bound parameter values (values are
data, never operators). Server side JavaScript operators are rejected everywhere.
"""
from __future__ import annotations

import json
import time
from collections.abc import Mapping
from typing import Any

from backend.services.data.adapters.base import (
    Adapter,
    ConnectionConfig,
    QueryResult,
    TableRequest,
    elapsed_ms,
    field_type_from_value,
    serialize_value,
)
from backend.services.data.errors import DataError, DataNotFound, DataUnavailable, sanitize_error

FORBIDDEN_OPERATORS = frozenset({"$where", "$function", "$accumulator", "$eval", "$expr"})
SAMPLE_SIZE = 50
MAX_SPEC_DEPTH = 20


def _check(value: Any, depth: int = 0) -> None:
    if depth > MAX_SPEC_DEPTH:
        raise DataError("Sorgu belgesi çok derin")
    if isinstance(value, Mapping):
        for key, item in value.items():
            if not isinstance(key, str):
                raise DataError("Alan adları metin olmalı")
            if key in FORBIDDEN_OPERATORS:
                raise DataError(f"'{key}' operatörüne izin verilmiyor")
            _check(item, depth + 1)
    elif isinstance(value, list):
        for item in value:
            _check(item, depth + 1)


def _bind(value: Any, params: Mapping[str, Any]) -> Any:
    """Replace {"$param": "name"} with the parameter *value* (always data)."""
    if isinstance(value, Mapping):
        if set(value) == {"$param"}:
            name = value["$param"]
            if name not in params:
                raise DataError(f"Eksik parametre: {name}")
            bound = params[name]
            if isinstance(bound, (dict, list)):
                raise DataError("Parametre değerleri skaler olmalı")
            return bound
        return {k: _bind(v, params) for k, v in value.items()}
    if isinstance(value, list):
        return [_bind(v, params) for v in value]
    return value


def param_names(spec: Any) -> list[str]:
    names: list[str] = []

    def walk(v: Any) -> None:
        if isinstance(v, Mapping):
            if set(v) == {"$param"} and isinstance(v["$param"], str):
                if v["$param"] not in names:
                    names.append(v["$param"])
                return
            for item in v.values():
                walk(item)
        elif isinstance(v, list):
            for item in v:
                walk(item)

    walk(spec)
    return names


def parse_find_spec(text: str) -> dict[str, Any]:
    try:
        spec = json.loads(text)
    except json.JSONDecodeError as exc:
        raise DataError("MongoDB sorgusu geçerli bir JSON find belgesi olmalı") from exc
    if not isinstance(spec, dict) or not isinstance(spec.get("collection"), str) or not spec["collection"]:
        raise DataError("Sorgu belgesinde 'collection' zorunlu")
    extra = set(spec) - {"collection", "filter", "projection", "sort", "limit", "skip"}
    if extra:
        raise DataError(f"Bilinmeyen sorgu alanları: {', '.join(sorted(extra))}")
    _check(spec)
    return spec


class MongoAdapter(Adapter):
    family = "mongo"

    def __init__(self, config: ConnectionConfig, *, read_only: bool, timeout_seconds: float):
        super().__init__("mongodb", read_only=read_only, timeout_seconds=timeout_seconds, secrets=config.secrets)
        import pymongo

        options = dict(config.options)
        srv = options.pop("srv", "").lower() in {"1", "true", "yes"}
        kwargs: dict[str, Any] = {
            "host": config.host,
            "serverSelectionTimeoutMS": 8000,
            "connectTimeoutMS": 8000,
            "socketTimeoutMS": int(timeout_seconds * 1000),
            "appname": "JS-Delphi",
        }
        if not srv and config.port:
            kwargs["port"] = config.port
        if config.username:
            kwargs["username"] = config.username
            kwargs["password"] = config.password
        for key, value in options.items():
            kwargs[key] = value.lower() == "true" if value.lower() in {"true", "false"} else value
        if srv:
            kwargs["host"] = f"mongodb+srv://{config.host}"
        self.client = pymongo.MongoClient(**kwargs)
        self.database = config.database or "test"

    @property
    def db(self):
        return self.client[self.database]

    def _collection(self, name: str):
        if name not in self.db.list_collection_names():
            raise DataNotFound(f"Koleksiyon bulunamadı: {name}")
        return self.db[name]

    def _guard(self, fn):
        try:
            return fn()
        except DataError:
            raise
        except Exception as exc:  # noqa: BLE001 - pymongo errors
            raise DataUnavailable(f"MongoDB hatası: {sanitize_error(exc, self._secrets)}") from exc

    def test(self) -> str:
        info = self._guard(lambda: self.client.server_info())
        return f"MongoDB {info.get('version', '?')}"

    def introspect(self) -> dict[str, Any]:
        def run() -> dict[str, Any]:
            tables = []
            for name in sorted(self.db.list_collection_names()):
                fields: dict[str, str] = {}
                for doc in self.db[name].find({}, limit=SAMPLE_SIZE):
                    for key, value in doc.items():
                        if key not in fields or fields[key] == "ftUnknown":
                            fields[key] = "ftString" if key == "_id" else field_type_from_value(value)
                columns = [
                    {"name": k, "type": "", "field_type": t, "nullable": k != "_id", "default": None, "primary_key": k == "_id", "autoincrement": k == "_id"}
                    for k, t in fields.items()
                ]
                tables.append({"name": name, "schema": self.database, "kind": "table", "columns": columns, "primary_key": ["_id"], "foreign_keys": [], "indexes": []})
            return {"driver": "mongodb", "default_schema": self.database, "tables": tables, "procedures": [], "truncated": False}

        return self._guard(run)

    def execute(self, statement: str, params: Mapping[str, Any], *, limit: int, offset: int, mode: str, kind: str) -> QueryResult:
        if mode != "query":
            raise DataError("MongoDB için yalnızca sorgu (find) desteklenir; değişiklikler tablo API'si ile yapılır")
        spec = parse_find_spec(statement)
        started = time.perf_counter()

        def run() -> QueryResult:
            coll = self._collection(spec["collection"])
            cursor = coll.find(_bind(spec.get("filter") or {}, params), spec.get("projection"))
            if spec.get("sort"):
                cursor = cursor.sort([(str(f), int(d)) for f, d in spec["sort"]])
            skip = int(spec.get("skip") or 0) + offset
            cursor = cursor.skip(skip).limit(min(int(spec.get("limit") or limit), limit) + 1)
            docs = list(cursor)
            truncated = len(docs) > limit
            docs = docs[:limit]
            names: list[str] = []
            for d in docs:
                for k in d:
                    if k not in names:
                        names.append(k)
            rows = [[serialize_value(str(d.get(n)) if n == "_id" else d.get(n)) for n in names] for d in docs]
            columns = [{"name": n, "type": "", "field_type": "ftString" if n == "_id" else field_type_from_value(next((d.get(n) for d in docs if d.get(n) is not None), None))} for n in names]
            return QueryResult(columns=columns, rows=rows, truncated=truncated, elapsed_ms=elapsed_ms(started))

        return self._guard(run)

    def table_op(self, request: TableRequest, *, limit: int) -> dict[str, Any]:
        from bson import ObjectId

        def oid(value: Any) -> Any:
            return ObjectId(value) if isinstance(value, str) and ObjectId.is_valid(value) else value

        started = time.perf_counter()

        def run() -> dict[str, Any]:
            coll = self._collection(request.table)
            if request.op == "select":
                where = {k: (oid(v) if k == "_id" else v) for k, v in (request.where or {}).items()}
                projection = {c: 1 for c in request.columns} if request.columns else None
                cursor = coll.find(where, projection).skip(request.offset).limit(limit + 1)
                if request.order_by:
                    cursor = cursor.sort([(o.column, -1 if o.desc else 1) for o in request.order_by])
                docs = list(cursor)
                truncated = len(docs) > limit
                docs = docs[:limit]
                names = ["_id", *sorted({k for d in docs for k in d if k != "_id"})]
                result = QueryResult(
                    columns=[{"name": n, "type": "", "field_type": "ftString" if n == "_id" else field_type_from_value(next((d.get(n) for d in docs if d.get(n) is not None), None))} for n in names],
                    rows=[[str(d["_id"]) if n == "_id" else serialize_value(d.get(n)) for n in names] for d in docs],
                    truncated=truncated,
                    elapsed_ms=elapsed_ms(started),
                ).to_dict()
                result["primary_key"] = ["_id"]
                return result
            if request.op == "insert":
                values = {k: v for k, v in (request.values or {}).items() if k != "_id" and not k.startswith("$")}
                res = coll.insert_one(values)
                return {"rows_affected": 1, "inserted_primary_key": {"_id": str(res.inserted_id)}, "elapsed_ms": elapsed_ms(started)}
            key = request.key or {}
            if "_id" not in key:
                raise DataError("Güncelleme ve silme için _id anahtarı zorunlu")
            filt = {"_id": oid(key["_id"])}
            if request.op == "update":
                values = {k: v for k, v in (request.values or {}).items() if k != "_id" and not k.startswith("$")}
                if not values:
                    raise DataError("Güncellenecek değer belirtilmedi")
                res = coll.update_one(filt, {"$set": values})
                return {"rows_affected": res.modified_count, "elapsed_ms": elapsed_ms(started)}
            res = coll.delete_one(filt)
            return {"rows_affected": res.deleted_count, "elapsed_ms": elapsed_ms(started)}

        return self._guard(run)

    def call_procedure(self, name: str, params: Mapping[str, Any], *, limit: int) -> QueryResult:
        raise DataError("MongoDB saklı yordam desteklemiyor")

    def dispose(self) -> None:
        self.client.close()
