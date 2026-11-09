"""Route tests through FastAPI's TestClient. No network, no real model."""
import importlib
import os

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("NEWSFORME_DB", str(tmp_path / "web.db"))
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    monkeypatch.delenv("POSTHOG_PUBLIC_KEY", raising=False)
    from app import db as db_module
    importlib.reload(db_module)
    from app import main as main_module
    importlib.reload(main_module)
    with TestClient(main_module.app) as test_client:
        yield test_client, main_module


def test_health_reports_status(client):
    test_client, _ = client
    body = test_client.get("/health").json()
    assert body["status"] == "ok"
    assert body["model_configured"] is False


def test_root_redirects_to_profile_until_one_exists(client):
    test_client, _ = client
    resp = test_client.get("/", follow_redirects=False)
    assert resp.status_code == 303
    assert resp.headers["location"] == "/profile"


def test_profile_form_renders(client):
    test_client, _ = client
    page = test_client.get("/profile")
    assert page.status_code == 200
    assert "Your research profile" in page.text


def test_saving_a_profile_then_viewing_home(client):
    test_client, _ = client
    resp = test_client.post(
        "/profile",
        data={
            "display_name": "Priya",
            "field": "structural biology",
            "keywords": "cryo-EM\ngraph neural network",
            "venues": "Nature Methods",
            "arxiv_categories": "q-bio.BM",
            "lookback_days": "14",
        },
        follow_redirects=False,
    )
    assert resp.status_code == 303
    home = test_client.get("/")
    assert home.status_code == 200
    assert "Priya" in home.text
    assert "cryo-EM" in home.text
    assert "14-day" in home.text


def test_keywords_accept_commas_or_newlines(client):
    test_client, main_module = client
    test_client.post(
        "/profile",
        data={"keywords": "a, b\nc, ,a", "lookback_days": "7"},
        follow_redirects=False,
    )
    conn = main_module.db.connect()
    try:
        profile = main_module.db.get_profile(conn)
    finally:
        conn.close()
    assert profile["keywords"] == ["a", "b", "c"]  # trimmed, split, de-duplicated


def test_lookback_days_is_clamped(client):
    test_client, main_module = client
    test_client.post("/profile", data={"keywords": "x", "lookback_days": "9999"},
                     follow_redirects=False)
    conn = main_module.db.connect()
    try:
        assert main_module.db.get_profile(conn)["lookback_days"] == 90
    finally:
        conn.close()


def test_missing_briefing_returns_404(client):
    test_client, _ = client
    assert test_client.get("/briefing/4242").status_code == 404


def test_generating_a_briefing_without_a_profile_redirects(client):
    test_client, _ = client
    resp = test_client.post("/briefing/new", follow_redirects=False)
    assert resp.status_code == 303
    assert resp.headers["location"] == "/profile"


def test_briefing_page_shows_papers_and_rationales(client, monkeypatch):
    test_client, main_module = client
    test_client.post("/profile", data={"keywords": "cryo-EM", "lookback_days": "7"},
                     follow_redirects=False)
    monkeypatch.setattr(
        main_module.pipeline.sources, "fetch_arxiv",
        lambda *a, **k: [{
            "external_id": "arxiv:1", "source": "arxiv",
            "title": "Cryo-EM advances", "abstract": "cryo-EM results",
            "authors": ["A. Author"], "venue": "arXiv preprint", "doi": None,
            "url": "http://arxiv.org/abs/1", "published_at": "",
        }],
    )
    monkeypatch.setattr(main_module.pipeline.sources, "fetch_crossref", lambda *a, **k: [])

    resp = test_client.post("/briefing/new", follow_redirects=False)
    assert resp.status_code == 303
    page = test_client.get(resp.headers["location"])
    assert "Cryo-EM advances" in page.text
    assert "Why you:" in page.text


def test_feedback_rejects_an_unknown_vote(client):
    test_client, _ = client
    resp = test_client.post("/feedback", data={"paper_id": "1", "vote": "sideways"})
    assert resp.status_code == 400


def test_posthog_snippet_is_absent_without_a_key(client):
    test_client, _ = client
    assert "posthog.init" not in test_client.get("/profile").text
