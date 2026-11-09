"""The one core workflow: profile -> fetch -> dedupe -> rank -> review -> save.

Everything the user actually paid attention to happens here. Each stage records
what it did in `notes` so the briefing page can show an honest trace instead of
pretending the pipeline is magic.
"""
import sqlite3
import time
from typing import Any, Dict, List

from app import db, llm, ranking, sources

SHORTLIST_SIZE = 12
BRIEFING_SIZE = 8


def generate_briefing(
    conn: sqlite3.Connection,
    profile: Dict[str, Any],
    shortlist_size: int = SHORTLIST_SIZE,
    briefing_size: int = BRIEFING_SIZE,
) -> int:
    """Run the full workflow and return the new briefing id."""
    started = time.time()
    notes: List[str] = []
    lookback = int(profile.get("lookback_days", 7))

    # 1. Fetch. A dead source must not kill the run.
    raw: List[Dict[str, Any]] = []
    try:
        arxiv_papers = sources.fetch_arxiv(
            profile.get("arxiv_categories", []), profile.get("keywords", [])
        )
        raw.extend(arxiv_papers)
        notes.append("arXiv returned %d" % len(arxiv_papers))
    except Exception as exc:
        notes.append("arXiv failed (%s)" % type(exc).__name__)

    try:
        cr_papers = sources.fetch_crossref(profile.get("keywords", []), lookback)
        raw.extend(cr_papers)
        notes.append("Crossref returned %d" % len(cr_papers))
    except Exception as exc:
        notes.append("Crossref failed (%s)" % type(exc).__name__)

    # 2. Dedupe + date window.
    merged = sources.dedupe(raw)
    fresh = sources.within_lookback(merged, lookback)
    notes.append("%d unique, %d inside %d-day window" % (len(merged), len(fresh), lookback))

    # 3. Deterministic ranking.
    ranked = ranking.rank_papers(fresh, profile)
    notes.append("%d scored above threshold" % len(ranked))
    shortlist = ranked[:shortlist_size]
    for paper in shortlist:
        paper["rationale"] = ranking.keyword_rationale(paper)
        paper["rationale_source"] = "keywords"

    # 4. Optional model review. Fall back silently to the keyword ranking.
    meta: Dict[str, Any] = {"model_used": "deterministic-only"}
    final = shortlist
    if shortlist and llm.is_configured():
        try:
            results, usage = llm.review_papers(shortlist, profile)
            final = llm.apply_reviews(shortlist, results)
            meta.update(usage)
            notes.append(
                "model reviewed %d, kept %d" % (len(shortlist), len(final))
            )
        except llm.LLMUnavailable as exc:
            notes.append("model review skipped: %s" % str(exc)[:120])
    elif shortlist:
        notes.append("no OPENROUTER_API_KEY, keyword ranking only")

    final = final[:briefing_size]

    # 5. Persist.
    briefing_id = db.create_briefing(
        conn,
        {
            "lookback_days": lookback,
            "candidate_count": len(fresh),
            "item_count": len(final),
            "model_used": meta.get("model_used", "deterministic-only"),
            "prompt_tokens": meta.get("prompt_tokens", 0),
            "completion_tokens": meta.get("completion_tokens", 0),
            "duration_ms": int((time.time() - started) * 1000),
            "notes": " · ".join(notes),
        },
    )
    for rank, paper in enumerate(final, start=1):
        paper_id = db.upsert_paper(conn, paper)
        db.add_briefing_item(
            conn,
            briefing_id,
            {
                "paper_id": paper_id,
                "rank": rank,
                "score": paper.get("score", 0.0),
                "breakdown": paper.get("breakdown", {}),
                "rationale": paper.get("rationale", ""),
                "rationale_source": paper.get("rationale_source", "keywords"),
            },
        )
    return briefing_id
