# Build 1: Intent & Throwaway Prototype

Working notes. The required build log is published on
[`docs/index.html`](../docs/index.html); no separate journal submission is needed.

**Build due:** Monday, Nov 9, 2026 at 12:00 PM (Noon)

---

## 1. What you made

- **Summary of what works now:** A complete local app, not a mock. Research
  profile editor → live fetch from arXiv + Crossref → de-duplication → explainable
  ranking → briefing with a per-paper "why you" line → useful/not-useful feedback
  → briefing history. 51 passing tests. Optional OpenRouter review layer wired in
  and fully skippable.
- **Evidence:** `docs/img/briefing.jpg` and `docs/img/home.jpg`, embedded on the
  Product Page. Real run: 8 papers kept from 20 candidates in 7.3 seconds.
- **Run it:** `./.venv/bin/uvicorn app.main:app --reload --port 8000`

## 2. Metacognition: Terminal, Filesystem & Git

- **Terminus completed (`The Crypt` & `The Vanished Keeper`):** `[ ] Yes`
- **3 diagnostic questions to answer in your own words:**
  1. Why does `./.venv/bin/uvicorn` work while plain `uvicorn` may not? What is a
     virtual environment actually doing to your `PATH`?
  2. `newsforme.db` is in `.gitignore`. What would break for a classmate cloning
     this repo if it were committed instead?
  3. The app reads `OPENROUTER_API_KEY` from `.env`, which is also gitignored.
     Trace how a value gets from that file into `app/llm.py` at runtime.
- **What clicked:** *(fill in)*

## 3. What the agent did

- **Agent / model:** Claude Code (Opus 5).
- **How it was briefed:** `AGENTS.md` rules, chiefly "plan before coding",
  "verify changes" and "stop when looping".
- **Where the human had to step in:** the decision to target PhD candidates
  rather than general news reshaped the whole product — sources became arXiv and
  Crossref rather than RSS, and "reputable journals" became a ranking signal.

## 4. What didn't work

Six defects, all found by running the thing rather than reading the code:

1. **Crossref served papers dated 2029.** Sorting by publication date floats
   future-dated records from low-quality journals to the top. Fixed with an
   explicit `until-pub-date`, relevance sorting, and a code-side rejection.
2. **The same eLife paper appeared twice.** De-duplication keyed on DOI alone;
   eLife mints a DOI per version. Now keyed on DOI *and* normalised title.
3. **A paper matching none of the tracked topics got into a briefing**, carried
   purely by its recency score. Caught by a test. Now at least one keyword match
   is required — venue and recency are boosts, never a substitute for relevance.
4. **"Journal of Al-Farabi for Engineering Sciences" was given the prestige of
   *Science*,** because venue matching was a naive substring test. Now whole-word
   prefix matching.
5. **A briefing took 77.6 seconds.** Crossref queries now run concurrently and
   arXiv retries were cut back: 7.3 seconds.
6. **`export.arxiv.org` returns 429** to any quoted-phrase query from this
   machine. Two fix attempts failed, so per the `AGENTS.md` "stop when looping"
   rule the agent stopped and diagnosed instead — which showed plain category
   queries succeed where quoted ones do not. The query was redesigned to be
   category-only, with keyword matching done locally. Still 429 here, so the app
   degrades to Crossref and records the failure in the briefing trace. **Open.**

## 5. What it cost

- **Agent / token spend this week:** *(fill in)*
- **Hosting / API runtime spend this week:** `$0.00` — both sources are free and
  keyless, and zero model calls were made.
- **Your hours spent this week:** *(fill in)*

## 6. Pod Critique Sign-off

- **Tested by podmate(s):** *(fill in)*
- **Key feedback to address next:** *(fill in)*
