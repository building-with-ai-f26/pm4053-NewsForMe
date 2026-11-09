"""Pipeline tests: the core workflow, with both sources stubbed.

These cover the behaviour that matters most for a live demo -- the run must
still produce a briefing when a source is down or the model is absent.
"""
from datetime import datetime, timedelta, timezone

import pytest

from app import db, llm, pipeline, sources


@pytest.fixture()
def conn(tmp_path):
    path = str(tmp_path / "test.db")
    db.init_db(path)
    connection = db.connect(path)
    yield connection
    connection.close()


PROFILE = {
    "display_name": "Priya",
    "field": "structural biology",
    "keywords": ["cryo-EM", "graph neural network"],
    "venues": ["Nature Methods"],
    "arxiv_categories": ["q-bio.BM"],
    "lookback_days": 7,
}


def _recent():
    return (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")


def _fake_arxiv_papers():
    return [
        {
            "external_id": "arxiv:1", "source": "arxiv",
            "title": "Graph neural networks for cryo-EM", "abstract": "cryo-EM and GNNs",
            "authors": ["A"], "venue": "arXiv preprint (q-bio.BM)", "doi": None,
            "url": "http://arxiv.org/abs/1", "published_at": _recent(),
        },
        {
            "external_id": "arxiv:2", "source": "arxiv",
            "title": "Medieval pottery kilns", "abstract": "Ceramics only.",
            "authors": ["B"], "venue": "arXiv preprint", "doi": None,
            "url": "http://arxiv.org/abs/2", "published_at": _recent(),
        },
    ]


def _fake_crossref_papers():
    return [
        {
            "external_id": "doi:10.1/a", "source": "crossref",
            "title": "Cryo-EM structure of a channel", "abstract": "We used cryo-EM.",
            "authors": ["C"], "venue": "Nature Methods", "doi": "10.1/a",
            "url": "https://doi.org/10.1/a", "published_at": _recent(),
        }
    ]


def test_briefing_ranks_relevant_papers_and_drops_irrelevant(conn, monkeypatch):
    monkeypatch.setattr(sources, "fetch_arxiv", lambda *a, **k: _fake_arxiv_papers())
    monkeypatch.setattr(sources, "fetch_crossref", lambda *a, **k: _fake_crossref_papers())
    monkeypatch.setattr(llm, "is_configured", lambda: False)

    briefing_id = pipeline.generate_briefing(conn, PROFILE)
    briefing = db.get_briefing(conn, briefing_id)

    titles = [i["paper"]["title"] for i in briefing["items"]]
    assert "Medieval pottery kilns" not in titles  # no keyword overlap
    assert len(titles) == 2
    assert briefing["model_used"] == "deterministic-only"
    # every item carries an explanation and a stored score breakdown
    for item in briefing["items"]:
        assert item["rationale"]
        assert item["rationale_source"] == "keywords"
        assert "matched_keywords" in item["breakdown"]


def test_briefing_survives_a_dead_source(conn, monkeypatch):
    """arXiv 429s in practice. The run must still produce a briefing."""
    def boom(*a, **k):
        raise RuntimeError("arXiv rate limited (429)")

    monkeypatch.setattr(sources, "fetch_arxiv", boom)
    monkeypatch.setattr(sources, "fetch_crossref", lambda *a, **k: _fake_crossref_papers())
    monkeypatch.setattr(llm, "is_configured", lambda: False)

    briefing = db.get_briefing(conn, pipeline.generate_briefing(conn, PROFILE))
    assert briefing["item_count"] == 1
    assert "arXiv failed" in briefing["notes"]  # the failure is recorded, not hidden


def test_briefing_survives_both_sources_failing(conn, monkeypatch):
    def boom(*a, **k):
        raise RuntimeError("down")

    monkeypatch.setattr(sources, "fetch_arxiv", boom)
    monkeypatch.setattr(sources, "fetch_crossref", boom)
    monkeypatch.setattr(llm, "is_configured", lambda: False)

    briefing = db.get_briefing(conn, pipeline.generate_briefing(conn, PROFILE))
    assert briefing["item_count"] == 0
    assert briefing["items"] == []


def test_briefing_falls_back_when_the_model_errors(conn, monkeypatch):
    monkeypatch.setattr(sources, "fetch_arxiv", lambda *a, **k: _fake_arxiv_papers())
    monkeypatch.setattr(sources, "fetch_crossref", lambda *a, **k: _fake_crossref_papers())
    monkeypatch.setattr(llm, "is_configured", lambda: True)

    def unavailable(*a, **k):
        raise llm.LLMUnavailable("OpenRouter 402: out of credit")

    monkeypatch.setattr(llm, "review_papers", unavailable)

    briefing = db.get_briefing(conn, pipeline.generate_briefing(conn, PROFILE))
    assert briefing["item_count"] == 2  # keyword ranking still delivered
    assert "model review skipped" in briefing["notes"]
    assert all(i["rationale_source"] == "keywords" for i in briefing["items"])


def test_model_rationales_are_used_when_available(conn, monkeypatch):
    monkeypatch.setattr(sources, "fetch_arxiv", lambda *a, **k: _fake_arxiv_papers())
    monkeypatch.setattr(sources, "fetch_crossref", lambda *a, **k: _fake_crossref_papers())
    monkeypatch.setattr(llm, "is_configured", lambda: True)
    monkeypatch.setattr(
        llm, "review_papers",
        lambda papers, profile, **k: (
            [{"index": i, "keep": True, "relevance": 80, "reason": "model says relevant"}
             for i in range(len(papers))],
            {"model_used": "test/model", "prompt_tokens": 100, "completion_tokens": 20},
        ),
    )

    briefing = db.get_briefing(conn, pipeline.generate_briefing(conn, PROFILE))
    assert briefing["model_used"] == "test/model"
    assert briefing["prompt_tokens"] == 100
    assert all(i["rationale"] == "model says relevant" for i in briefing["items"])
    assert all(i["rationale_source"] == "model" for i in briefing["items"])


def test_duplicate_papers_across_sources_appear_once(conn, monkeypatch):
    shared = dict(_fake_crossref_papers()[0])
    preprint = dict(shared, external_id="arxiv:dup", source="arxiv", venue="arXiv preprint")
    monkeypatch.setattr(sources, "fetch_arxiv", lambda *a, **k: [preprint])
    monkeypatch.setattr(sources, "fetch_crossref", lambda *a, **k: [shared])
    monkeypatch.setattr(llm, "is_configured", lambda: False)

    briefing = db.get_briefing(conn, pipeline.generate_briefing(conn, PROFILE))
    assert briefing["item_count"] == 1
    assert briefing["items"][0]["paper"]["venue"] == "Nature Methods"  # published wins


def test_feedback_is_recorded_against_the_paper(conn, monkeypatch):
    monkeypatch.setattr(sources, "fetch_arxiv", lambda *a, **k: _fake_arxiv_papers())
    monkeypatch.setattr(sources, "fetch_crossref", lambda *a, **k: [])
    monkeypatch.setattr(llm, "is_configured", lambda: False)

    briefing_id = pipeline.generate_briefing(conn, PROFILE)
    briefing = db.get_briefing(conn, briefing_id)
    paper_id = briefing["items"][0]["paper"]["id"]

    db.record_feedback(conn, paper_id, briefing_id, "useful")
    assert db.feedback_counts(conn) == {"useful": 1}
    assert db.get_briefing(conn, briefing_id)["items"][0]["vote"] == "useful"
