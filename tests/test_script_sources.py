import csv
from pathlib import Path
from unittest.mock import Mock

import pytest

import app as application


def test_winter_script_route_reads_configured_csv(monkeypatch):
    project_root = Path(application.__file__).resolve().parent
    monkeypatch.chdir(project_root)
    fetch = Mock(side_effect=AssertionError("Local scripts must not fetch a URL"))
    monkeypatch.setattr(application.requests, "get", fetch)
    with (project_root / "static/data/winterstueck2026.csv").open(
        encoding="utf-8-sig", newline=""
    ) as source:
        expected = list(csv.DictReader(source))

    response = application.app.test_client().get("/api/script/winterstueck2026")

    assert response.status_code == 200
    assert expected
    assert response.get_json() == expected
    fetch.assert_not_called()


def test_google_sheet_route_still_fetches_csv(monkeypatch):
    sheet_url = "https://docs.google.com/spreadsheets/d/test-sheet/edit?gid=42#gid=42"
    monkeypatch.setattr(application, "_sheet_url_for_play", lambda play_id: sheet_url)
    upstream = Mock()
    upstream.text = 'Szene,Kategorie,Charakter,Mikrofon,Text/Anweisung\n1,Schauspieler,JULIA,,"Hallo, Romeo!"\n'
    fetch = Mock(return_value=upstream)
    monkeypatch.setattr(application.requests, "get", fetch)

    response = application.app.test_client().get("/api/script/remote")

    assert response.status_code == 200
    assert response.get_json() == [{
        "Szene": "1", "Kategorie": "Schauspieler", "Charakter": "JULIA",
        "Mikrofon": "", "Text/Anweisung": "Hallo, Romeo!",
    }]
    fetch.assert_called_once_with(
        "https://docs.google.com/spreadsheets/d/test-sheet/export?format=csv&gid=42",
        timeout=30,
    )
    upstream.raise_for_status.assert_called_once_with()


@pytest.mark.parametrize("source_url", [
    "/static/data/../outside.csv",
    "/static/data/%2e%2e%2foutside.csv",
    "/static/data/subdirectory/script.csv",
    "/static/data/script.csv?version=2",
    "/static/data/script.csv#fragment",
    "/static/data/script.txt",
    "//example.test/script.csv",
])
def test_invalid_local_source_is_not_read(monkeypatch, source_url):
    monkeypatch.setattr(application, "_sheet_url_for_play", lambda play_id: source_url)
    read = Mock(side_effect=AssertionError("Invalid source must not be opened"))
    fetch = Mock(side_effect=AssertionError("Invalid source must not be fetched"))
    monkeypatch.setattr("builtins.open", read)
    monkeypatch.setattr(application.requests, "get", fetch)

    response = application.app.test_client().get("/api/script/invalid")

    assert response.status_code == 400
    read.assert_not_called()
    fetch.assert_not_called()


def test_local_source_cannot_follow_symlink_outside_data(monkeypatch, tmp_path):
    data_dir = tmp_path / "static/data"
    data_dir.mkdir(parents=True)
    outside = tmp_path / "outside.csv"
    outside.write_text("private data", encoding="utf-8")
    (data_dir / "linked.csv").symlink_to(outside)
    monkeypatch.setattr(application.app, "static_folder", str(data_dir.parent))
    monkeypatch.setattr(
        application, "_sheet_url_for_play", lambda play_id: "/static/data/linked.csv"
    )
    read = Mock(side_effect=AssertionError("External symlink must not be opened"))
    monkeypatch.setattr("builtins.open", read)

    response = application.app.test_client().get("/api/script/invalid")

    assert response.status_code == 400
    read.assert_not_called()
