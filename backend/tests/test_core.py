"""Core guarantees: literal escaping, path locking, design validation, build and the DB proxy."""
from __future__ import annotations

import copy

import pytest

from backend.security import PathSecurityError, lock_path
from backend.services.design import DesignError, flatten_design, load_manifest, new_form_design
from backend.services.template_service import to_ts_literal

LIST_SQL = "SELECT id, ad, soyad, sehir, bakiye FROM musteriler WHERE sehir LIKE :sehir ORDER BY ad, soyad"


# --------------------------------------------------------------------------- unit


def test_to_ts_literal_escapes_everything_outside_the_whitelist():
    out = to_ts_literal("</script><img onerror=x>`${a}`\"'\\\n\u2028ş")
    for bad in ("<", ">", "`", "\"'", "\\\\\n", "\u2028", "ş"):
        assert bad not in out[1:-1]
    assert out.startswith('"') and out.endswith('"')
    assert "\\u003c/script\\u003e" in out
    assert to_ts_literal({"a b": [1, True, None], "ok": "x"}) == '{ "a b": [1, true, null], ok: "x" }'


def test_lock_path_rejects_escapes(tmp_path):
    assert lock_path(tmp_path, "build", "Form1.js") == (tmp_path / "build" / "Form1.js").resolve()
    for evil in ("../x", "build/../../x", "/etc/passwd"):
        with pytest.raises(PathSecurityError):
            lock_path(tmp_path, evil)


def test_flatten_design_validates_names_and_values():
    manifest = load_manifest()
    doc = new_form_design("Form1", "Deneme", 624, 441)
    doc["form"]["children"] = [
        {"class": "TButton", "name": "Button1", "props": {"Left": 8, "Top": 8, "Caption": "Tamam", "Width": "x"}, "events": {"OnClick": "Button1_OnClick"}}
    ]
    flat = flatten_design(doc, manifest, form_names=("Form1",))
    assert not flat.errors
    assert any("Width" in w for w in flat.warnings)  # invalid value → skipped with a warning
    assert "Button1_OnClick" in flat.handlers

    for bad_name in ("1abc", "constructor", "TForm"):
        bad = copy.deepcopy(doc)
        bad["form"]["children"][0]["name"] = bad_name
        try:
            result = flatten_design(bad, manifest, form_names=("Form1",))
        except DesignError:
            continue
        assert result.errors, bad_name

    unknown = copy.deepcopy(doc)
    unknown["form"]["children"][0]["class"] = "TEvil"
    try:
        result = flatten_design(unknown, manifest, form_names=("Form1",))
    except DesignError:
        return
    assert result.errors


# --------------------------------------------------------------------------- API


@pytest.fixture()
def demo(client, auth_headers):
    res = client.post("/api/projects", json={"name": "Demo", "template": "demo"}, headers=auth_headers)
    assert res.status_code == 201, res.text
    return res.json()


def _run(client, headers, pid):
    res = client.post(f"/api/projects/{pid}/run", headers=headers)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["ok"], body
    return body


def test_incremental_build_and_preview(client, auth_headers, demo):
    pid = demo["id"]
    first = client.post(f"/api/projects/{pid}/build", json={"force": True}, headers=auth_headers).json()
    assert first["ok"] and {"Form1.js", "Form1.ts", "vcl.js", "app.js"} <= {f["path"] for f in first["files"]}
    second = client.post(f"/api/projects/{pid}/build", headers=auth_headers).json()
    assert second["ok"] and not second["rebuilt_units"] and second["skipped_units"]

    run = _run(client, auth_headers, pid)
    page = client.get(run["url"])
    assert page.status_code == 200
    assert "script-src 'self'" in page.headers["content-security-policy"]
    assert client.get(f"/preview/{pid}/not-a-token/Form1.html").status_code == 404  # no token oracle
    assert client.get(f"/preview/{pid}/{run['token']}/..%2F..%2Fdata%2Fmaster.key").status_code in (400, 403, 404)


def test_sandbox_preflight_from_opaque_origin(client):
    res = client.options(
        "/api/db/x/query",
        headers={"Origin": "null", "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "authorization,content-type"},
    )
    assert res.status_code == 204
    assert res.headers["access-control-allow-origin"] == "*"


def test_connection_secrets_never_leave_the_backend(client, auth_headers, demo):
    conns = client.get("/api/db/connections", params={"project_id": demo["id"]}, headers=auth_headers).json()
    assert conns
    for c in conns:
        text = str(c).lower()
        assert "password" not in {k.lower() for k in c} and "url" not in {k.lower() for k in c}
        assert "sqlite:///" not in text


def test_db_proxy_binds_parameters_and_enforces_allow_list(client, auth_headers, demo):
    pid = demo["id"]
    run = _run(client, auth_headers, pid)
    run_headers = {"Authorization": f"Bearer {run['token']}"}
    conn_id = client.get("/api/db/connections", params={"project_id": pid}, headers=auth_headers).json()[0]["id"]
    url = f"/api/db/{conn_id}/query"

    ok = client.post(url, json={"sql": LIST_SQL, "params": {"sehir": "%"}}, headers=run_headers)
    assert ok.status_code == 200, ok.text
    total = len(ok.json()["rows"])
    assert total > 0

    injected = client.post(url, json={"sql": LIST_SQL, "params": {"sehir": "x' OR '1'='1"}}, headers=run_headers)
    assert injected.status_code == 200 and injected.json()["rows"] == []

    adhoc = client.post(url, json={"sql": "SELECT * FROM musteriler"}, headers=run_headers)
    assert adhoc.status_code == 403

    missing = client.post(url, json={"sql": LIST_SQL, "params": {}}, headers=run_headers)
    assert missing.status_code == 400

    stacked = client.post(url, json={"sql": "SELECT 1; DROP TABLE musteriler"}, headers=auth_headers)
    assert stacked.status_code == 400

    again = client.post(url, json={"sql": LIST_SQL, "params": {"sehir": "%"}}, headers=run_headers)
    assert len(again.json()["rows"]) == total
