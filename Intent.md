# Intent.md — PRD Draft (Build 1)

Working notes. The required PRD and Build 1 log are published on
[`docs/index.html`](./docs/index.html); this file is not a separate hand-in.

**Build 1 due:** Monday, Nov 9, 2026 at noon, New York time
**Builder:** Piyush Muraleedharan

---

## 1. Who is it for?

- **Target user:** PhD candidates who are accountable for knowing what was
  published in their field this week — the ones whose advisor opens a meeting
  with "did you see the new paper?" They already have Scholar alerts and journal
  TOC emails; the problem is not coverage, it is triage.
- **How I will reach them to test it:** *(to fill in — name 2–3 specific PhD
  students, how you know them, and when you will put this in front of them.)*

## 2. What job does it do?

- **Current painful workflow (before):** Keyword alerts from Google Scholar,
  journal table-of-contents emails and an arXiv feed all land in one inbox. They
  fire on any paper containing the keyword, so the student skims dozens of titles
  to find the two that matter — and most weeks skips it entirely, then hears
  about the paper in a meeting instead.
- **New workflow with this product (after):** Open the app, click once, read a
  ranked briefing of up to eight papers from the chosen window. Each entry names
  which tracked topics it hit, where it was published, and why this researcher
  should care. Mark useful / not useful. Under ten minutes, once a week.
- **Why this is useful:** It is a weekly obligation that currently has no good
  tool. The cost of missing a paper is real and social — being the last person in
  the lab to hear about it.

## 3. What is in and out of scope?

- **One core workflow:** profile → fetch (arXiv + Crossref) → de-duplicate →
  rank against profile → one-line justification per paper → save briefing and
  collect feedback.

- [x] Not building: full-text PDF reading or summarisation (titles, abstracts
      and venue metadata only)
- [x] Not building: email / Slack / push delivery, or any scheduling
- [x] Not building: accounts, login, multi-user (one local profile)
- [x] Not building: citation graphs, author-following, Zotero/Mendeley export

## 4. Rough Local Prototype

- **Local run command:**
  `./.venv/bin/uvicorn app.main:app --reload --port 8000`
- **Evidence:** screenshots in [`docs/img/`](./docs/img/), embedded on the
  Product Page. Real briefing: 8 papers from 20 candidates in 7.3 seconds.

### What worked

Getting the data was the easy part, which I did not expect. arXiv and Crossref
are both free and keyless, so there is no auth, no quota and no cost in the data
layer at all. Writing the ranker as plain arithmetic rather than a model call
meant the whole product works with no API key — useful for demoing, and it makes
the ranking explainable to the user.

### What surprised me

1. **Keyword overlap is not field relevance.** This is the real finding. A
   structural-biology profile tracking "graph neural network" was shown GNN
   papers about traffic forecasting, seizure localisation and aerodynamics. Each
   matches the phrase perfectly and is useless to that researcher. This is now
   the PRD's riskiest assumption and the thing the model layer has to fix.
2. **Academic metadata is dirtier than expected.** Crossref served papers dated
   2029, duplicate DOIs for the same paper, HTML entities in journal names, and
   occasionally an HTML error page instead of JSON.
3. **Bugs lived in the data, not the code.** Four of six defects were only
   visible by running against live APIs and reading the output. Reading the code
   would not have surfaced any of them.
4. **Naive string matching is a trap.** Substring matching handed "Journal of
   Al-Farabi for Engineering **Sciences**" the prestige of *Science*.
