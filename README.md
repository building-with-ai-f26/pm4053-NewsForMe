# NewsForMe

> **One-line pitch:** A weekly research briefing for PhD candidates — it reads the
> week's new papers across arXiv and the journals, keeps the handful that touch
> your dissertation, and tells you in one line why each one is yours.

- **Builder:** Piyush Muraleedharan (`@PiyushM101`)
- **Pod:** [Pod Name / Number]
- **Product Page & Living PRD:** https://building-with-ai-f26.github.io/pm4053-NewsForMe/
- **App:** runs locally through Week 4; add a cloud URL in Build 5.

## Start here: Build 1

**Due Monday, November 9 at noon, New York time.** No class November 3; keep building that week.

1. Join the [class organization](https://github.com/building-with-ai-f26), then use this template to create a **public** repo named `<netid>-<project-slug>`. Ask Christian or Hew if the organization is missing from the owner list.
2. Set up Git and one coding agent during the week of October 27. Follow the [Icerynk setup guide](https://www.icerynk.com/c/fa26-tech-gb-2160-dm2-f2/content/pre-class-setup-github-openrouter-your-coding-agent).
3. Publish [`docs/index.html`](./docs/index.html): **Settings → Pages → Deploy from a branch → main → /docs → Save**. When deployment finishes, open `https://building-with-ai-f26.github.io/<your-repo-name>/`.
4. Fill in PRD v1: a reachable user, their painful before/after workflow, one core workflow, and three non-goals.
5. Build a rough local prototype. Add a screenshot or GIF and an honest Build 1 log to the Product Page, including progress, learning, problems, costs, and hours.
6. Push meaningful commits on **at least two separate days each week outside class**, including the November 3 break.
7. Submit your **Product Page URL and repository URL in Icerynk**. Come ready to demo the prototype in two minutes on November 10.

Create your PostHog account in Week 1. Install it on the Product Page and local app in **Build 2**, then verify events. The Product Page is public from Build 1; the app can stay local through Week 4.

## Repository map

| File / folder | Purpose |
| --- | --- |
| [`docs/index.html`](./docs/index.html) | Required public pitch, living PRD, and weekly build log. Update with actual work and evidence. |
| [`Intent.md`](./Intent.md), [`Plan.md`](./Plan.md), [`journal/`](./journal/) | Optional drafting aids. No duplicate submission is required. |
| [`AGENTS.md`](./AGENTS.md) | Local run commands, project context, and agent rules. Build 2 onward. |
| [`tests/`](./tests/) | Verification guidance. Build 4 offers Track A domain evals **or** Track B user replays. |
| [`SPONSOR_MEMO.md`](./SPONSOR_MEMO.md) | One-page recommendation backed by actual usage, full costs, and risks. Due December 14 at noon. |

[Icerynk](https://www.icerynk.com/c/fa26-tech-gb-2160-dm2-f2/content) holds the assignment instructions and submissions.

## Local setup

Requires Python 3.9 or newer. No Node, no build step, no API key.

```bash
git clone https://github.com/building-with-ai-f26/pm4053-NewsForMe.git
cd pm4053-NewsForMe
python3 -m venv .venv
./.venv/bin/pip install -r requirements.txt
```

Run it:

```bash
./.venv/bin/uvicorn app.main:app --reload --port 8000
```

Then open <http://localhost:8000>, fill in your research profile, and click
**Generate this week's briefing**.

Run the tests (51 tests, no network needed):

```bash
./.venv/bin/python -m pytest tests/ -q
```

### API keys

**NewsForMe runs with no keys at all.** arXiv and Crossref are both free and
keyless, and without a model key the app ranks papers by keyword, venue and
recency and explains each pick from your matched keywords.

Adding an `OPENROUTER_API_KEY` turns on an extra pass that re-ranks the
shortlist, drops papers that only match your keywords by coincidence, and writes
a better "why you" line. To enable it:

```bash
cp .env.example .env
```

then edit `.env`. Keep private keys out of source code, browser code,
screenshots, and commits. The template ignores `.env`; `.env.example` contains
placeholders only.

### How it works

```
research profile (SQLite)
   -> arXiv Atom API + Crossref REST API      (free, no key)
   -> de-duplicate by DOI and normalised title
   -> deterministic keyword / venue / recency scoring
   -> optional OpenRouter review pass          (skipped if unavailable)
   -> briefing saved to SQLite, rendered server-side
```

See [`AGENTS.md`](./AGENTS.md) for the file-by-file map and the engineering
rules, and [`docs/index.html`](./docs/index.html) for the living PRD.

### Known limitation

`export.arxiv.org` currently returns HTTP 429 from the development machine, so
briefings are built from Crossref alone and the arXiv failure is recorded in
each briefing's trace. Fixing or replacing the arXiv source is the first task in
Build 2.
