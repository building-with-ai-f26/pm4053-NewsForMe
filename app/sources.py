"""Paper sources: arXiv (preprints) and Crossref (published journal articles).

Both APIs are free and need no key. Parsing is separated from fetching so the
parsers can be unit-tested against saved fixtures with no network access.
"""
import concurrent.futures
import html
import os
import re
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import httpx

ARXIV_API = "https://export.arxiv.org/api/query"
CROSSREF_API = "https://api.crossref.org/works"

# Crossref asks automated clients to identify themselves. A contact address is
# optional and only sent if the builder sets it in .env.
_CONTACT = os.environ.get("CROSSREF_CONTACT_EMAIL", "").strip()
USER_AGENT = "NewsForMe/0.1 (NYU Stern coursework prototype)" + (
    " (mailto:%s)" % _CONTACT if _CONTACT else ""
)

ATOM = "{http://www.w3.org/2005/Atom}"

# arXiv asks automated clients to leave ~3s between requests and answers 429
# if you ignore it. _LAST_ARXIV_CALL enforces the gap across the whole process,
# not just within one retry loop, so a user clicking "generate" twice cannot
# burst past the limit.
ARXIV_MIN_INTERVAL = 3.0
CROSSREF_MIN_INTERVAL = 0.6
_LAST_ARXIV_CALL = 0.0


def _respect_arxiv_rate_limit() -> None:
    global _LAST_ARXIV_CALL
    elapsed = time.time() - _LAST_ARXIV_CALL
    if elapsed < ARXIV_MIN_INTERVAL:
        time.sleep(ARXIV_MIN_INTERVAL - elapsed)
    _LAST_ARXIV_CALL = time.time()

# Journals a PhD candidate is told to watch. Used both to filter Crossref
# results and to boost ranking. Users can add their own in the profile.
REPUTABLE_VENUES = [
    "Nature", "Science", "Cell", "The Lancet",
    "New England Journal of Medicine", "PNAS",
    "Proceedings of the National Academy of Sciences",
    "Nature Machine Intelligence", "Nature Methods", "Nature Medicine",
    "Nature Communications", "Nature Physics", "Nature Neuroscience",
    "Science Advances", "JAMA", "BMJ",
    "Journal of Machine Learning Research",
    "IEEE Transactions on Pattern Analysis and Machine Intelligence",
    "Physical Review Letters", "Journal of Finance",
    "American Economic Review", "Quarterly Journal of Economics",
]


def _clean(text: Optional[str]) -> str:
    """Collapse whitespace and decode HTML entities.

    Crossref hands back things like "Advances in Theoretical &amp; Computation".
    """
    if not text:
        return ""
    return re.sub(r"\s+", " ", html.unescape(text)).strip()


def cutoff_date(lookback_days: int) -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=max(1, int(lookback_days)))


# ------------------------------------------------------------------ arXiv


def build_arxiv_query(categories: List[str], keywords: List[str]) -> str:
    """Build an arXiv ``search_query``.

    Deliberately category-first and quote-free. The obvious query shape --
    ``cat:cs.LG AND all:"protein folding"`` -- is rejected by export.arxiv.org
    with HTTP 429, measured repeatably, while a plain ``cat:`` query returns
    normally. So we ask arXiv only for the recent window of the researcher's
    categories and let ``app.ranking`` do the keyword matching locally. That
    removes the fragile remote query syntax and gives us explainable scoring
    for free.

    Keywords are only used (unquoted) when the researcher set no categories,
    because arXiv needs some term to search on.
    """
    cats = [c.strip() for c in categories if c.strip()]
    if cats:
        return " OR ".join("cat:%s" % c for c in cats)
    kws = [k.strip() for k in keywords if k.strip()][:4]
    if kws:
        # Unquoted single words only; quoted phrases trigger the 429 above.
        words: List[str] = []
        for kw in kws:
            for word in tokenize_for_query(kw):
                if word not in words:
                    words.append(word)
        if words:
            return " OR ".join("all:%s" % w for w in words[:8])
    return "cat:cs.LG"


def tokenize_for_query(phrase: str) -> List[str]:
    """Split a keyword phrase into plain alphanumeric words for arXiv."""
    return [w for w in re.findall(r"[A-Za-z0-9]+", phrase or "") if len(w) > 2]


def parse_arxiv_atom(xml_text: str) -> List[Dict[str, Any]]:
    """Turn an arXiv Atom feed into paper dicts."""
    papers: List[Dict[str, Any]] = []
    root = ET.fromstring(xml_text)
    for entry in root.findall(ATOM + "entry"):
        raw_id = _clean(entry.findtext(ATOM + "id"))
        if not raw_id:
            continue
        authors = [
            _clean(a.findtext(ATOM + "name"))
            for a in entry.findall(ATOM + "author")
            if _clean(a.findtext(ATOM + "name"))
        ]
        categories = [
            c.attrib.get("term", "") for c in entry.findall(ATOM + "category")
        ]
        doi = None
        for link in entry.findall(ATOM + "link"):
            if link.attrib.get("title") == "doi":
                doi = link.attrib.get("href", "").replace("http://dx.doi.org/", "")
        papers.append(
            {
                "external_id": raw_id,
                "source": "arxiv",
                "title": _clean(entry.findtext(ATOM + "title")),
                "abstract": _clean(entry.findtext(ATOM + "summary")),
                "authors": authors,
                "venue": "arXiv preprint"
                + (" (%s)" % categories[0] if categories else ""),
                "doi": doi,
                "url": raw_id,
                "published_at": _clean(entry.findtext(ATOM + "published")),
            }
        )
    return papers


def fetch_arxiv(
    categories: List[str],
    keywords: List[str],
    max_results: int = 120,
    timeout: float = 15.0,
    attempts: int = 2,
) -> List[Dict[str, Any]]:
    """Fetch recent arXiv entries.

    export.arxiv.org frequently stalls or returns an empty feed on the first
    request, so retry a couple of times before giving up.
    """
    params = {
        "search_query": build_arxiv_query(categories, keywords),
        "start": 0,
        "max_results": max_results,
        "sortBy": "submittedDate",
        "sortOrder": "descending",
    }
    last_error: Optional[Exception] = None
    for attempt in range(attempts):
        if attempt:
            # Exponential backoff on top of the base interval: 6s, 12s.
            time.sleep(ARXIV_MIN_INTERVAL * (2 ** attempt))
        _respect_arxiv_rate_limit()
        try:
            resp = httpx.get(
                ARXIV_API, params=params, timeout=timeout,
                headers={"User-Agent": USER_AGENT}, follow_redirects=True,
            )
            if resp.status_code == 429:
                last_error = httpx.HTTPStatusError(
                    "arXiv rate limited (429)", request=resp.request, response=resp
                )
                continue
            resp.raise_for_status()
            papers = parse_arxiv_atom(resp.text)
            if papers or attempt == attempts - 1:
                return papers
        except (httpx.HTTPError, ET.ParseError) as exc:
            last_error = exc
    if last_error is not None:
        raise last_error
    return []


# --------------------------------------------------------------- Crossref


def parse_crossref(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Turn a Crossref /works response into paper dicts."""
    papers: List[Dict[str, Any]] = []
    for item in payload.get("message", {}).get("items", []):
        doi = item.get("DOI")
        if not doi:
            continue
        titles = item.get("title") or []
        title = _clean(titles[0]) if titles else ""
        if not title:
            continue
        containers = item.get("container-title") or []
        authors = []
        for a in item.get("author", []) or []:
            name = _clean("%s %s" % (a.get("given", ""), a.get("family", "")))
            if name:
                authors.append(name)
        published = ""
        for key in ("published", "published-online", "published-print", "issued"):
            parts = (item.get(key) or {}).get("date-parts") or []
            if parts and parts[0] and parts[0][0]:
                nums = [n for n in parts[0] if isinstance(n, int)]
                while len(nums) < 3:
                    nums.append(1)
                published = "%04d-%02d-%02d" % (nums[0], nums[1], nums[2])
                break
        papers.append(
            {
                "external_id": "doi:%s" % doi,
                "source": "crossref",
                "title": title,
                "abstract": _clean(re.sub(r"<[^>]+>", " ", item.get("abstract", "") or "")),
                "authors": authors,
                "venue": _clean(containers[0]) if containers else "",
                "doi": doi,
                "url": item.get("URL", "https://doi.org/%s" % doi),
                "published_at": published,
            }
        )
    return papers


def fetch_crossref(
    keywords: List[str],
    lookback_days: int,
    rows: int = 12,
    timeout: float = 15.0,
) -> List[Dict[str, Any]]:
    """Recent journal articles matching the researcher's keywords.

    Two deliberate choices, both learned from bad results:

    * One query per keyword, sorted by relevance. A single joined query string
      ("a b c") matches loosely and fills the page with unrelated papers.
    * An explicit ``until-pub-date`` of today. Crossref carries records dated
      years in the future, and sorting by publication date floats that junk to
      the top of every result set.
    """
    terms = [k.strip() for k in keywords if k.strip()][:5]
    if not terms:
        return []
    since = cutoff_date(lookback_days).strftime("%Y-%m-%d")
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    def fetch_one(term: str) -> List[Dict[str, Any]]:
        params = {
            "query.bibliographic": term,
            "filter": "from-pub-date:%s,until-pub-date:%s,type:journal-article,has-abstract:true"
            % (since, today),
            "rows": rows,
            "sort": "relevance",
            "order": "desc",
            "select": "DOI,title,abstract,author,container-title,URL,published,issued",
        }
        try:
            resp = httpx.get(
                CROSSREF_API, params=params, timeout=timeout,
                headers={"User-Agent": USER_AGENT}, follow_redirects=True,
            )
            resp.raise_for_status()
            return parse_crossref(resp.json())
        except (httpx.HTTPError, ValueError, KeyError):
            # Crossref intermittently answers with an HTML error page instead
            # of JSON. One bad term must not sink the whole fetch.
            return []

    # Run the terms in parallel: serially this was the single slowest part of
    # a briefing. Workers are capped so we stay a polite client.
    collected: List[Dict[str, Any]] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=min(4, len(terms))) as pool:
        for result in pool.map(fetch_one, terms):
            collected.extend(result)
    return collected


# ------------------------------------------------------------------ merge


def _norm_title(title: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", title.lower())


def dedupe(papers: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Drop duplicates by DOI *and* by normalized title.

    Both keys are needed. Checking the DOI alone is not enough: journals such
    as eLife mint a separate DOI per version, so the same paper arrives twice
    with different DOIs and identical titles. Checking the title alone is not
    enough either, because titles get truncated or re-punctuated between
    sources.

    When a preprint and a published record collide, the published (Crossref)
    record wins, because the venue is what the user is tracking.
    """
    entries: List[Dict[str, Any]] = []
    doi_index: Dict[str, int] = {}
    title_index: Dict[str, int] = {}

    for paper in papers:
        doi = (paper.get("doi") or "").lower().strip()
        title_key = _norm_title(paper.get("title", ""))
        if not doi and not title_key:
            continue

        position = None
        if doi and doi in doi_index:
            position = doi_index[doi]
        elif title_key and title_key in title_index:
            position = title_index[title_key]

        if position is None:
            entries.append(paper)
            position = len(entries) - 1
        else:
            existing = entries[position]
            if existing.get("source") == "arxiv" and paper.get("source") == "crossref":
                entries[position] = paper

        if doi:
            doi_index.setdefault(doi, position)
        if title_key:
            title_index.setdefault(title_key, position)

    return entries


def within_lookback(papers: List[Dict[str, Any]], lookback_days: int) -> List[Dict[str, Any]]:
    """Keep papers published inside the window; keep undated ones."""
    cutoff = cutoff_date(lookback_days)
    kept: List[Dict[str, Any]] = []
    for paper in papers:
        raw = (paper.get("published_at") or "").strip()
        if not raw:
            kept.append(paper)
            continue
        parsed = None
        for fmt in ("%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%d"):
            try:
                parsed = datetime.strptime(raw, fmt).replace(tzinfo=timezone.utc)
                break
            except ValueError:
                continue
        if parsed is None:
            kept.append(paper)
            continue
        # Reject records dated in the future: they are a data-quality signal,
        # not news. Crossref has plenty of them.
        if parsed > datetime.now(timezone.utc) + timedelta(days=1):
            continue
        if parsed >= cutoff:
            kept.append(paper)
    return kept
