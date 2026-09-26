# Context

**Understand before you interpret.** A study workspace for the New Testament: the text first, then its structure, history, language and the range of credible interpretation — with every claim labelled and every source shown.

Product #2 of *3 Products in 30 Days*.

## What it does

- **All 260 NT chapters** in English (WEB), Amharic (1962), side by side, or as a Greek interlinear. Tap any Greek word for its lexicon entry.
- **Seven steps, in order:** Read · Observe · Context · Language · Connections · Interpretations · Reflect.
- **Six provenance labels** on every claim: Explicit · Strong inference · Historical evidence · Scholarly interpretation · Tradition · Personal reflection.
- **Show me why** on every claim: claim → evidence verse → source (tier, orientation, locator) → how it was produced.
- **Text or Assumption?** — a quiz that asks you to label statements before revealing the answer, plus a checker for your own statements.
- **Ask** — questions answered only from Context's evidence, sentence-by-sentence labelled and cited, or an honest "not enough evidence".
- **Notebook** — private reflections, kept apart from claims, and your assumption score.

## The trust architecture

**The AI is not the database.** Claude never supplies facts; it arranges evidence we hand it.

```
open-licensed data ──► Postgres ──► evidence pack (V: verses, L: lexicon, X: cross-refs, C: claims)
                                          │
                                          ▼
                              Claude (structured JSON output)
                                          │
                                          ▼
                      validator (lib/ai/validate.ts — pure, unit-tested)
                        · citations must exist in the evidence pack
                        · no citation → claim dropped
                        · "explicit" must cite a verse
                        · "historical" must cite lexical evidence
                        · quotes must appear word-for-word in the verse
                        · "God is telling you…" language is rejected
                                          │
                                          ▼
               claims + citations + anchors (status = unverified draft)
                                          │
                     a person checks the sources and presses Verify
                                          │
                                          ▼
      Postgres trigger: no "verified" without a checked citation;
      scholarly/historical claims need a checked tier 2–4 source
```

Every model call is logged in `ai_runs` with the evidence it saw and what the validator removed.

## Sources

| Source | Used for | License |
|---|---|---|
| World English Bible (eBible.org) | English text, all 66 books | Public domain |
| Amharic Bible 1962 (Bible Society of Ethiopia / UBS, via eBible.org) | Amharic NT | Non-commercial use with full copyright statement |
| SBL Greek New Testament | Greek text (words marked SBL in TAGNT) | CC BY 4.0 |
| STEP Bible TAGNT, TBESG (Tyndale House, Cambridge) | Greek tagging, glosses, Abbott-Smith lexicon | CC BY 4.0 |
| OpenBible.info cross-references | Connections | CC BY |

Copyrighted scholarship (BDAG, Louw-Nida, academic commentaries) is never displayed and never cited by the AI. It can be added as a cited-only source once a person has checked each reference.

**Known text issue:** the Amharic e-text merges or omits some verses (e.g. Eph 3:5–7 shows only verse 7). Use "Report a problem in this text" in Read.

## Stack

Next.js 16 (App Router) · PostgreSQL (raw SQL via `postgres`) · Claude API (`claude-opus-5`, structured outputs, server-side refusal fallbacks) · Tailwind 4 · Vitest.

## Run it locally

```bash
npm install
npm run data:fetch      # downloads the open-licensed source files (~100 MB) into data/raw
createdb context_dev
cp .env.example .env.local   # set DATABASE_URL (and ANTHROPIC_API_KEY for the AI features)
npm run db:migrate
npm run db:import       # ~5 seconds: 31k verses, 137k Greek words, 11k lexicon entries, 114k cross-refs
npm run dev             # http://localhost:3000
```

- `npm test` — reference parser + validator tests
- `npm run study:generate -- "Eph 3" "John 1"` — prepare chapter studies ahead of time
- `CONTEXT_CURATOR=1` in `.env.local` — shows the **Verify** button (local curation only)

## Project map

```
db/migrations/        schema, triggers, constraints (the rules live here)
scripts/              import (ETL), migrate, generate, smoke test
lib/bible/            book ids + reference parser
lib/ai/               client, evidence pack, validator, ask / text-or-assumption
lib/study/generate.ts chapter study: prompt → schema → validate → save
lib/data/             queries the pages read
app/                  landing, /study, workspace, /notebook, /sources, /api/*
components/           workspace shell, steps, claim + "Show me why"
```
