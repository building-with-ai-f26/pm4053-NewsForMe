# Verification: Tests, Evals & User Feedback

## Running the tests

```bash
./.venv/bin/python -m pytest tests/ -q
```

51 tests, roughly half a second, **no network access**. Every API response is a
saved fixture and both sources are monkeypatched in the pipeline tests, so the
suite cannot be broken by arXiv being down or by Crossref changing its results.

| File | What it protects |
| --- | --- |
| `test_sources.py` | Atom/JSON parsing, de-duplication, the date window. The layer most likely to break silently when an API changes shape. |
| `test_ranking.py` | Relevance scoring. Relevance is the product, so a ranking regression must fail here rather than in front of a user. |
| `test_llm.py` | The model **failure** path: bad JSON, hallucinated indexes, missing keys, garbage entries. |
| `test_pipeline.py` | The core workflow, including a dead source, both sources dead, and the model erroring mid-run. |
| `test_web.py` | Routes, form parsing, input clamping, 404s. |

## What these tests do not check

- **Whether a paper is actually worth reading.** The suite checks that ranking is
  deterministic, explainable and self-consistent. It cannot check that the
  ranking is *right* for a researcher. That is a human judgement and it is what
  the Build 4 eval is for.
- **Live API behaviour.** Deliberately. The known live failure —
  `export.arxiv.org` returning 429 — is covered only as "the pipeline survives a
  dead source" (`test_briefing_survives_a_dead_source`).
- **Anything about the model's output quality.** Only its failure modes.

## Build 4: choose one track

**Track A — Domain quality** (current plan). Define 3–4 rules for a good
briefing, then evaluate 10 cases: 5 normal, 3 messy, 2 adversarial. The
adversarial cases write themselves from Build 1: papers that match a tracked
keyword exactly but sit in a completely different field. Compare before/after
turning on the model review layer, and have one outside PhD student review the
result.

**Track B — User friction.** Watch 3–5 outside users try the product without
coaching, review PostHog replays, fix the top three friction points.

Both tracks update PRD v4 and the build log on `docs/index.html`.
