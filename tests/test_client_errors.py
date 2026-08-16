import json
import logging

import pytest

import app as application
from client_error_store import ClientErrorStore


@pytest.fixture(autouse=True)
def isolated_store(tmp_path, monkeypatch):
    application._client_error_requests.clear()
    monkeypatch.setattr(application, "client_error_store", ClientErrorStore(tmp_path / "errors.sqlite3"))


def valid_payload():
    return {"type": "error", "message": "boom", "clientId": "0123456789abcdef", "pathname": "/stats.html"}


def test_success_logs_structured_sanitized_json(caplog):
    caplog.set_level(logging.WARNING, logger="client_errors")
    payload = valid_payload() | {"source": "https://example.test/app.js?token=secret", "stack": "at https://x/y.js?password=nope", "actorRole": "Hamlet", "playId": "summer"}
    response = application.app.test_client().post("/api/client-errors?password=not-logged", json=payload, headers={"User-Agent": "Test UA"})
    assert response.status_code == 204
    record = json.loads(caplog.records[-1].message)
    assert record["event"] == "client_error"
    assert record["pathname"] == "/stats.html"
    assert record["actorRole"] == "Hamlet"
    assert record["source"] == "https://example.test/app.js"
    assert "secret" not in caplog.records[-1].message and "nope" not in caplog.records[-1].message
    assert record["userAgent"] == "Test UA"
    assert record["serverTimestamp"].endswith("+00:00")


@pytest.mark.parametrize("payload", [{}, [], {"type": "error", "message": "boom", "clientId": "bad"}])
def test_validation_rejects_invalid_payload(payload):
    assert application.app.test_client().post("/api/client-errors", json=payload).status_code == 400


def test_rejects_wrong_content_type_and_oversized_body():
    client = application.app.test_client()
    assert client.post("/api/client-errors", data="text").status_code == 415
    assert client.post("/api/client-errors", data=b"x" * (application.CLIENT_ERROR_MAX_BODY + 1), content_type="application/json").status_code == 413


def test_rate_limit():
    client = application.app.test_client()
    for _ in range(application.CLIENT_ERROR_RATE_LIMIT):
        assert client.post("/api/client-errors", json=valid_payload()).status_code == 204
    assert client.post("/api/client-errors", json=valid_payload()).status_code == 429


def test_forwarded_ip_only_from_trusted_proxy(caplog):
    caplog.set_level(logging.WARNING, logger="client_errors")
    client = application.app.test_client()
    client.post("/api/client-errors", json=valid_payload(), environ_base={"REMOTE_ADDR": "203.0.113.9"}, headers={"X-Forwarded-For": "198.51.100.2"})
    assert json.loads(caplog.records[-1].message)["ip"] == "203.0.113.9"
    client.post("/api/client-errors", json=valid_payload(), environ_base={"REMOTE_ADDR": "127.0.0.1"}, headers={"X-Forwarded-For": "198.51.100.2"})
    assert json.loads(caplog.records[-1].message)["ip"] == "198.51.100.2"


def admin_headers(password=None, mutation=False):
    headers = {"X-Director-Password": password or application.config.DIRECTOR_PASSWORD}
    if mutation:
        headers.update({"X-Requested-With": "ErrorDashboard", "Content-Type": "application/json"})
    return headers


def post_error(client, **changes):
    return client.post("/api/client-errors", json=valid_payload() | changes)


def test_persistence_and_deterministic_grouping():
    client = application.app.test_client()
    assert post_error(client, actorRole="Alice", stack="first").status_code == 204
    assert post_error(client, actorRole="Bob", stack="latest").status_code == 204
    fresh = ClientErrorStore(application.client_error_store.path)
    result = fresh.list()
    assert result["total"] == 1
    assert result["items"][0]["occurrenceCount"] == 2
    assert result["items"][0]["actorRole"] == "Bob"
    assert result["items"][0]["stack"] == "latest"


def test_admin_auth_listing_filtering_and_bounded_pagination():
    client = application.app.test_client()
    post_error(client, message="alpha failure", playId="one")
    post_error(client, message="beta failure", playId="two")
    assert client.get("/api/admin/client-errors").status_code == 401
    assert client.get("/api/admin/client-errors", headers=admin_headers("wrong")).status_code == 401
    response = client.get("/api/admin/client-errors?search=alpha&status=open&limit=999&offset=-4", headers=admin_headers())
    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "no-store"
    data = response.get_json()
    assert data["total"] == 1 and data["items"][0]["message"] == "alpha failure"
    assert data["limit"] == 100 and data["offset"] == 0
    assert client.get("/api/admin/client-errors?status=nope", headers=admin_headers()).status_code == 400


def test_resolve_reopen_delete_and_clear_resolved():
    client = application.app.test_client()
    post_error(client, message="first")
    post_error(client, message="second")
    items = client.get("/api/admin/client-errors", headers=admin_headers()).get_json()["items"]
    first, second = items[0]["id"], items[1]["id"]
    assert client.patch(f"/api/admin/client-errors/{first}", json={"status":"resolved"}, headers=admin_headers()).status_code == 415
    assert client.patch(f"/api/admin/client-errors/{first}", json={"status":"resolved"}, headers=admin_headers("wrong", True)).status_code == 401
    assert client.patch(f"/api/admin/client-errors/{first}", json={"status":"resolved"}, headers=admin_headers(mutation=True)).status_code == 200
    assert client.get("/api/admin/client-errors?status=resolved", headers=admin_headers()).get_json()["total"] == 1
    assert client.patch(f"/api/admin/client-errors/{first}", json={"status":"open"}, headers=admin_headers(mutation=True)).status_code == 200
    assert client.delete(f"/api/admin/client-errors/{second}", json={}, headers=admin_headers(mutation=True)).status_code == 200
    assert client.patch(f"/api/admin/client-errors/{first}", json={"status":"resolved"}, headers=admin_headers(mutation=True)).status_code == 200
    cleared = client.delete("/api/admin/client-errors", json={}, headers=admin_headers(mutation=True))
    assert cleared.status_code == 200 and cleared.get_json()["deleted"] == 1
    assert client.get("/api/admin/client-errors", headers=admin_headers()).get_json()["total"] == 0


def test_mutation_rejects_cross_origin():
    client = application.app.test_client()
    post_error(client)
    error_id = client.get("/api/admin/client-errors", headers=admin_headers()).get_json()["items"][0]["id"]
    headers = admin_headers(mutation=True) | {"Origin": "https://evil.example"}
    assert client.delete(f"/api/admin/client-errors/{error_id}", json={}, headers=headers).status_code == 403
