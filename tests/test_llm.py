"""Model-layer tests.

The point of these is the failure path. A model that returns prose, a bad
index, or nothing at all must never corrupt or crash the briefing.
"""
import pytest

from app import llm

PAPERS = [
    {"title": "Paper A", "score": 1.0, "rationale": "kw A", "rationale_source": "keywords"},
    {"title": "Paper B", "score": 2.0, "rationale": "kw B", "rationale_source": "keywords"},
    {"title": "Paper C", "score": 3.0, "rationale": "kw C", "rationale_source": "keywords"},
]


def test_extract_json_handles_code_fences_and_surrounding_prose():
    raw = 'Sure!\n```json\n{"results": [{"index": 0}]}\n```\nHope that helps.'
    assert llm._extract_json(raw) == {"results": [{"index": 0}]}


def test_extract_json_handles_bare_json():
    assert llm._extract_json('{"results": []}') == {"results": []}


def test_extract_json_raises_when_there_is_no_json():
    with pytest.raises(llm.LLMUnavailable):
        llm._extract_json("I cannot help with that.")


def test_apply_reviews_drops_papers_the_model_rejected():
    out = llm.apply_reviews(PAPERS, [{"index": 2, "keep": False}])
    assert [p["title"] for p in out] == ["Paper B", "Paper A"]  # by deterministic score


def test_apply_reviews_ignores_hallucinated_indexes():
    """A model citing paper 99 of 3 must change nothing."""
    out = llm.apply_reviews(PAPERS, [{"index": 99, "keep": True, "reason": "ghost"}])
    assert len(out) == 3
    assert all(p["rationale_source"] == "keywords" for p in out)


def test_apply_reviews_keeps_keyword_rationale_for_unreviewed_papers():
    out = llm.apply_reviews(PAPERS, [{"index": 0, "keep": True, "relevance": 90, "reason": "fits"}])
    by_title = {p["title"]: p for p in out}
    assert by_title["Paper A"]["rationale"] == "fits"
    assert by_title["Paper A"]["rationale_source"] == "model"
    assert by_title["Paper B"]["rationale"] == "kw B"
    assert by_title["Paper B"]["rationale_source"] == "keywords"


def test_model_relevance_reorders_above_deterministic_score():
    """Paper A is last by score but first once the model rates it highly."""
    out = llm.apply_reviews(PAPERS, [{"index": 0, "keep": True, "relevance": 99, "reason": "r"}])
    assert out[0]["title"] == "Paper A"


def test_apply_reviews_tolerates_garbage_entries():
    reviews = ["not a dict", {"index": "abc"}, {"no_index": 1}, {"index": 1, "keep": True}]
    out = llm.apply_reviews(PAPERS, reviews)
    assert len(out) == 3


def test_apply_reviews_clamps_out_of_range_relevance():
    out = llm.apply_reviews(PAPERS, [{"index": 0, "keep": True, "relevance": 5000}])
    assert out[0]["model_relevance"] == 100.0


def test_review_papers_raises_when_key_missing(monkeypatch):
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    with pytest.raises(llm.LLMUnavailable):
        llm.review_papers(PAPERS, {"keywords": ["x"]})


def test_placeholder_key_counts_as_unconfigured(monkeypatch):
    """The .env.example placeholder must not be treated as a real key."""
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-or-v1-replace-with-your-key")
    assert llm.is_configured() is False


def test_prompt_includes_profile_and_numbered_candidates():
    prompt = llm.build_prompt(PAPERS, {"field": "structural biology", "keywords": ["cryo-EM"]})
    assert "structural biology" in prompt
    assert "cryo-EM" in prompt
    assert "[0] TITLE: Paper A" in prompt
    assert "JSON only" in prompt


def test_cost_estimate_scales_with_tokens(monkeypatch):
    monkeypatch.setenv("MODEL_INPUT_USD_PER_MTOK", "1.00")
    monkeypatch.setenv("MODEL_OUTPUT_USD_PER_MTOK", "5.00")
    assert llm.estimate_cost_usd(1_000_000, 0) == 1.0
    assert llm.estimate_cost_usd(0, 1_000_000) == 5.0
    assert llm.estimate_cost_usd(0, 0) == 0.0
