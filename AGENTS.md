# AGENTS.md — Coding Agent Operating Manual

> Give this file to your coding agent and check that it is using these instructions.

## 1. Project Overview
- **What this repo builds:** NewsForMe, a weekly research briefing for PhD
  candidates. It pulls the week's new papers from arXiv and Crossref, ranks them
  against a stored research profile, and explains in one line why each paper
  matters to that specific researcher.
- **Primary user & core workflow:** See the living PRD in `docs/index.html`.
  The one core workflow is: profile → fetch → de-duplicate → rank → explain →
  save briefing → collect useful/not-useful feedback.
- **Tech stack:** Python 3.9+ / FastAPI / Jinja2 (server-rendered, no build
  step) / SQLite / httpx. Optional model review through OpenRouter.

## 2. Commands

Run everything from the repository root.

```bash
python3 -m venv .venv                      # first time only
./.venv/bin/pip install -r requirements.txt
```

- **Run locally:** `./.venv/bin/uvicorn app.main:app --reload --port 8000`
  then open <http://localhost:8000>
- **Run tests:** `./.venv/bin/python -m pytest tests/ -q` (51 tests, no network)
- **Health check:** `curl localhost:8000/health`
- **Reset local data:** `rm newsforme.db` (recreated on next start)

## 3. Architecture map

| File | Responsibility |
| --- | --- |
| `app/main.py` | FastAPI routes and templating. Thin on purpose. |
| `app/pipeline.py` | The core workflow, start to finish. Read this first. |
| `app/sources.py` | arXiv + Crossref fetching, parsing, de-duplication. |
| `app/ranking.py` | Deterministic relevance scoring. No model calls. |
| `app/llm.py` | Optional OpenRouter review. Must always be skippable. |
| `app/db.py` | SQLite schema and queries. |

## 4. Non-Negotiable Engineering Rules
1. **Plan before coding:** Before touching multiple files, propose a brief plan
   and wait for approval.
2. **Small batches:** Make small, focused changes a human can review and explain
   in a single Pull Request.
3. **Explainability:** Avoid unnecessary abstractions or dependencies. Explain
   what changed, why it matters, what could break, and how it was checked.
4. **Verify changes:** Run the tests. For a reproducible logic bug, add a
   failing test first. Record manual checks and known limitations.
5. **Zero secrets in code:** Never hardcode API keys or tokens. Read from
   environment variables (`.env`) and update `.env.example` when adding one.
6. **Stop when looping:** If a fix fails twice in a row, stop, summarise what
   failed, and ask the human before a third approach. *(This rule earned its
   place in Build 1: it converted an arXiv retry loop into a diagnosis, which is
   what produced the category-only query redesign.)*

## 5. Project-specific rules
7. **The model layer is never load-bearing.** The app must produce a briefing
   with no `OPENROUTER_API_KEY`, when OpenRouter errors, and when the model
   returns unparseable output. Any change that can make a briefing fail because
   of the model is wrong.
8. **Ranking changes need a test.** Relevance is the product. A change to
   `app/ranking.py` without a test in `tests/test_ranking.py` will be rejected.
9. **Never trust a feed.** Both sources return malformed records in practice:
   future-dated papers, duplicate DOIs per version, HTML entities, missing
   abstracts, and HTML error pages instead of JSON. Parse defensively and keep
   fixtures for anything new you hit.
10. **A failing source degrades, it does not crash.** Record the failure in the
    briefing's `notes` trace so the user can see what happened.
11. **Respect the sources.** arXiv asks for roughly one request every three
    seconds and returns 429 otherwise. Do not remove the rate limiting.
