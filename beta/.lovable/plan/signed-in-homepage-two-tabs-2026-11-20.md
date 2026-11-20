# Signed-in homepage: two tabs

## What signed-in visitors see
The email signup boxes are hidden. In their place, two tabs:

1. **Today's top news** (open by default): the "worth the read" stories from the latest brief sent to that person. Each story shows its topic, headline, a short summary and a "Read" link to the source. Above them, the date it was sent. If nothing has been sent yet: "Your first brief is on its way. Your top stories will show here."
2. **My News Map**: shows a lock and "Coming soon". It can't be opened.

Signed-out visitors see the homepage exactly as it is today.

## What you need to do (outside this app)
1. **Supabase, one time:** run one short line in the SQL editor that adds a "top stories" column to the existing briefings table. No new tables. I'll give you the exact line.
2. **n8n:** when it saves a sent brief, also save the "worth the read" stories into that column, in this shape:
   `[{ "topic": "AI", "title": "...", "summary": "...", "url": "https://..." }]`
   It uses stories Perplexity already returned, so it adds **no extra Perplexity calls**. Storage is a few KB per email.

Until n8n starts saving stories, the tab shows the "on its way" message.

## Cost
- Perplexity: no change.
- Storage: tiny (text only, roughly 2 to 5 KB per brief).
- The homepage reads only the single latest sent brief for the signed-in person.

## Workflow
I'll do it in a draft, then open a PR against main for you to review.

## Technical details
- SQL: `alter table public.briefings add column top_stories jsonb;`. Existing RLS (owner can read their own rows) already covers it.
- src/lib/api.ts: `getLatestStories()` selects `created_at, top_stories` from briefings where status='sent' and kind='daily', ordered by created_at desc, limit 1. It validates the JSON shape and skips bad items.
- src/routes/index.tsx: uses `useSignedIn()`. If signed in, render a new `SignedInHome` (shadcn Tabs, the second tab disabled with a Lock icon and a "Coming soon" badge) in place of both MagicLinkForm sections. Loading state is a skeleton.
- Tests: the JSON parser keeps valid items and drops malformed ones.
