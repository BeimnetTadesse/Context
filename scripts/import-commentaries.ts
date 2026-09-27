// Import downloaded commentaries (data/raw/commentaries) into Postgres.
// Idempotent: replaces commentary notes, intros and extracted references; upserts the commentators as sources.
// Run: npm run db:commentaries
import { config } from "dotenv";
config({ path: ".env.local" });
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";
import { NT_BOOKS } from "../lib/bible/books";
import { scanRefs } from "../lib/bible/scan";
import { toWeb } from "../lib/bible/versification";

const sql = postgres(process.env.DATABASE_URL!, { onnotice: () => {}, max: 1 });
const RAW = join(process.cwd(), "data/raw/commentaries");

// Who is speaking — shown next to every note so readers can weigh it.
const COMMENTATORS = [
  {
    id: "john-calvin", key: "Calvin", section: true,
    title: "Commentaries on the New Testament", author: "John Calvin", written: "1540–1564", tradition: "Reformed",
    tier: 3, orientation: "Reformed (Protestant Reformation)", url: "https://www.ccel.org/ccel/calvin/commentaries.html",
    license: "Public domain", notes: "Calvin wrote no commentary on 2–3 John or Revelation.",
  },
  {
    id: "matthew-henry", key: "Henry", section: true,
    title: "Commentary on the Whole Bible", author: "Matthew Henry", written: "1706–1721", tradition: "English Nonconformist (Presbyterian)",
    tier: 5, orientation: "Devotional, Reformed", url: "https://www.ccel.org/ccel/henry/mhc.html",
    license: "Public domain", notes: "Henry died in 1714 after completing Acts; Romans–Revelation were completed by other ministers from his notes.",
  },
  {
    id: "john-gill", key: "Gill", section: false,
    title: "Exposition of the Old and New Testaments", author: "John Gill", written: "1746–1763", tradition: "Particular Baptist (Calvinist)",
    tier: 3, orientation: "Calvinist, draws on rabbinic sources", url: "https://en.wikipedia.org/wiki/John_Gill_(theologian)",
    license: "Public domain", notes: null,
  },
  {
    id: "adam-clarke", key: "Clarke", section: false,
    title: "Commentary on the Holy Scriptures", author: "Adam Clarke", written: "1810–1826", tradition: "Methodist (Wesleyan-Arminian)",
    tier: 3, orientation: "Arminian, philological", url: "https://en.wikipedia.org/wiki/Adam_Clarke",
    license: "Public domain", notes: "Not available in this dataset for Matthew.",
  },
  {
    id: "jamieson-fausset-brown", key: "JFB", section: false,
    title: "Commentary Critical and Explanatory on the Whole Bible", author: "Robert Jamieson, A. R. Fausset, David Brown",
    written: "1871", tradition: "Scottish Presbyterian / evangelical",
    tier: 3, orientation: "Evangelical, attentive to Greek and manuscripts", url: "https://en.wikipedia.org/wiki/Jamieson-Fausset-Brown_Bible_Commentary",
    license: "Public domain", notes: null,
  },
  {
    id: "tyndale", key: "Tyndale", section: false,
    title: "Tyndale Open Study Notes", author: "Tyndale House Publishers", written: "2022", tradition: "Evangelical",
    tier: 4, orientation: "Modern evangelical study notes", url: "https://tyndaleopenresources.com/",
    license: "CC BY-SA 4.0 — Tyndale Open Study Notes © Tyndale House Publishers", notes: "Shown unchanged; converted to JSON by the Free Use Bible API.",
  },
];

// Encoding damage found in the source files (double-encoded UTF-8 / HTML entities).
const MOJIBAKE: [RegExp, string][] = [
  [/Ã&brvbr;?/g, "æ"], [/Ã†/g, "Æ"], [/â€œ/g, "“"], [/â€š/g, "‚"], [/Ã¢/g, "â"], [/Â£/g, "£"],
];
const clean = (s: string) =>
  MOJIBAKE.reduce((t, [rx, rep]) => t.replace(rx, rep), s)
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

/**
 * Calvin's notes reprint the passage first — a heading, then each verse in English and in Latin
 * ("1. For this cause…" / "1. Hujus rei gratia…"). The verses are already on screen, so drop that block:
 * the heading, then numbered paragraphs that come in same-number pairs. Commentary starts at the first non-pair.
 */
export function stripCalvinVerseBlock(text: string): string {
  const paras = text.split(/\n\s*\n/);
  let i = 0;
  if (/^\s*(?:[1-3]\s)?[A-Z][a-z]+\s+\d+:\d+(?:[-–]\d+)?\s*$/.test(paras[0] ?? "")) i = 1;
  const num = (p?: string) => p?.match(/^\s*(\d+)\.\s/)?.[1];
  const start = i;
  while (num(paras[i]) && num(paras[i]) === num(paras[i + 1])) i += 2;
  return i > start ? paras.slice(i).join("\n\n") : text;
}

type Chapter = { chapter?: { number: number; introduction?: string | null; content: { type: string; number: number; content: string[] }[] }; missing?: boolean };

async function main() {
  console.time("commentaries");
  await sql`truncate commentary_refs, commentary_notes, book_intros, source_issues restart identity`;
  const issues: { source_id: number; book_id: number | null; chapter: number | null; kind: string; description: string }[] = [];

  // Upsert commentators as sources.
  const sid: Record<string, number> = {};
  for (const c of COMMENTATORS) {
    const [row] = await sql<{ id: number }[]>`
      insert into sources (key, title, author, publisher, year, url, tier, source_type, orientation, license, can_display, notes, written, tradition)
      values (${c.key}, ${c.title}, ${c.author}, ${"Free Use Bible API (bible.helloao.org)"}, ${c.written}, ${c.url}, ${c.tier},
              ${c.tier === 4 ? "Study notes" : "Commentary"}, ${c.orientation}, ${c.license}, true, ${c.notes}, ${c.written}, ${c.tradition})
      on conflict (key) do update set title = excluded.title, author = excluded.author, url = excluded.url, tier = excluded.tier,
        source_type = excluded.source_type, orientation = excluded.orientation, license = excluded.license, notes = excluded.notes,
        written = excluded.written, tradition = excluded.tradition, year = excluded.year
      returning id`;
    sid[c.id] = row.id;
  }

  // Verse ordinals for the NT.
  const verseRows = await sql<{ ord: number; book_id: number; chapter: number; verse: number }[]>`
    select v.ord, v.book_id, v.chapter, v.verse from verses v`;
  const ordOf = new Map(verseRows.map((v) => [`${v.book_id}.${v.chapter}.${v.verse}`, v.ord]));
  const lastVerse = new Map<string, number>();
  for (const v of verseRows) {
    const k = `${v.book_id}.${v.chapter}`;
    lastVerse.set(k, Math.max(lastVerse.get(k) ?? 0, v.verse));
  }
  // Commentaries use standard numbering; map to WEB's where they differ (e.g. Rom 16:25–27 → 14:24–26).
  const ord = (bookId: number, ch: number, v: number) => {
    const osis = NT_BOOKS.find((b) => b.id === bookId)!.osis;
    const w = toWeb(osis, ch, v);
    return ordOf.get(`${bookId}.${w.chapter}.${w.verse}`);
  };

  const notes: { id: number; source_id: number; book_id: number; chapter: number; start_ord: number; end_ord: number; text: string; sort: number }[] = [];
  const intros: { source_id: number; book_id: number; text: string }[] = [];

  for (const c of COMMENTATORS) {
    const booksFile = join(RAW, c.id, "_", "books.json");
    if (existsSync(booksFile)) {
      const data = JSON.parse(readFileSync(booksFile, "utf8")) as { books?: { id: string; introduction?: string | null }[] };
      for (const b of data.books ?? []) {
        const book = NT_BOOKS.find((x) => x.usfm === b.id);
        if (book && b.introduction?.trim()) intros.push({ source_id: sid[c.id], book_id: book.id, text: clean(b.introduction) });
      }
    }
    for (const book of NT_BOOKS) {
      for (let ch = 1; lastVerse.has(`${book.id}.${ch}`); ch++) {
        const file = join(RAW, c.id, book.usfm, `${ch}.json`);
        if (!existsSync(file)) continue;
        const data = JSON.parse(readFileSync(file, "utf8")) as Chapter;
        if (!data.chapter) continue;
        const items = data.chapter.content.filter((i) => i.type === "verse" && i.content?.some((t) => t.trim()));
        const endOfChapter = lastVerse.get(`${book.id}.${ch}`)!;
        // A note pointing past the end of the chapter (after versification mapping) means the file
        // doesn't belong to this chapter. Record it and skip — never guess.
        const beyond = items.filter((i) => !ord(book.id, ch, i.number)).map((i) => i.number);
        if (beyond.length) {
          issues.push({
            source_id: sid[c.id], book_id: book.id, chapter: ch, kind: "mismatched_file",
            description: `Notes for ${book.name} ${ch} refer to verses ${beyond.join(", ")}, but the chapter has ${endOfChapter}. The source file appears to contain notes for a different passage, so it was not imported.`,
          });
          continue;
        }
        let sort = 0;
        // JFB puts verse 1 (and a chapter heading) in the chapter introduction.
        const intro = data.chapter.introduction?.trim();
        if (intro) {
          const firstItem = items[0]?.number ?? 2;
          notes.push({ id: 0, source_id: sid[c.id], book_id: book.id, chapter: ch, start_ord: ord(book.id, ch, 1)!,
                       end_ord: ord(book.id, ch, Math.max(1, firstItem - 1))!, text: clean(intro), sort: sort++ });
        }
        items.forEach((item, i) => {
          const next = items[i + 1]?.number;
          const end = next && next > item.number ? next - 1 : c.section ? endOfChapter : item.number;
          const start = ord(book.id, ch, item.number);
          const stop = ord(book.id, ch, c.section ? Math.min(end, endOfChapter) : item.number);
          if (!start || !stop) return;
          notes.push({ id: 0, source_id: sid[c.id], book_id: book.id, chapter: ch, start_ord: start, end_ord: Math.max(start, stop),
                       text: c.key === "Calvin" ? stripCalvinVerseBlock(clean(item.content.join("\n\n"))) : clean(item.content.join("\n\n")), sort: sort++ });
        });
      }
    }
  }

  notes.forEach((n, i) => (n.id = i + 1));
  for (let i = 0; i < notes.length; i += 2000) await sql`insert into commentary_notes ${sql(notes.slice(i, i + 2000))}`;
  await sql`select setval('commentary_notes_id_seq', ${notes.length})`;
  for (let i = 0; i < intros.length; i += 500) await sql`insert into book_intros ${sql(intros.slice(i, i + 500))}`;

  // Extract and resolve every Bible reference inside the notes.
  const refs: { note_id: number; raw: string; start_ord: number | null; end_ord: number | null; resolved: boolean }[] = [];
  for (const n of notes) {
    const book = NT_BOOKS.find((b) => b.id === n.book_id)!;
    for (const r of scanRefs(n.text, book)) {
      const a = toWeb(r.book.osis, r.chapter, r.verseStart);
      const z = toWeb(r.book.osis, r.chapterEnd, r.verseEnd);
      const s = ordOf.get(`${r.book.id}.${a.chapter}.${a.verse}`) ?? null;
      const e = ordOf.get(`${r.book.id}.${z.chapter}.${z.verse}`) ?? s;
      refs.push({ note_id: n.id, raw: r.raw.slice(0, 60), start_ord: s, end_ord: e, resolved: s !== null });
    }
  }
  for (let i = 0; i < refs.length; i += 5000) await sql`insert into commentary_refs ${sql(refs.slice(i, i + 5000))}`;

  // Gaps in coverage are facts about the source, recorded too.
  for (const c of COMMENTATORS) {
    const [{ n }] = await sql<{ n: number }[]>`select count(distinct (book_id, chapter))::int as n from commentary_notes where source_id = ${sid[c.id]}`;
    if (n < 260) issues.push({ source_id: sid[c.id], book_id: null, chapter: null, kind: "coverage", description: `Notes available for ${n} of 260 NT chapters.${c.notes ? " " + c.notes : ""}` });
  }
  if (issues.length) await sql`insert into source_issues ${sql(issues)}`;
  for (const i of issues) console.log(`  issue [${COMMENTATORS.find((c) => sid[c.id] === i.source_id)?.key}] ${i.description}`);

  const unresolved = refs.filter((r) => !r.resolved).length;
  console.log(`commentators: ${COMMENTATORS.length} · notes: ${notes.length} · book intros: ${intros.length}`);
  console.log(`references in notes: ${refs.length} · resolved: ${refs.length - unresolved} · unresolved: ${unresolved} (${((unresolved / refs.length) * 100).toFixed(2)}%)`);
  console.timeEnd("commentaries");
  await sql.end();
}

main().catch(async (e) => {
  console.error(e);
  await sql.end();
  process.exit(1);
});
