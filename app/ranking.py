"""Deterministic relevance scoring.

The score is a plain weighted sum, not a model call, for three reasons:
  1. the app must work with no API key,
  2. the ranking must be explainable to the user ("why is this #1?"),
  3. it is unit-testable, so a ranking regression shows up as a failing test.

The LLM layer re-ranks and writes prose on top of this; it never replaces it.
"""
import re
from datetime import datetime, timezone
from typing import Any, Dict, List

from app.sources import REPUTABLE_VENUES

TITLE_WEIGHT = 3.0
ABSTRACT_WEIGHT = 1.0
VENUE_BOOST = 2.5
RECENCY_MAX = 1.5
# Bonus per tracked topic beyond the first that a paper matches.
#
# Observed failure this is aimed at: a structural-biology profile tracking
# "cryo-EM" and "graph neural network" was shown GNN papers about traffic
# forecasting and seizure onset. They matched one term literally but sat in a
# different field. Papers landing on two of the researcher's topics at once are
# far more likely to be genuinely theirs, so intersections get rewarded.
MULTI_TOPIC_BONUS = 2.0
# Ceiling on what any single tracked topic can contribute. Without it, a paper
# that says "graph neural network" eight times beats a paper that genuinely
# covers two of the researcher's topics, which is the wrong answer for them.
KEYWORD_CAP = 4.0

_STOPWORDS = {
    "the", "a", "an", "of", "and", "or", "for", "in", "on", "to", "with",
    "using", "via", "from", "by", "at", "is", "are", "be",
}


def tokenize(text: str) -> List[str]:
    return [t for t in re.findall(r"[a-z0-9]+", (text or "").lower()) if t not in _STOPWORDS]


def _phrase_hits(phrase: str, text: str) -> int:
    """Count occurrences of a keyword phrase in text.

    Multi-word phrases match as a phrase. Single words match on word
    boundaries so "GAN" does not match "organ".
    """
    words = tokenize(phrase)
    if not words:
        return 0
    # Allow a plural/possessive-free suffix on the final word so "graph neural
    # network" also matches "graph neural networks". Research titles switch
    # between singular and plural constantly.
    head = [re.escape(w) for w in words[:-1]]
    tail = re.escape(words[-1]) + r"(?:e?s)?"
    pattern = r"\b" + r"\W+".join(head + [tail]) + r"\b"
    return len(re.findall(pattern, (text or "").lower()))


def _venue_matches(venue: str, name: str) -> bool:
    """Does ``venue`` belong to the journal (or journal family) ``name``?

    A plain substring test is wrong: it gives "Journal of Al-Farabi for
    Engineering Sciences" the prestige of *Science*, and "Cellular Signalling"
    the prestige of *Cell*. Both were observed in real results.

    So the name must appear at the START of the venue and end on a word
    boundary. That still credits the real families -- "Nature Methods" and
    "Nature Communications" match "Nature", "The Lancet Oncology" matches
    "The Lancet" -- without crediting coincidental words buried mid-title.
    """
    venue_norm = re.sub(r"\s+", " ", (venue or "").strip().lower())
    name_norm = re.sub(r"\s+", " ", (name or "").strip().lower())
    if not venue_norm or not name_norm:
        return False
    pattern = r"^(?:the )?" + re.escape(name_norm) + r"\b"
    return re.search(pattern, venue_norm) is not None


def venue_prestige(venue: str, user_venues: List[str]) -> float:
    """Boost for venues the user named, then for the curated reputable list."""
    if not (venue or "").strip():
        return 0.0
    for user_venue in user_venues:
        if _venue_matches(venue, user_venue):
            return VENUE_BOOST
    for reputable in REPUTABLE_VENUES:
        if _venue_matches(venue, reputable):
            return VENUE_BOOST * 0.8
    return 0.0


def recency_bonus(published_at: str, lookback_days: int) -> float:
    """Linear decay across the lookback window. Undated papers get nothing."""
    raw = (published_at or "").strip()
    if not raw:
        return 0.0
    parsed = None
    for fmt in ("%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%d"):
        try:
            parsed = datetime.strptime(raw, fmt).replace(tzinfo=timezone.utc)
            break
        except ValueError:
            continue
    if parsed is None:
        return 0.0
    age_days = (datetime.now(timezone.utc) - parsed).total_seconds() / 86400.0
    window = max(1.0, float(lookback_days))
    fraction_left = max(0.0, 1.0 - (age_days / window))
    return RECENCY_MAX * fraction_left


def score_paper(paper: Dict[str, Any], profile: Dict[str, Any]) -> Dict[str, Any]:
    """Score one paper against the profile and explain the score."""
    keywords = [k for k in profile.get("keywords", []) if k.strip()]
    user_venues = profile.get("venues", [])
    lookback = int(profile.get("lookback_days", 7))

    title = paper.get("title", "")
    abstract = paper.get("abstract", "")

    matched: List[str] = []
    keyword_points = 0.0
    for kw in keywords:
        t_hits = _phrase_hits(kw, title)
        a_hits = _phrase_hits(kw, abstract)
        if t_hits or a_hits:
            matched.append(kw)
            raw = t_hits * TITLE_WEIGHT + min(a_hits, 3) * ABSTRACT_WEIGHT
            keyword_points += min(raw, KEYWORD_CAP)

    venue_points = venue_prestige(paper.get("venue", ""), user_venues)
    recency_points = recency_bonus(paper.get("published_at", ""), lookback)
    overlap_points = MULTI_TOPIC_BONUS * max(0, len(matched) - 1)
    total = keyword_points + venue_points + recency_points + overlap_points

    return {
        "score": round(total, 3),
        "breakdown": {
            "keywords": round(keyword_points, 3),
            "venue": round(venue_points, 3),
            "recency": round(recency_points, 3),
            "topic_overlap": round(overlap_points, 3),
            "matched_keywords": matched,
        },
    }


def rank_papers(
    papers: List[Dict[str, Any]], profile: Dict[str, Any], min_score: float = 0.5
) -> List[Dict[str, Any]]:
    """Score, drop non-matches, and sort best-first.

    Ties break on title so the order is stable and tests are reproducible.
    """
    has_keywords = bool([k for k in profile.get("keywords", []) if k.strip()])
    scored: List[Dict[str, Any]] = []
    for paper in papers:
        result = score_paper(paper, profile)
        # A paper that matches none of the tracked topics must never appear,
        # however new it is or wherever it was published. Recency and venue are
        # boosts on top of relevance, never a substitute for it -- otherwise the
        # briefing fills up with yesterday's unrelated papers.
        if has_keywords and result["breakdown"]["keywords"] <= 0:
            continue
        if result["score"] < min_score:
            continue
        enriched = dict(paper)
        enriched["score"] = result["score"]
        enriched["breakdown"] = result["breakdown"]
        scored.append(enriched)
    scored.sort(key=lambda p: (-p["score"], p.get("title", "")))
    return scored


def keyword_rationale(paper: Dict[str, Any]) -> str:
    """Fallback 'relevant because' line when no model is configured."""
    breakdown = paper.get("breakdown", {})
    matched = breakdown.get("matched_keywords", [])
    bits: List[str] = []
    if matched:
        quoted = ", ".join('"%s"' % m for m in matched[:3])
        bits.append("matches your interest in %s" % quoted)
    if breakdown.get("venue", 0) > 0:
        venue = paper.get("venue") or "a venue you follow"
        bits.append("published in %s" % venue)
    if breakdown.get("topic_overlap", 0) > 0:
        bits.append("sits across %d of your tracked topics" % len(matched))
    if breakdown.get("recency", 0) > 0:
        bits.append("posted inside your lookback window")
    if not bits:
        return "Surfaced by keyword overlap with your profile."
    return (bits[0][0].upper() + bits[0][1:]) + (
        "; " + "; ".join(bits[1:]) if len(bits) > 1 else ""
    ) + "."
