# My News Map: ideas and a first version

## What it is
A visual picture of what a reader has been following over time, built only from the briefs n8n already saves (the `top_stories` on each past brief, plus the reader's topics). No extra Perplexity calls, so it costs nothing more to run.

## Ideas (pick one to start)

1. **Topic constellation (recommended first version)**
   Each topic is a circle. The more stories it got in the last 30 days, the bigger the circle. Lines join topics that showed up in the same brief. Click a circle to see its past stories with "Why it matters".
2. **Timeline river**
   One row per topic and one column per day. Dots mark days with a story. This shows quiet and busy topics at a glance.
3. **World map**
   Stories pinned to the country they cover. Great for Visa Immigration Updates, but n8n would need to save a `country` field for each story (one small prompt change, no extra calls).
4. **Story threads**
   Related stories over several days get grouped into one ongoing thread, for example "EU AI Act, day 4". This needs n8n to save a short `thread` label for each story.

## Recommended v1: Topic constellation
- Replace the locked "Coming soon" tab with the map.
- Uses the last 30 briefs for the signed-in reader. It only reads data that already exists.
- Empty state: "Your map grows with every brief. Check back after a few days."
- Clicking a topic shows a list of its stories with links and "Why it matters".
- Matches the site's look: dark circles, orange highlights, serif story text.

## Later upgrades
- Add `country` and `thread` to the n8n output to unlock ideas 3 and 4.
- A weekly "your map this week" section in the Sunday email.

## Technical details
- Data: select `created_at, top_stories` from `briefings` for the user, last 30 rows; topics from the existing profile topics. RLS already scopes rows to the user.
- Build the graph client-side: nodes = topics (size = story count), edges = topics that appear together in the same brief.
- Render with plain SVG and a simple force layout (d3-force, small, works when rendered on the server), loaded only in the browser.
- New component `src/components/news-map.tsx`, wired into `home-tabs.tsx`; graph-building helper in `src/lib/domain.ts` with unit tests.
- Work on a branch and open a PR for review.
