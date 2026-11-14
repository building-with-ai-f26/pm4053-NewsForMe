# NewsForMe Daily Brief

Build "NewsForMe", a web app at newsforme.fyi. People sign up and set up a personalized daily news email. A separate n8n backend writes and sends the emails. This app only handles signup, onboarding and settings.

IMPORTANT BACKEND RULES
- Do NOT enable Lovable Cloud and do not create any new database or tables. The database already exists.
- Use @supabase/supabase-js directly with this existing Supabase project:
  - URL: https://xarwkekxuiffkwsxtkhx.supabase.co
  - Publishable key (safe for browser): sb_publishable_EcU0e2U6ryxeiQbesbSQIA_iJrvsO7s
- Put both in one config file (src/lib/supabase.ts). Never use a service or secret key.

EXISTING TABLES (public schema, row level security on; users can only see and edit their own rows)
- profiles: id (uuid, = auth user id), email, full_name (max 100), role (max 100), about (max 1000), timezone (IANA name, default America/New_York), send_hour (0-23, default 8), is_active (bool), onboarding_complete (bool), demo_sent_at, last_sent_at, created_at, updated_at. A row is auto-created on signup. Users can update full_name, role, about, timezone, send_hour, is_active, onboarding_complete.
- topics: id, user_id, name (1-80 chars), description (max 400), position (smallint). Max 5 per user (database enforces it).
- sources: id, user_id, topic_id (nullable; null means "use for all topics"), domain (lowercase bare domain like reuters.com, no https, no www, no path). Max 40 per user. Unique per user + topic + domain.
- briefings (read only): id, user_id, kind ('daily' or 'demo'), status ('sent' or 'failed'), subject, error, created_at.
To replace a user's topics: delete their sources and topics first, then insert the new topics, then insert sources using the new topic ids.

SIGN IN
- Passwordless email link only: supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin + '/auth/callback' } }).
- /auth/callback finishes the session and routes: if profile.onboarding_complete is false go to /onboarding, else /settings.
- Protect /onboarding and /settings. Signed-out users go to /login.

TWO EXTERNAL ENDPOINTS (n8n). Always send header Authorization: Bearer <current supabase session access_token> and Content-Type: application/json.
1) POST https://pm4053.app.n8n.cloud/webhook/newsforme-suggest
   - Body for topic ideas: { "mode": "suggest", "about": string, "role": string }
   - Body for sources of custom topics: { "mode": "sources", "about": string, "role": string, "topics": [names] }
   - Returns { ok: true, topics: [{ name, description, sources: [domains] }] }. Takes 10 to 30 seconds. Show a friendly loading state. On error, show a retry button and still let the user type topics manually.
2) POST https://pm4053.app.n8n.cloud/webhook/newsforme-demo with body {}. Returns 202. Sends the user's first brief once.

PAGES
1. Landing (/): Clear hero: "Your news. Picked for you. In your inbox every morning." Explain in 3 short steps: tell us about you, pick up to 5 topics, choose your sources and time. Show a sample email preview card. Email input that starts the magic link sign in. Short FAQ (Is it free? How do I stop it? Where does the news come from?).
2. /login: email field, send link, then a "check your inbox" state with a resend button (60s cooldown).
3. /onboarding: 4 step wizard with progress bar. Save nothing until the last step, but keep draft state in memory so Back works.
   - Step 1 "About you": full name, role or job title, and a brief about themselves (textarea, max 1000 chars, live counter). Placeholder example: "I lead product at a payments startup in New York. I care about AI, fintech rules, and the startup funding market." Require at least 30 chars in about.
   - Step 2 "Topics": on entering, call suggest with mode "suggest". Show suggested topics as selectable cards (name + description). User can select up to 5 total. Also an "Add your own topic" input. Show a counter "3 of 5 chosen". Block more than 5. Require at least 1.
   - Step 3 "Sources": for each chosen topic, show its sources as removable chips (prefilled from suggestions). For custom topics, call suggest with mode "sources" to prefill. Each topic has an "Add a source" input that cleans what the user types (strip https://, www., paths, lowercase) and validates it looks like a domain. Also a section "Sources for all topics" (topic_id null), empty by default. Note that Reuters and AP are always included.
   - Step 4 "Delivery": hour picker shown in 12-hour format (e.g. 7:00 AM), default 8:00 AM. Timezone dropdown defaulting to the browser timezone (Intl.DateTimeFormat().resolvedOptions().timeZone), searchable list of IANA zones. Summary of their choices. Button "Start my briefings".
   - On finish: update profile (full_name, role, about, timezone, send_hour, is_active true), replace topics and sources, then set onboarding_complete true, then call the demo endpoint. Show a success screen: "Your first brief is on its way. Check your inbox in about 2 minutes." plus a link to settings. If the demo call fails, still show success but say the first brief will arrive at their chosen time.
4. /settings: tabs or sections for Profile (name, role, about), Topics (add, rename, remove, max 5, with "Get suggestions" button that calls suggest), Sources (per topic chips plus all-topics sources), Delivery (hour, timezone, and a "Pause emails" switch mapped to is_active). Each section has its own Save button and a toast on success. If the URL has ?pause=1, scroll to Delivery and highlight the pause switch. Show "Recent briefings" from the briefings table (last 10: date, subject, sent or failed). Sign out button.

DESIGN
- Calm editorial feel, like a well made newspaper. Serif headings (e.g. Fraunces or Newsreader), clean sans body (Inter). Warm off-white background, near-black text, one deep accent color. Supports dark mode. Fully responsive and works well on mobile.
- Copy style: plain words, short sentences under 20 words, no jargon, no em dashes anywhere.
- Footer: "NewsForMe" and a contact email hello@newsforme.fyi.
- Page title "NewsForMe: your daily news brief" and a simple favicon.

Handle loading, empty and error states everywhere. Show database errors as friendly toasts (for example the 5 topic limit).

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/b7d4368d-ab86-4b14-9527-4de039837e03).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
