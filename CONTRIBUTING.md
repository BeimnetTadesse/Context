# Contributing to Context

Thanks for helping. Context is a Bible study workspace built on one idea: **understand before you interpret**,
so every claim is labelled and every source is shown. Changes are welcome as long as they keep that promise.

## Getting set up

Follow **Run it locally** in the [README](README.md). You need Node 20+ and PostgreSQL. A free Gemini key is
enough to generate studies and use Ask; everything else is optional:

| Key | What it adds | Without it |
|---|---|---|
| `GEMINI_API_KEY` | Chapter studies, Ask, Text or Assumption? | Reading, versions, Greek and commentaries still work |
| `API_BIBLE_KEY` | NIV, NLT, NASB | Those versions say "unavailable" |
| `YVP_APP_KEY` | NASV, AMP, TPT | Those versions say "unavailable" |
| `AUTH_SECRET`, `AUTH_GOOGLE_*` | Google sign-in | Notes are kept per device |

Never commit `.env.local` or any key.

## How changes get in

1. Make a branch from `main` (e.g. `fix/verse-numbering`, `feat/greek-search`).
2. Keep each pull request to one change, with a message that says **what** changed and **why**.
3. Before you push, run the same checks CI runs:
   ```bash
   npm run lint && npm run typecheck && npm test && npm run build
   ```
4. Open a pull request. CI must pass, and the maintainer checks the preview before merging.

Add or update a test when you change logic that could go wrong without crashing, like verse numbering,
the validator or the reference parser. Tests sit next to the code (`*.test.ts`).

## House rules (please read)

These protect readers and the licences Context depends on:

- **Bible text never comes from the AI.** Every verse is read from the database or a licensed provider.
- **Licensed text never goes to the AI.** NIV, NLT, NASB, NASV, AMP and TPT are fetched live, display only,
  never stored in the database, and never copyable. Ask sends a verse *reference* for them, never the wording.
- **Every AI claim must cite evidence from the pack**, and pass `lib/ai/validate.ts`. Don't loosen the
  validator or the database trigger to make output pass; fix the prompt or the evidence instead.
- **Keep the labels honest.** A claim isn't "verified" until a person has checked its sources.
- **New sources need a licence that allows the use.** Add them to the source library (`/sources`) with
  their tier and licence, and their notice to `/copyright` if required.
- **Never run `npm run db:import` on a database with studies or notes**: it empties the database first.

## Where things live

See the project map in the [README](README.md). Versions are defined once in `lib/versions.ts`; books and
chapter counts in `lib/bible/books.ts`; required copyright statements in `lib/notices.ts`.
