"""Ranking tests.

Relevance is the whole product, so the scorer is tested like business logic:
a ranking regression should fail here, not in front of a user.
"""
from datetime import datetime, timedelta, timezone

from app import ranking

PROFILE = {
    "keywords": ["graph neural network", "protein structure prediction", "cryo-EM"],
    "venues": ["Nature Methods"],
    "lookback_days": 7,
}


def _recent(days_ago=1):
    return (datetime.now(timezone.utc) - timedelta(days=days_ago)).strftime("%Y-%m-%d")


def test_title_match_outweighs_abstract_match():
    in_title = {"title": "Cryo-EM at scale", "abstract": "Unrelated text.", "venue": "", "published_at": ""}
    in_abstract = {"title": "Unrelated title", "abstract": "We used cryo-EM here.", "venue": "", "published_at": ""}
    assert (
        ranking.score_paper(in_title, PROFILE)["score"]
        > ranking.score_paper(in_abstract, PROFILE)["score"]
    )


def test_keyword_matching_handles_plurals():
    """Research titles flip between singular and plural constantly."""
    assert ranking._phrase_hits("graph neural network", "Graph Neural Networks for X") == 1
    assert ranking._phrase_hits("protein structure prediction", "protein structure predictions") == 1


def test_keyword_matching_respects_word_boundaries():
    """A short acronym must not match inside a longer word."""
    assert ranking._phrase_hits("gan", "The organ was imaged") == 0
    assert ranking._phrase_hits("gan", "We trained a GAN") == 1


def test_user_named_venue_beats_curated_venue():
    user = ranking.venue_prestige("Nature Methods", PROFILE["venues"])
    curated = ranking.venue_prestige("Science Advances", PROFILE["venues"])
    unknown = ranking.venue_prestige("Journal of Nothing", PROFILE["venues"])
    assert user > curated > unknown == 0.0


def test_venue_prestige_rejects_coincidental_substrings():
    """Observed: 'Journal of ... Engineering Sciences' got Science's prestige."""
    assert ranking.venue_prestige("Journal of Al-Farabi for Engineering Sciences", []) == 0.0
    assert ranking.venue_prestige("Cellular Signalling", []) == 0.0
    assert ranking.venue_prestige("Natures Unbound Quarterly", []) == 0.0


def test_venue_prestige_still_credits_real_journal_families():
    assert ranking.venue_prestige("Nature Methods", []) > 0
    assert ranking.venue_prestige("Nature Communications", []) > 0
    assert ranking.venue_prestige("The Lancet Oncology", []) > 0
    assert ranking.venue_prestige("Science Advances", []) > 0
    assert ranking.venue_prestige("Proceedings of the National Academy of Sciences", []) > 0


def test_recency_bonus_decays_and_ignores_undated():
    fresh = ranking.recency_bonus(_recent(0), 7)
    stale = ranking.recency_bonus(_recent(6), 7)
    assert fresh > stale >= 0.0
    assert ranking.recency_bonus("", 7) == 0.0
    assert ranking.recency_bonus("not-a-date", 7) == 0.0


def test_rank_papers_drops_non_matches_and_sorts_best_first():
    papers = [
        {"title": "Study of medieval pottery", "abstract": "Ceramics.", "venue": "", "published_at": ""},
        {"title": "Cryo-EM of a channel", "abstract": "cryo-EM work", "venue": "Nature Methods", "published_at": _recent(1)},
        {"title": "Graph neural networks survey", "abstract": "GNNs.", "venue": "", "published_at": ""},
    ]
    ranked = ranking.rank_papers(papers, PROFILE)
    titles = [p["title"] for p in ranked]
    assert "Study of medieval pottery" not in titles  # no keyword overlap at all
    assert titles[0] == "Cryo-EM of a channel"         # keyword + venue + recency
    assert all(
        ranked[i]["score"] >= ranked[i + 1]["score"] for i in range(len(ranked) - 1)
    )


def test_ranking_is_deterministic_and_stable_on_ties():
    papers = [
        {"title": "B cryo-EM paper", "abstract": "", "venue": "", "published_at": ""},
        {"title": "A cryo-EM paper", "abstract": "", "venue": "", "published_at": ""},
    ]
    first = [p["title"] for p in ranking.rank_papers(papers, PROFILE)]
    second = [p["title"] for p in ranking.rank_papers(list(reversed(papers)), PROFILE)]
    assert first == second            # input order must not change output
    assert first[0] == "A cryo-EM paper"  # ties break alphabetically


def test_multi_topic_papers_outrank_single_generic_matches():
    """The real failure: a GNN traffic paper outranking a cryo-EM+MD paper."""
    profile = {"keywords": ["cryo-EM", "molecular dynamics", "graph neural network"],
               "venues": [], "lookback_days": 7}
    intersection = {"title": "Cryo-EM and molecular dynamics of a channel",
                    "abstract": "", "venue": "", "published_at": ""}
    single_term = {"title": "Graph neural networks for traffic forecasting",
                   "abstract": "graph neural network graph neural network",
                   "venue": "", "published_at": ""}
    a = ranking.score_paper(intersection, profile)
    b = ranking.score_paper(single_term, profile)
    assert a["breakdown"]["topic_overlap"] > 0
    assert b["breakdown"]["topic_overlap"] == 0
    assert a["score"] > b["score"]


def test_breakdown_explains_the_score():
    paper = {
        "title": "Cryo-EM and graph neural networks",
        "abstract": "",
        "venue": "Nature Methods",
        "published_at": _recent(0),
    }
    result = ranking.score_paper(paper, PROFILE)
    bd = result["breakdown"]
    assert set(bd["matched_keywords"]) == {"cryo-EM", "graph neural network"}
    assert bd["keywords"] > 0 and bd["venue"] > 0 and bd["recency"] > 0
    assert abs(
        result["score"]
        - (bd["keywords"] + bd["venue"] + bd["recency"] + bd["topic_overlap"])
    ) < 0.01


def test_keyword_rationale_names_the_matched_topics():
    paper = {"title": "Cryo-EM study", "abstract": "", "venue": "Nature Methods", "published_at": _recent(0)}
    paper.update(ranking.score_paper(paper, PROFILE))
    text = ranking.keyword_rationale(paper)
    assert "cryo-EM" in text
    assert "Nature Methods" in text
    assert text.endswith(".")
