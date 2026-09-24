"""Lexical SQL analysis for the DB proxy and the build allow-list.

The functions here are pure (no database access) and are shared by the build (which
registers the SQL of TQuery components by digest) and the runtime DB proxy (which only
executes registered statements for generated apps).

Everything is based on ``sqlparse``. Because sqlparse is dialect agnostic, a few
constructs are lexed differently by sqlparse and by real database servers (nested block
comments, backslash escaped quotes, ``#`` comments, T-SQL ``]]`` escapes, MySQL
executable comments ...). Such differences could hide a second statement from the
single-statement check, so :func:`ensure_single_statement` rejects them when the target
dialect is known. The drivers add their own protection on top (see ``adapters.sql``).
"""
from __future__ import annotations

import re
from collections.abc import Iterator, Sequence

import sqlparse
from sqlparse import sql as S
from sqlparse import tokens as T

from backend.security import sha256_hex

__all__ = [
    "SqlSafetyError",
    "STATEMENT_KINDS",
    "classify_sql",
    "ensure_single_statement",
    "extract_param_names",
    "normalize_sql",
    "statement_digest",
    "to_text_clause_sql",
]

STATEMENT_KINDS = ("select", "insert", "update", "delete", "ddl", "other")


class SqlSafetyError(ValueError):
    """The SQL text violates a proxy rule. The message is Turkish and client safe."""


_MYSQL_DIALECTS = frozenset({"mysql", "mariadb"})
_WHITESPACE_RE = re.compile(r"\s+")
# Mirrors ``sqlalchemy.sql.compiler.BIND_PARAMS``: what text() renders as a bind parameter.
_SA_BIND_RE = re.compile(r"(?<![:\w\$\x5c]):([\w\$]+)(?![:\w\$])", re.UNICODE)

_DDL_WORDS = frozenset({"CREATE", "DROP", "ALTER", "TRUNCATE", "RENAME", "COMMENT", "GRANT", "REVOKE"})
_DML_KINDS = {"INSERT": "insert", "REPLACE": "insert", "UPSERT": "insert", "UPDATE": "update", "DELETE": "delete"}
_MAIN_STATEMENT_WORDS = frozenset({"SELECT", "INSERT", "REPLACE", "UPSERT", "UPDATE", "DELETE", "MERGE"})
_SET_OPERATORS = frozenset(
    {"UNION", "UNION ALL", "UNION DISTINCT", "INTERSECT", "INTERSECT ALL", "EXCEPT", "EXCEPT ALL", "MINUS"}
)

# Reserved T-SQL words that start a statement. SQL Server executes semicolon-less batches
# ("SELECT 1 DELETE FROM t" is two statements), so these may only appear where the
# grammar of the leading statement allows them.
_TSQL_STATEMENT_WORDS = frozenset(
    """
    ALTER BACKUP BEGIN BREAK BULK CHECKPOINT CLOSE COMMIT CONTINUE CREATE DBCC DEALLOCATE
    DECLARE DELETE DENY DROP EXEC EXECUTE FETCH GOTO GRANT IF INSERT KILL MERGE OPEN PRINT
    RAISERROR READTEXT RECONFIGURE RESTORE RETURN REVERT REVOKE ROLLBACK SAVE SELECT SET
    SETUSER SHUTDOWN TRUNCATE UPDATE UPDATETEXT USE WAITFOR WHILE WRITETEXT
    """.split()
)


# --------------------------------------------------------------------------- digests


def normalize_sql(sql: str) -> str:
    """Canonical form used for allow-list digests.

    Comments are stripped, whitespace runs collapse to one space and trailing
    semicolons are dropped. Case is preserved.
    """
    formatted = sqlparse.format(sql or "", strip_comments=True)
    text = _WHITESPACE_RE.sub(" ", formatted).strip()
    while text.endswith(";"):
        text = text[:-1].rstrip()
    return text


def statement_digest(kind: str, text: str) -> str:
    """Digest stored in ``BuildStatement.digest`` for ``kind`` in sql | table | proc."""
    if kind == "sql":
        return sha256_hex(kind, normalize_sql(text))
    if kind in ("table", "proc"):
        return sha256_hex(kind, (text or "").strip().lower())
    raise ValueError(f"unknown statement kind: {kind!r}")


# --------------------------------------------------------------------------- token helpers


def _is_noise(token: S.Token) -> bool:
    """Whitespace, comments and statement separators."""
    return (
        token.is_whitespace
        or token.ttype in T.Comment
        or isinstance(token, S.Comment)
        or (token.ttype is T.Punctuation and token.value == ";")
    )


def _is_meaningful(statement: S.Statement) -> bool:
    return any(not _is_noise(leaf) for leaf in statement.flatten())


def _top_level(token_list: S.TokenList) -> Iterator[S.Token]:
    """Meaningful tokens at parenthesis depth 0; parentheses are yielded as opaque groups."""
    for token in token_list.tokens:
        if isinstance(token, S.Parenthesis):
            yield token
        elif token.is_group:
            yield from _top_level(token)
        elif not _is_noise(token):
            yield token


def _word(token: S.Token) -> str:
    """Upper-case value of an unquoted keyword or name ('' for anything else)."""
    if token.is_group or token.ttype is None:
        return ""
    value = token.value
    if token.ttype in T.Name.Placeholder or value[:1] in {"[", "`", '"'}:
        return ""
    if token.ttype in T.Keyword or token.ttype in T.Name:
        return " ".join(value.upper().split())
    return ""


def _head(token: S.Token) -> str:
    word = _word(token)
    return word.split(" ", 1)[0] if word else ""


def _parse(sql: str) -> tuple[S.Statement, ...]:
    return sqlparse.parse(sql or "")


def _first_meaningful_statement(sql: str) -> S.Statement | None:
    for statement in _parse(sql):
        if _is_meaningful(statement):
            return statement
    return None


# --------------------------------------------------------------------------- classification


def classify_sql(sql: str) -> str:
    """Kind of the first statement: select | insert | update | delete | ddl | other.

    ``WITH ... SELECT`` is a select unless a CTE body modifies data (PostgreSQL), in
    which case the modifying kind wins. ``SELECT ... INTO`` creates a table or writes a
    file and is therefore reported as ``ddl``. PRAGMA, EXPLAIN, SET, CALL, MERGE ... are
    ``other``.
    """
    statement = _first_meaningful_statement(sql)
    if statement is None:
        return "other"
    return _classify_tokens(list(_top_level(statement)))


def _classify_tokens(tokens: Sequence[S.Token]) -> str:
    if not tokens:
        return "other"
    first = tokens[0]
    if isinstance(first, S.Parenthesis):
        inner = [t for t in _top_level(first) if not (t.ttype is T.Punctuation and t.value in "()")]
        if _classify_tokens(inner) != "select":
            return "other"
        return "ddl" if _has_top_level_into(tokens) else "select"
    head = _head(first)
    if first.ttype in T.Keyword.CTE or head == "WITH":
        return _classify_cte(tokens)
    if head == "SELECT":
        return "ddl" if _has_top_level_into(tokens) else "select"
    if head in _DML_KINDS:
        return _DML_KINDS[head]
    if head in _DDL_WORDS:
        return "ddl"
    return "other"


def _has_top_level_into(tokens: Sequence[S.Token]) -> bool:
    return any(_head(token) == "INTO" for token in tokens)


def _classify_cte(tokens: Sequence[S.Token]) -> str:
    main_index = None
    for index, token in enumerate(tokens[1:], start=1):
        head = _head(token)
        if head in _DDL_WORDS:
            return "ddl"
        if head in _MAIN_STATEMENT_WORDS:
            main_index = index
            break
    if main_index is None:
        return "other"
    main = _head(tokens[main_index])
    if main == "SELECT":
        modifying = _dml_inside(tokens[:main_index])
        if modifying:
            return modifying
        return "ddl" if _has_top_level_into(tokens) else "select"
    return _DML_KINDS.get(main, "other")


def _dml_inside(tokens: Sequence[S.Token]) -> str | None:
    """Kind of the first data-modifying statement nested in CTE bodies (PostgreSQL)."""
    for token in tokens:
        if not isinstance(token, S.Parenthesis):
            continue
        for leaf in token.flatten():
            if leaf.ttype in T.Keyword.DML:
                word = leaf.value.upper()
                if word in _DML_KINDS:
                    return _DML_KINDS[word]
                if word == "MERGE":
                    return "other"
    return None


# --------------------------------------------------------------------------- single statement


def ensure_single_statement(sql: str, *, dialect: str | None = None) -> str:
    """Return the only statement of ``sql`` (trimmed, without trailing semicolon).

    Raises :class:`SqlSafetyError` for empty input, several statements or constructs
    that the target ``dialect`` (SQLAlchemy dialect name) lexes differently from
    sqlparse. Without a dialect only the dialect independent checks run.
    """
    if sql is None or not sql.strip():
        raise SqlSafetyError("SQL ifadesi boş")
    if "\x00" in sql:
        raise SqlSafetyError("SQL metni NUL karakteri içeremez")
    parsed = _parse(sql)
    for statement in parsed:
        _check_lexical(statement, dialect)
    statements = [statement for statement in parsed if _is_meaningful(statement)]
    if not statements:
        raise SqlSafetyError("SQL ifadesi boş")
    if len(statements) > 1:
        raise SqlSafetyError("Tek seferde yalnızca bir SQL ifadesi çalıştırılabilir")
    statement = statements[0]
    if dialect == "mssql":
        _check_tsql_batch(statement)
    return _statement_text(statement)


def _statement_text(statement: S.Statement) -> str:
    """Statement text up to its last meaningful token (drops trailing ``;`` and comments)."""
    leaves = list(statement.flatten())
    last = max((index for index, leaf in enumerate(leaves) if not _is_noise(leaf)), default=-1)
    return "".join(leaf.value for leaf in leaves[: last + 1]).strip()


def _check_lexical(statement: S.Statement, dialect: str | None) -> None:
    known = dialect is not None
    mysql = dialect in _MYSQL_DIALECTS
    for token in statement.flatten():
        ttype, value = token.ttype, token.value
        if ttype in T.Error:
            raise SqlSafetyError(f"SQL metni çözümlenemedi: beklenmeyen karakter {value!r}")
        if ttype in T.Comment.Multiline:
            if "/*" in value[2:]:
                raise SqlSafetyError("İç içe yorum blokları (/* /* */ */) desteklenmiyor")
            if value.startswith("/*!") and (mysql or not known):
                raise SqlSafetyError("MySQL çalıştırılabilir yorumları (/*! ... */) desteklenmiyor")
        elif ttype in T.Comment.Single:
            if value.startswith("#") and known and not mysql:
                raise SqlSafetyError("'#' ile başlayan yorumlar bu veritabanında desteklenmiyor; '--' kullanın")
        elif ttype in T.String.Single or ttype in T.String.Symbol:
            if known and not mysql and _has_backslash_escaped_quote(value):
                raise SqlSafetyError(
                    "Ters bölü ile kaçışlı tırnak (\\') desteklenmiyor; tırnak için iki tırnak ('') kullanın"
                )
        elif ttype is T.Punctuation and value in ("[", "]") and dialect == "mssql":
            raise SqlSafetyError("Köşeli parantezli tanımlayıcı çözümlenemedi (']]' kaçışı desteklenmiyor)")


def _has_backslash_escaped_quote(literal: str) -> bool:
    quote = literal[:1]
    inner = literal[1:-1]
    return bool(quote) and f"\\{quote}" in inner


def _check_tsql_batch(statement: S.Statement) -> None:
    """Reject statement-starting words hidden in a semicolon-less SQL Server batch."""
    tokens = list(_top_level(statement))
    if not tokens:
        return
    main = _head(tokens[0]) if not isinstance(tokens[0], S.Parenthesis) else "("
    select_used = False
    set_used = False
    previous = main
    for token in tokens[1:]:
        word = _word(token)
        head = word.split(" ", 1)[0] if word else ""
        if head in _TSQL_STATEMENT_WORDS:
            if main == "WITH" and head in _MAIN_STATEMENT_WORDS:
                main = head  # the statement that follows the CTE list
            elif head == "SELECT" and (previous in _SET_OPERATORS or (main == "INSERT" and not select_used)):
                select_used = True
            elif head == "SET" and main == "UPDATE" and not set_used:
                set_used = True
            elif head == "FETCH" and previous in ("ROW", "ROWS"):
                pass
            else:
                raise SqlSafetyError(
                    f"Birden fazla SQL ifadesi tespit edildi ('{head}'); tek seferde yalnızca bir ifade çalıştırılabilir"
                )
        previous = word if word else ("(" if isinstance(token, S.Parenthesis) else "")


# --------------------------------------------------------------------------- parameters


def extract_param_names(sql: str) -> list[str]:
    """Ordered, unique ``:name`` placeholders.

    String literals, quoted identifiers, comments and PostgreSQL ``::type`` casts are
    ignored because sqlparse lexes them as their own tokens.
    """
    names: list[str] = []
    seen: set[str] = set()
    for statement in _parse(sql):
        for token in statement.flatten():
            if token.ttype in T.Name.Placeholder and token.value.startswith(":") and len(token.value) > 1:
                name = token.value[1:]
                if name not in seen:
                    seen.add(name)
                    names.append(name)
    return names


def to_text_clause_sql(sql: str) -> str:
    """Rewrite ``sql`` so that ``sqlalchemy.text()`` binds exactly :func:`extract_param_names`.

    ``text()`` scans the raw string with a regular expression and would otherwise treat
    ``':x'`` inside literals or comments as bind parameters, and it cannot see a
    placeholder directly followed by a ``::type`` cast. Colons that are not placeholders
    get a backslash (``text()`` removes it again when compiling) and a space is inserted
    between a placeholder and a following colon.
    """
    text = sql or ""
    pieces: list[str] = []
    placeholder_starts: set[int] = set()
    position = 0
    for statement in _parse(text):
        leaves = list(statement.flatten())
        for index, token in enumerate(leaves):
            value = token.value
            if token.ttype in T.Name.Placeholder and value.startswith(":") and len(value) > 1:
                placeholder_starts.add(position)
                pieces.append(value)
                position += len(value)
                following = leaves[index + 1].value if index + 1 < len(leaves) else ""
                if following.startswith(":"):
                    pieces.append(" ")
                    position += 1
            else:
                pieces.append(value)
                position += len(value)
    rewritten = "".join(pieces)
    if rewritten.replace(" ", "") != text.replace(" ", ""):
        raise SqlSafetyError("SQL metni çözümlenemedi")

    out: list[str] = []
    last = 0
    for match in _SA_BIND_RE.finditer(rewritten):
        if match.start() in placeholder_starts:
            continue
        out.append(rewritten[last : match.start()])
        out.append("\\")
        last = match.start()
    out.append(rewritten[last:])
    return "".join(out)
