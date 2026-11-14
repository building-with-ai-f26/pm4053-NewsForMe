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
| [`app/`](./app/) | **Build 1 prototype.** Python / FastAPI / SQLite. Runs locally. |
| [`beta/`](./beta/) | **Live beta**, mirrored automatically. TypeScript / Lovable / Supabase / Cloudflare. Do not edit here. |
| [`.github/workflows/sync-beta.yml`](./.github/workflows/sync-beta.yml) | The mirror job that keeps `beta/` current. |

[Icerynk](https://www.icerynk.com/c/fa26-tech-gb-2160-dm2-f2/content) holds the assignment instructions and submissions.

## Two codebases, on purpose

This repo holds two implementations of the same product. That is deliberate,
not leftover clutter.

**[`app/`](./app/) is the Build 1 prototype.** Python, FastAPI, SQLite, no build
step. It is what the Build 1 log and the screenshots on the Product Page
describe, and it still runs — see [Local setup](#local-setup) below. The parts
of the product that are genuinely hard live here: relevance ranking in
[`app/ranking.py`](./app/ranking.py), and feed parsing, de-duplication and
dirty-data handling in [`app/sources.py`](./app/sources.py), both covered by the
51 tests in [`tests/`](./tests/).

**[`beta/`](./beta/) is the live beta.** TypeScript on TanStack Start, built with
Lovable, backed by Supabase and deployed on Cloudflare. Source of truth:
[PiyushM101/newsforme-daily-brief](https://github.com/PiyushM101/newsforme-daily-brief).
Live at [newsforme.fyi](https://newsforme.fyi).

The open question for Build 2 is whether the ranking and source logic in `app/`
ports into the beta intact or has to be re-implemented. That is where this
project's real work sits, so the answer carries a real cost either way.

### How `beta/` stays current

`beta/` is a **read-only mirror**. Editing it here is pointless: the next sync
overwrites your changes. Make changes in the source repo instead.

[`sync-beta.yml`](./.github/workflows/sync-beta.yml) pulls the source repo every
six hours, and on demand from **Actions → Sync beta app → Run workflow** (or
`gh workflow run sync-beta.yml`). Scheduled runs can land 5–20 minutes late;
the manual button is immediate. The source repo is public, so the job needs no
token and stores no secret in either repo.

Two guards, both tested against planted failures before the job shipped:

1. **Nothing outside `beta/` may change.** `docs/` is what GitHub Pages serves,
   and this README and `AGENTS.md` also exist in the source repo, so an
   unguarded sync would overwrite graded files. The job fails instead.
2. **No secrets.** Service-role keys, private keys, provider API keys and any
   `.env` file abort the sync. Supabase *publishable* keys are allowed through,
   since they are designed to ship in client code — which is only safe while
   Row Level Security is enabled on the Supabase tables.

Commits from this job are machine-made mirrors, labelled as such, and are not a
record of hand-written progress.

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
