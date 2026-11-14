<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Settings uses one client-side save operation for profile, delivery, topics, and sources through existing database calls; no new database structure is needed.
- Persona answers (student, professional, academia) are stored only as generated text in profiles.role and profiles.about, with a marker first line so the app can read them back; keeps the n8n backend unchanged.
- Keep typography and palette in global CSS tokens and load fonts in the root head so all pages share the same theme.
- Visual theme follows Substack: white page, near-black text, orange #FF6719 for buttons and accents (a darker orange "link" token for small orange text), system sans headings and UI with Inter as fallback, and Spectral serif for reading text. Selected chips use dark pills.
