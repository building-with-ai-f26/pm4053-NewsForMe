# Email subject: highlight only

Change the daily email subject from "Your brief, Nov 20: Fed holds rates steady" to just "Fed holds rates steady".

## What changes (n8n workflow "NewsForMe: Daily Briefings" only)
1. **Assemble Results**: change the writing instructions from `"Your brief, <date>: <biggest story>"` to just the biggest story in 6 words or fewer.
2. **Parse Email**: send the headline as the subject, with no "Your brief, <date>:" in front. The step that strips a leftover "Your brief..." prefix stays as a safety net.
   - If the AI returns no headline, the subject falls back to "Your NewsForMe brief".
   - The first email after signup keeps "Your first NewsForMe brief: <highlight>". Say if you want that changed too.

## How it's done
- Read the live workflow, edit those two nodes, save through the n8n connection (you approve the save), then re-read it to confirm the change is live.
- Nothing changes in the app, so no PR is needed.
- Takes effect on the next brief sent.
