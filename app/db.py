"""SQLite storage for NewsForMe.

One local file, no ORM. Every table is created on startup if missing so a fresh
clone works with no migration step.
"""
import json
import os
import sqlite3
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

DB_PATH = os.environ.get("NEWSFORME_DB", "newsforme.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS profile (
    id              INTEGER PRIMARY KEY CHECK (id = 1),
    display_name    TEXT NOT NULL DEFAULT '',
    field           TEXT NOT NULL DEFAULT '',
    keywords        TEXT NOT NULL DEFAULT '[]',
    venues          TEXT NOT NULL DEFAULT '[]',
    arxiv_categories TEXT NOT NULL DEFAULT '[]',
    lookback_days   INTEGER NOT NULL DEFAULT 7,
    updated_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS papers (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    external_id   TEXT NOT NULL UNIQUE,
    source        TEXT NOT NULL,
    title         TEXT NOT NULL,
    abstract      TEXT NOT NULL DEFAULT '',
    authors       TEXT NOT NULL DEFAULT '[]',
    venue         TEXT NOT NULL DEFAULT '',
    doi           TEXT,
    url           TEXT NOT NULL DEFAULT '',
    published_at  TEXT NOT NULL DEFAULT '',
    fetched_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS briefings (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at      TEXT NOT NULL,
    lookback_days   INTEGER NOT NULL,
    candidate_count INTEGER NOT NULL DEFAULT 0,
    item_count      INTEGER NOT NULL DEFAULT 0,
    model_used      TEXT NOT NULL DEFAULT 'deterministic-only',
    prompt_tokens   INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER NOT NULL DEFAULT 0,
    duration_ms     INTEGER NOT NULL DEFAULT 0,
    notes           TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS briefing_items (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    briefing_id  INTEGER NOT NULL REFERENCES briefings(id) ON DELETE CASCADE,
    paper_id     INTEGER NOT NULL REFERENCES papers(id),
    rank         INTEGER NOT NULL,
    score        REAL NOT NULL,
    breakdown    TEXT NOT NULL DEFAULT '{}',
    rationale    TEXT NOT NULL DEFAULT '',
    rationale_source TEXT NOT NULL DEFAULT 'keywords'
);

CREATE TABLE IF NOT EXISTS feedback (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    paper_id    INTEGER NOT NULL REFERENCES papers(id),
    briefing_id INTEGER,
    vote        TEXT NOT NULL,
    created_at  TEXT NOT NULL
);
"""


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def connect(path: Optional[str] = None) -> sqlite3.Connection:
    conn = sqlite3.connect(path or DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db(path: Optional[str] = None) -> None:
    conn = connect(path)
    try:
        conn.executescript(SCHEMA)
        conn.commit()
    finally:
        conn.close()


# ---------------------------------------------------------------- profile

DEFAULT_PROFILE: Dict[str, Any] = {
    "display_name": "",
    "field": "",
    "keywords": [],
    "venues": [],
    "arxiv_categories": [],
    "lookback_days": 7,
}


def get_profile(conn: sqlite3.Connection) -> Optional[Dict[str, Any]]:
    row = conn.execute("SELECT * FROM profile WHERE id = 1").fetchone()
    if row is None:
        return None
    return {
        "display_name": row["display_name"],
        "field": row["field"],
        "keywords": json.loads(row["keywords"]),
        "venues": json.loads(row["venues"]),
        "arxiv_categories": json.loads(row["arxiv_categories"]),
        "lookback_days": row["lookback_days"],
        "updated_at": row["updated_at"],
    }


def save_profile(conn: sqlite3.Connection, profile: Dict[str, Any]) -> None:
    conn.execute(
        """
        INSERT INTO profile (id, display_name, field, keywords, venues,
                             arxiv_categories, lookback_days, updated_at)
        VALUES (1, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            display_name = excluded.display_name,
            field = excluded.field,
            keywords = excluded.keywords,
            venues = excluded.venues,
            arxiv_categories = excluded.arxiv_categories,
            lookback_days = excluded.lookback_days,
            updated_at = excluded.updated_at
        """,
        (
            profile.get("display_name", ""),
            profile.get("field", ""),
            json.dumps(profile.get("keywords", [])),
            json.dumps(profile.get("venues", [])),
            json.dumps(profile.get("arxiv_categories", [])),
            int(profile.get("lookback_days", 7)),
            now_iso(),
        ),
    )
    conn.commit()


# ---------------------------------------------------------------- papers


def upsert_paper(conn: sqlite3.Connection, paper: Dict[str, Any]) -> int:
    """Insert a paper if new; always return its row id."""
    conn.execute(
        """
        INSERT INTO papers (external_id, source, title, abstract, authors,
                            venue, doi, url, published_at, fetched_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(external_id) DO UPDATE SET
            title = excluded.title,
            abstract = excluded.abstract,
            venue = excluded.venue,
            url = excluded.url
        """,
        (
            paper["external_id"],
            paper.get("source", ""),
            paper.get("title", ""),
            paper.get("abstract", ""),
            json.dumps(paper.get("authors", [])),
            paper.get("venue", ""),
            paper.get("doi"),
            paper.get("url", ""),
            paper.get("published_at", ""),
            now_iso(),
        ),
    )
    conn.commit()
    row = conn.execute(
        "SELECT id FROM papers WHERE external_id = ?", (paper["external_id"],)
    ).fetchone()
    return int(row["id"])


def _paper_from_row(row: sqlite3.Row) -> Dict[str, Any]:
    return {
        "id": row["id"],
        "external_id": row["external_id"],
        "source": row["source"],
        "title": row["title"],
        "abstract": row["abstract"],
        "authors": json.loads(row["authors"]),
        "venue": row["venue"],
        "doi": row["doi"],
        "url": row["url"],
        "published_at": row["published_at"],
    }


# ------------------------------------------------------------- briefings


def create_briefing(conn: sqlite3.Connection, meta: Dict[str, Any]) -> int:
    cur = conn.execute(
        """
        INSERT INTO briefings (created_at, lookback_days, candidate_count,
                               item_count, model_used, prompt_tokens,
                               completion_tokens, duration_ms, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            now_iso(),
            int(meta.get("lookback_days", 7)),
            int(meta.get("candidate_count", 0)),
            int(meta.get("item_count", 0)),
            meta.get("model_used", "deterministic-only"),
            int(meta.get("prompt_tokens", 0)),
            int(meta.get("completion_tokens", 0)),
            int(meta.get("duration_ms", 0)),
            meta.get("notes", ""),
        ),
    )
    conn.commit()
    return int(cur.lastrowid)


def add_briefing_item(conn: sqlite3.Connection, briefing_id: int, item: Dict[str, Any]) -> None:
    conn.execute(
        """
        INSERT INTO briefing_items (briefing_id, paper_id, rank, score,
                                    breakdown, rationale, rationale_source)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            briefing_id,
            int(item["paper_id"]),
            int(item["rank"]),
            float(item["score"]),
            json.dumps(item.get("breakdown", {})),
            item.get("rationale", ""),
            item.get("rationale_source", "keywords"),
        ),
    )
    conn.commit()


def get_briefing(conn: sqlite3.Connection, briefing_id: int) -> Optional[Dict[str, Any]]:
    row = conn.execute("SELECT * FROM briefings WHERE id = ?", (briefing_id,)).fetchone()
    if row is None:
        return None
    briefing = dict(row)
    items: List[Dict[str, Any]] = []
    item_rows = conn.execute(
        """
        SELECT bi.*, p.* FROM briefing_items bi
        JOIN papers p ON p.id = bi.paper_id
        WHERE bi.briefing_id = ?
        ORDER BY bi.rank ASC
        """,
        (briefing_id,),
    ).fetchall()
    for r in item_rows:
        paper = _paper_from_row(r)
        votes = conn.execute(
            "SELECT vote FROM feedback WHERE paper_id = ? AND briefing_id = ?",
            (paper["id"], briefing_id),
        ).fetchall()
        items.append(
            {
                "rank": r["rank"],
                "score": r["score"],
                "breakdown": json.loads(r["breakdown"]),
                "rationale": r["rationale"],
                "rationale_source": r["rationale_source"],
                "paper": paper,
                "vote": votes[-1]["vote"] if votes else None,
            }
        )
    briefing["items"] = items
    return briefing


def list_briefings(conn: sqlite3.Connection, limit: int = 20) -> List[Dict[str, Any]]:
    rows = conn.execute(
        "SELECT * FROM briefings ORDER BY id DESC LIMIT ?", (limit,)
    ).fetchall()
    return [dict(r) for r in rows]


def latest_briefing_id(conn: sqlite3.Connection) -> Optional[int]:
    row = conn.execute("SELECT id FROM briefings ORDER BY id DESC LIMIT 1").fetchone()
    return int(row["id"]) if row else None


def record_feedback(conn: sqlite3.Connection, paper_id: int, briefing_id: Optional[int], vote: str) -> None:
    conn.execute(
        "INSERT INTO feedback (paper_id, briefing_id, vote, created_at) VALUES (?, ?, ?, ?)",
        (paper_id, briefing_id, vote, now_iso()),
    )
    conn.commit()


def feedback_counts(conn: sqlite3.Connection) -> Dict[str, int]:
    rows = conn.execute("SELECT vote, COUNT(*) c FROM feedback GROUP BY vote").fetchall()
    return {r["vote"]: int(r["c"]) for r in rows}
