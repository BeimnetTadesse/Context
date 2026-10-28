# Context

**Understand before you interpret.** A study workspace for the whole Bible: the text first, then its structure, history, language and the range of credible interpretation, with every claim labelled and every source shown.

**https://www.context1.io**

## What it does

- **All 66 books and 1,189 chapters**, studied in seven steps and in this order: Read · Observe · Context · Language · Connections · Interpretations · Reflect.
  - **New Testament (260 chapters):** every step, with a prepared study for each chapter.
  - **Old Testament (929 chapters):** reading, structure, commentators, Church Fathers, cross-references and the Hebrew interlinear. The AI-prepared steps (Context, Language, Interpretations, Reflect) are still being prepared and say so.
- **Many versions, side by side.**
  - Stored locally: WEB, BSB, KJV, ASV, YLT and the Amharic 1962 (1954 E.C.) Bible (all of the NT; 913 of 929 OT chapters, the rest marked as missing rather than shown misaligned).
  - Fetched live, display only: NIV, NLT, NASB 2020, the Amplified Bible (AMP), The Passion Translation (TPT, NT only) and the New Amharic Standard Version (NASV).
  - The original languages: a Greek interlinear for the NT (SBLGNT) and a Hebrew and Aramaic interlinear for the OT (Leningrad Codex), read right to left. Tap any word for its lexicon entry.
  - Compare up to three versions at once. Words that differ are highlighted, but only between texts in the same script.
  - Psalm titles appear above verse 1, as in the Hebrew.
- **Structure from the translators, not the AI:** Observe divides each chapter by the Berean Standard Bible's section headings (Psalm 119 by its 22 Hebrew-alphabet stanzas, from the WEB).
- **The book in view:** each book's overview sits beside the Context step, and a cross-reference arc diagram of the whole Bible sits beside Connections (tap it for the full view).
- **Tap a verse** for its notes, commentary and the original-language words, in the right-hand column.
- **Six provenance labels** on every claim: Explicit · Inference · Historical · Scholarly · Tradition · Personal.
- **Commentators on every verse of the Bible:** Calvin, Matthew Henry, Gill, Clarke, Jamieson-Fausset-Brown and the Tyndale Open Study Notes, with book introductions.
- **Church Fathers across the Bible:** exact quotes from Chrysostom, Augustine, Tertullian, Cyril of Alexandria and 80 others (to AD 750), kept apart from the commentators and labelled Tradition. Only old public-domain translations are shown; AI-made and modern translations are left out.
- **Show me why** on every claim: claim → evidence → source (tier, orientation, locator) → how it was produced.
- **Ask:** select any phrase or type a question. Answers come only from the chapter's evidence, are labelled and cited piece by piece, or say honestly "not enough evidence".
- **Text or Assumption?:** a quiz that asks you to label statements before revealing the answer, plus a checker for your own statements.
- **Notebook and sign-in:** private notes and reflections, kept apart from claims. Sign in with Google to keep them across devices.

## The trust architecture

**The AI is not the database.** It never supplies Bible text or facts; it arranges evidence we hand it, and code checks everything it writes.

```
open-licensed data ──► Postgres ──► evidence pack (V: verses, L: lexicon, X: cross-refs,
                                                   K: commentary paragraphs, C: verified claims)
                                          │
                                          ▼
              Gemini or Claude (JSON-schema structured output)
                                          │
                                          ▼
                     validator (lib/ai/validate.ts: pure, unit-tested)
                       · citations must exist in the evidence pack
                       · no citation → claim dropped
                       · "explicit" must cite a verse
                       · "historical" must cite lexical or scholarly evidence
                       · verse quotes must appear word for word in the verse
                       · commentary citations need the commentator's exact words
                       · "God is telling you…" language is rejected
                                          │
                                          ▼
                     second reader: each claim checked against its evidence
                       supported · partly supported · unsupported (withheld)
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

Every model call is logged in `ai_runs`: the evidence it saw, the prompt version, and what the validator removed. The `/audit` page shows the review results for every chapter. A reader's own questions keep only their row after 90 days, not their text. `/method`, `/provenance` and `/principles` explain the approach in plain words.

**Licensed text never reaches the AI.** NIV, NLT, NASB, AMP, TPT and NASV are fetched when a reader chooses them, cached for at most a day, never stored in the database, and can't be copied. Selecting them offers only "Ask about verse N", which sends the reference, never the wording.

## Sources

| Source | Used for | License |
|---|---|---|
| World English Bible, BSB, KJV, ASV, YLT (eBible.org) | English texts | Public domain |
| Amharic Bible 1962 / 1954 E.C. (Bible Society of Ethiopia / UBS, via eBible.org) | Amharic NT | Non-commercial use with the full copyright statement |
| WordProject copy of the same Amharic Bible | Amharic OT (each chapter checked for verse alignment), and 842 NT verses missing from the eBible e-text, marked ◦ in the reader | Non-profit use permitted by WordProject |
| NIV, NLT, NASB 2020 via [API.Bible](https://api.bible) | Licensed English versions | Non-commercial; display only; usage reported (FUMS) |
| New Amharic Standard Version 2024 (Biblica) via the [YouVersion Platform](https://platform.youversion.com) | Modern Amharic | Non-commercial; display only; no AI use |
| Amplified Bible (Lockman Foundation) and The Passion Translation 2020 NT (BroadStreet Publishing) via the YouVersion Platform | Licensed English versions | Non-commercial; display only |
| SBL Greek New Testament | Greek text | CC BY 4.0 |
| STEP Bible TAGNT, TBESG (Tyndale House, Cambridge) | Greek tagging, glosses, Abbott-Smith lexicon | CC BY 4.0 |
| Leningrad Codex, tagged in STEP Bible TAHOT (Tyndale House, Cambridge) | Hebrew and Aramaic text, glosses, grammar | Text public domain; tagging CC BY 4.0 |
| STEP Bible TBESH (abridged Brown-Driver-Briggs) | Hebrew lexicon | CC BY 4.0 |
| Berean Standard Bible section headings; WEB stanza and Psalm titles | Observe structure, Psalm titles | Public domain |
| OpenBible.info cross-references | Connections, both testaments | CC BY |
| Calvin, Henry, Gill, Clarke, JFB (via the Free Use Bible API) | Commentators | Public domain |
| Tyndale Open Study Notes | Commentators | CC BY-SA 4.0 |
| International Standard Bible Encyclopedia (1915), via internationalstandardbible.com | Book overviews and introductions | Public domain |
| Easton’s Bible Dictionary (1897), via the Christian Classics Ethereal Library | Book overviews and introductions | Public domain |
| Church Fathers to AD 750 (HistoricalChristianFaith Commentaries Database): Catena Aurea (1841–45), Ante-Nicene and Nicene and Post-Nicene Fathers (1885–1900) | Church Fathers | Public domain |

Copyrighted scholarship (BDAG, Louw-Nida, modern commentaries) is never displayed and never cited by the AI. Full notices are on `/copyright`; every source with its tier and orientation is on `/sources`.

**Verse numbering:** Context follows the WEB's numbering, which places a few verses differently (Rom 16:25–27 → 14:24–26, 3 John 15 → 14, Rev 12:18 → 13:1). Licensed versions are renumbered to match, and the old place says where the verse went.

## Stack

Next.js 16 (App Router) · PostgreSQL (raw SQL via `postgres`; Neon in production, free plan) · Gemini API or Claude API (JSON-schema output, retries and fallback models) · Auth.js (Google sign-in) · Tailwind 4 · Vitest · Vercel.

Chapter pages are served from Next's data cache, so most visits don't touch the database.

## Run it locally

```bash
npm install
npm run data:fetch      # downloads the open-licensed source files into data/raw
createdb context_dev
cp .env.example .env.local   # set DATABASE_URL and GEMINI_API_KEY (free at aistudio.google.com)
npm run db:migrate
npm run db:import       # once, on an empty database: verses, Greek words, lexicon, cross-references
npm run db:translations # BSB, KJV, ASV, YLT
npm run db:hebrew       # Hebrew interlinear and lexicon (OT)
npm run db:headings && npm run db:titles   # Observe section headings, Psalm titles
npm run db:xrefs-ot     # cross-references from OT verses
npm run data:commentaries && npm run db:commentaries
npm run data:amharic && npm run db:amharic && npm run db:amharic-ot   # missing NT verses, then the Amharic OT
npm run data:reference && npm run db:reference   # ISBE and Easton articles on each book (after db:commentaries)
npm run data:fathers && npm run db:fathers         # Church Fathers quotes (needs git and sqlite3)
npm run dev             # http://localhost:3000
```

Optional keys in `.env.local` (see `.env.example`):
- `API_BIBLE_KEY` for NIV, NLT and NASB.
- `YVP_APP_KEY` for NASV, AMP and TPT. This needs the Biblica, Lockman and BroadStreet licences accepted in the YouVersion Platform dashboard.
- `AUTH_SECRET`, `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` for sign-in.

Without these keys the app still runs, just without those features.

**`npm run db:import` empties the database first.** Never run it on a database that has studies or user notes; use the additive `db:*` imports above instead.

### Useful commands

- `npm test`: unit tests (reference parser, validator, verse numbering, text parsers, Hebrew and heading imports, reading view, diff).
- `npm run study:books -- --all`: prepare the 27 book overviews (resumable).
- `npm run study:generate -- "Eph 3" "John 1"`: prepare chapter studies. `-- --all` regenerates every chapter whose prompt version is out of date (resumable).
- `CONTEXT_CURATOR=1` in `.env.local`: shows the **Verify** button (local curation only; never in production).
- `bash scripts/sync-neon.sh`: back up production, migrate it, and copy content across while keeping user data. Run it (with any new migrations) **before** merging a change that needs them.
- `npm run cache:warm -- https://www.context1.io`: pre-load all 1,189 chapters after a deploy (or pass a preview URL).

## Project map

```
db/migrations/        schema, triggers, constraints (the rules live here)
scripts/              import (ETL), fetchers, migrate, generate, sync, cache warm-up
lib/bible/            book ids, reference parser, versification, text parsers
lib/ai/               client, evidence pack, validator, ask / text-or-assumption
lib/study/generate.ts chapter study: prompt → schema → validate → review → save
lib/data/             cached queries the pages read
lib/versions.ts       every version, defined once: source, provider id, publisher, script
lib/licensed.ts       fetches licensed versions (API.Bible, YouVersion), renumbered to Context's verse order
lib/notices.ts        copyright statements that must appear word for word
app/                  landing, /study, workspace, /notebook, /sources, /copyright, /audit, /method, /provenance,
                      /principles, /stats, /privacy, /api/*
components/           workspace shell, steps, claims and "Show me why", version toolbar, cross-reference arcs
components/workspace/read/   the Read step's three views (Greek or Hebrew interlinear, compare, flowing) and their text logic
```

## Contributing and license

Contributions are welcome: see [CONTRIBUTING.md](CONTRIBUTING.md).

The code is **source-available** under the [PolyForm Noncommercial License 1.0.0](LICENSE): you may read, use, copy
and change it for noncommercial purposes, such as personal study, churches, schools, research and charities. Selling
it, or using it in a paid product or service, needs a separate licence from the copyright holder. (Versions published
before 12 October 2026 were under the MIT License.)

The Bible texts, lexicons, cross-references and commentaries are **not** covered by the code licence: each keeps its
own license, listed under Sources above and on `/copyright`.
