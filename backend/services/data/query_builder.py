"""Visual query builder: JSON spec → parameterised SQL (SQLAlchemy Core).

Every table and column is resolved against the reflected schema, identifiers are
quoted by the target dialect and every literal becomes a bind parameter, so the
generated text (``:name`` placeholders, ready for ``TQuery.SQL``) never embeds values.
"""
from __future__ import annotations

import re
from typing import Any, Literal, Union

import sqlalchemy as sa
from pydantic import BaseModel, ConfigDict, Field

from backend.services.data.adapters.base import Scalar
from backend.services.data.adapters.sql import SqlAdapter, find_column
from backend.services.data.errors import DataError

_NAME_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]{0,63}$")
_LABEL_RE = re.compile(r"^[^\x00-\x1f\"`\[\]]{1,64}$")

CompareOp = Literal["=", "<>", "<", "<=", ">", ">=", "like", "not like", "is null", "is not null", "in"]


class JoinOn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    left: str
    op: Literal["=", "<>", "<", "<=", ">", ">="] = "="
    right: str


class JoinSpec(BaseModel):
    model_config = ConfigDict(extra="forbid")
    type: Literal["inner", "left", "right", "full"] = "inner"
    table: str
    alias: str | None = None
    on: list[JoinOn] = Field(min_length=1)


class SelectColumn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    expr: str
    alias: str | None = None
    agg: Literal["count", "sum", "avg", "min", "max"] | None = None


class Condition(BaseModel):
    model_config = ConfigDict(extra="forbid")
    left: str
    op: CompareOp = "="
    param: str | None = None
    value: Union[Scalar, list[Scalar]] = None


class ConditionGroup(BaseModel):
    model_config = ConfigDict(extra="forbid")
    op: Literal["and", "or"] = "and"
    items: list[Union["ConditionGroup", Condition]] = Field(default_factory=list)


class OrderSpec(BaseModel):
    model_config = ConfigDict(extra="forbid")
    expr: str
    dir: Literal["asc", "desc"] = "asc"


class ValueSpec(BaseModel):
    model_config = ConfigDict(extra="forbid")
    param: str | None = None
    value: Scalar = None


class QuerySpec(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["select", "insert", "update", "delete"] = "select"
    table: str
    alias: str | None = None
    joins: list[JoinSpec] = Field(default_factory=list, max_length=16)
    columns: list[SelectColumn] = Field(default_factory=list, max_length=200)
    where: ConditionGroup | None = None
    group_by: list[str] = Field(default_factory=list)
    order_by: list[OrderSpec] = Field(default_factory=list)
    limit: int | None = Field(default=None, ge=1, le=100_000)
    offset: int | None = Field(default=None, ge=0)
    distinct: bool = False
    values: dict[str, ValueSpec] = Field(default_factory=dict)


ConditionGroup.model_rebuild()


class _Builder:
    def __init__(self, adapter: SqlAdapter, spec: QuerySpec):
        self.adapter = adapter
        self.spec = spec
        self.sources: dict[str, sa.FromClause] = {}
        self.order: list[str] = []
        self.params: dict[str, Any] = {}
        self.counter = 0
        self.reserved: set[str] = set()

    # ------------------------------------------------------------ sources
    def add_source(self, table_name: str, alias: str | None) -> sa.FromClause:
        table = self.adapter.get_table(table_name)
        name = alias or table.name
        if alias and not _NAME_RE.match(alias):
            raise DataError(f"Geçersiz takma ad: {alias}")
        if name.lower() in self.sources:
            raise DataError(f"'{name}' takma adı birden çok kez kullanıldı")
        source: sa.FromClause = table.alias(alias) if alias and alias != table.name else table
        self.sources[name.lower()] = source
        self.order.append(name.lower())
        return source

    def column(self, ref: str) -> sa.ColumnElement[Any]:
        ref = (ref or "").strip()
        if "." in ref:
            src, _, col = ref.rpartition(".")
            source = self.sources.get(src.lower())
            if source is None:
                raise DataError(f"Bilinmeyen tablo/takma ad: {src}")
            return find_column(source, col)
        found = []
        for key in self.order:
            try:
                found.append(find_column(self.sources[key], ref))
            except DataError:
                continue
        if not found:
            raise DataError(f"Bilinmeyen sütun: {ref}")
        if len(found) > 1:
            raise DataError(f"'{ref}' birden çok tabloda var; tablo.sütun biçiminde yazın")
        return found[0]

    # ------------------------------------------------------------- params
    def bind(self, value: Any = None, name: str | None = None) -> sa.BindParameter[Any]:
        if name:
            if not _NAME_RE.match(name):
                raise DataError(f"Geçersiz parametre adı: {name}")
            if name.lower() in self.reserved:
                name = f"p_{name}"
            self.params.setdefault(name, None)
            return sa.bindparam(name, value=None)
        while True:
            self.counter += 1
            auto = f"p{self.counter}"
            if auto not in self.params:
                break
        self.params[auto] = value
        return sa.bindparam(auto, value=value)

    # ---------------------------------------------------------- conditions
    def condition(self, c: Condition) -> sa.ColumnElement[bool]:
        col = self.column(c.left)
        op = c.op
        if op == "is null":
            return col.is_(None)
        if op == "is not null":
            return col.is_not(None)
        if op == "in":
            if c.param:
                raise DataError("IN için parametre yerine değer listesi verin")
            values = c.value if isinstance(c.value, list) else [c.value]
            if not values:
                raise DataError("IN listesi boş olamaz")
            return col.in_([self.bind(v) for v in values])
        if isinstance(c.value, list):
            raise DataError(f"'{op}' için tek değer bekleniyor")
        right = self.bind(name=c.param) if c.param else self.bind(c.value)
        return {
            "=": lambda: col == right,
            "<>": lambda: col != right,
            "<": lambda: col < right,
            "<=": lambda: col <= right,
            ">": lambda: col > right,
            ">=": lambda: col >= right,
            "like": lambda: col.like(right),
            "not like": lambda: col.not_like(right),
        }[op]()

    def group(self, g: ConditionGroup | None) -> sa.ColumnElement[bool] | None:
        if g is None or not g.items:
            return None
        parts = []
        for item in g.items:
            expr = self.group(item) if isinstance(item, ConditionGroup) else self.condition(item)
            if expr is not None:
                parts.append(expr)
        if not parts:
            return None
        return sa.and_(*parts) if g.op == "and" else sa.or_(*parts)

    # --------------------------------------------------------------- build
    def build(self) -> Any:
        s = self.spec
        if s.kind == "select":
            return self.build_select()
        if s.joins:
            raise DataError(f"{s.kind.upper()} için JOIN kullanılamaz")
        table = self.adapter.get_table(s.table)
        self.sources[table.name.lower()] = table
        self.order.append(table.name.lower())
        self.reserved = {c.name.lower() for c in table.c}
        if s.kind == "insert":
            if not s.values:
                raise DataError("INSERT için en az bir değer gerekli")
            return sa.insert(table).values({find_column(table, k).name: self.value(k, v) for k, v in s.values.items()})
        where = self.group(s.where)
        if where is None:
            raise DataError(f"{s.kind.upper()} için WHERE koşulu zorunlu (tüm satırları etkilememek için)")
        if s.kind == "update":
            if not s.values:
                raise DataError("UPDATE için en az bir değer gerekli")
            return sa.update(table).values({find_column(table, k).name: self.value(k, v) for k, v in s.values.items()}).where(where)
        return sa.delete(table).where(where)

    def value(self, column: str, v: ValueSpec) -> sa.BindParameter[Any]:
        if v.param:
            return self.bind(name=v.param)
        name = f"v_{column}" if _NAME_RE.match(f"v_{column}") else None
        if name and name not in self.params:
            self.params[name] = v.value
            return sa.bindparam(name, value=v.value)
        return self.bind(v.value)

    def build_select(self) -> Any:
        s = self.spec
        main = self.add_source(s.table, s.alias)
        joined: sa.FromClause = main
        for j in s.joins:
            if j.type == "right":
                raise DataError("RIGHT JOIN desteklenmiyor; tabloların sırasını değiştirip LEFT JOIN kullanın")
            target = self.add_source(j.table, j.alias)
            ops = {
                "=": lambda a, b: a == b, "<>": lambda a, b: a != b, "<": lambda a, b: a < b,
                "<=": lambda a, b: a <= b, ">": lambda a, b: a > b, ">=": lambda a, b: a >= b,
            }
            onclause = sa.and_(*[ops[o.op](self.column(o.left), self.column(o.right)) for o in j.on])
            joined = joined.join(target, onclause, isouter=j.type == "left", full=j.type == "full")
        columns: list[Any] = []
        for c in s.columns:
            if c.expr.strip() == "*" or c.expr.strip().endswith(".*"):
                src = c.expr.strip()[:-2] if c.expr.strip().endswith(".*") else None
                source = self.sources.get(src.lower()) if src else main
                if source is None:
                    raise DataError(f"Bilinmeyen tablo/takma ad: {src}")
                if c.agg == "count":
                    columns.append(sa.func.count().label(c.alias or "adet"))
                else:
                    columns.extend(source.c)
                continue
            expr: Any = self.column(c.expr)
            if c.agg:
                expr = getattr(sa.func, c.agg)(expr)
            if c.alias:
                if not _LABEL_RE.match(c.alias):
                    raise DataError(f"Geçersiz kolon başlığı: {c.alias}")
                expr = expr.label(c.alias)
            elif c.agg:
                expr = expr.label(f"{c.agg}_{self.column(c.expr).name}")
            columns.append(expr)
        stmt = sa.select(*(columns or [main])).select_from(joined)
        where = self.group(s.where)
        if where is not None:
            stmt = stmt.where(where)
        if s.group_by:
            stmt = stmt.group_by(*[self.column(g) for g in s.group_by])
        if s.order_by:
            order = []
            labels = {c.alias.lower(): c.alias for c in s.columns if c.alias}
            for o in s.order_by:
                key = o.expr.strip()
                target: Any = sa.literal_column(self.adapter.engine.dialect.identifier_preparer.quote(labels[key.lower()])) if key.lower() in labels else self.column(key)
                order.append(target.desc() if o.dir == "desc" else target.asc())
            stmt = stmt.order_by(*order)
        if s.distinct:
            stmt = stmt.distinct()
        if s.limit is not None:
            stmt = stmt.limit(sa.literal_column(str(int(s.limit))))
        if s.offset:
            stmt = stmt.offset(sa.literal_column(str(int(s.offset))))
        elif s.limit is not None and self.adapter.dialect_name == "sqlite":
            # SQLite always renders OFFSET after LIMIT; keep it literal (no stray bind param).
            stmt = stmt.offset(sa.literal_column("0"))
        return stmt


def compile_query(adapter: SqlAdapter, spec: QuerySpec) -> dict[str, Any]:
    """Compile a visual spec for the connection's dialect with ``:name`` placeholders."""
    builder = _Builder(adapter, spec)
    stmt = builder.build()
    dialect = type(adapter.engine.dialect)(paramstyle="named")
    try:
        compiled = stmt.compile(dialect=dialect)
    except sa.exc.CompileError as exc:
        raise DataError(f"Sorgu derlenemedi: {exc}") from exc
    params = [{"name": k, "value": builder.params.get(k)} for k in compiled.params]
    return {"sql": str(compiled).strip(), "params": params, "dialect": dialect.name, "kind": spec.kind}
