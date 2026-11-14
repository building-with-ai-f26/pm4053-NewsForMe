# Structured "About you" by persona

Replace the free-text "about" box with short, guided questions per persona. Answers are turned into the same `role` and `about` text the email system already reads, so nothing changes on the backend.

## What the user sees (onboarding step 1, and Profile in settings)

1. Full name (as today).
2. "Which describes you?" three cards: Student, Working professional, Academia.
3. Persona questions (dropdowns with an "Other" free-text option, plus short text fields):

**Student**

- Degree (MBA, MS, BS/BA, MD, JD, Other) and school (optional)
- Specializations (chips, up to 3)
- Prior experience, optional: function + industry
- Post-degree goal: function + industry
- Geography of prior experience, and of target jobs
- Niche interests (chips, e.g. agentic commerce, robotics in mobility)

**Working professional**

- Seniority (Entry, Mid, Senior, Lead/Manager, Director, VP, C-level/Founder)
- Industry, Function
- Future goals (short text or chips)

**Academia**

- Level (PhD student, Postdoc, Assistant/Associate/Full Professor, Researcher)
- Degree / field of research
- Research overview, 20 to 50 characters

4. A small "Here is what we will use" preview showing the generated summary.
5. Add an optional section for the user to add more details across personas 

The 300-character minimum is removed. Instead, required fields per persona must be filled before Next / Save.

## How it maps to existing data (no backend change)

- `role` (max 100): e.g. "MBA student, NYU Stern" / "Senior Product Manager, AdTech" / "PhD student, Computational Biology".
- `about` (max 1000): labeled lines, e.g.
`Persona: Student | Degree: MBA | Specializations: Strategy, Tech | Prior: Consulting in Healthcare (India) | Goal: Product in AI (US) | Interests: agentic commerce, robotics in mobility`
- The first line carries a marker so settings can read answers back into the form. Older profiles with free text open in the form with the old text kept as "Other notes" until re-saved.

## Technical details

- New `src/lib/persona.ts`: option lists, `buildRole`, `buildAbout`, `parseAbout`, `isComplete(persona, answers)`; trims to 100/1000.
- New `PersonaForm` component in `src/components/persona-form.tsx`, used by onboarding step 1 and the settings Profile section (single Save stays).
- Topic suggestions still receive `about` and `role`, now richer and consistent.
- Remove `MIN_ABOUT`; update tests: build/parse round-trip, required-field rules per persona, academia overview 20-50 chars, length caps.
- Update README/AGENTS rule on how persona answers are stored.