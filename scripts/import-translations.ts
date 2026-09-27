// Add public-domain translations (NT) without touching anything else.
// Additive and idempotent: replaces only these translations' rows.
// Run: npm run db:translations
import { config } from "dotenv";
config({ path: ".env.local" });
import { readdirSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";
import { BOOKS } from "../lib/bible/books";
import { parseUsfm } from "../lib/bible/usfm";
import { toWeb } from "../lib/bible/versification";

const sql = postgres(process.env.DATABASE_URL!, { onnotice: () => {}, max: 1 });
const RAW = join(process.cwd(), "data/raw");

const VERSIONS = [
  { code: "BSB", dir: "engbsb", title: "Berean Standard Bible", year: "2016–2023", orientation: "evangelical, modern formal-functional", notes: null },
  { code: "KJV", dir: "eng-kjv", title: "King James Version", year: "1611 (1769 Blayney edition)", orientation: "Anglican, Textus Receptus",
    notes: "Public domain outside the UK; in the UK printing is under Crown letters patent." },
  { code: "ASV", dir: "eng-asv", title: "American Standard Version", year: "1901", orientation: "Revised Version tradition, very literal", notes: null },
  { code: "YLT", dir: "engylt", title: "Young's Literal Translation", year: "1862 (rev. 1898)", orientation: "hyper-literal, Textus Receptus", notes: null },
];

async function main() {
  const verses = await sql<{ ord: number; book_id: number; chapter: number; verse: number }[]>`select ord, book_id, chapter, verse from verses`;
  const ordOf = new Map(verses.map((v) => [`${v.book_id}.${v.chapter}.${v.verse}`, v.ord]));

  for (const v of VERSIONS) {
    const [src] = await sql<{ id: number }[]>`
      insert into sources (key, title, publisher, year, url, tier, source_type, orientation, license, can_display, notes, written)
      values (${v.code}, ${v.title}, 'eBible.org', ${v.year}, ${`https://ebible.org/find/details.php?id=${v.dir}`}, 1,
              'Primary text · translation', ${v.orientation}, 'Public domain', true, ${v.notes}, ${v.year})
      on conflict (key) do update set title = excluded.title, year = excluded.year, url = excluded.url, orientation = excluded.orientation,
        notes = excluded.notes, written = excluded.written
      returning id`;
    await sql`insert into translations (code, name, language, source_id) values (${v.code}, ${v.title}, 'en', ${src.id})
              on conflict (code) do update set name = excluded.name, source_id = excluded.source_id`;

    const rows: { translation_code: string; ord: number; end_ord: null; text: string; para: boolean }[] = [];
    const unplaced: string[] = [];
    const seen = new Set<number>();
    const dir = join(RAW, v.dir);
    for (const f of readdirSync(dir).filter((f) => f.endsWith(".usfm"))) {
      for (const verse of parseUsfm(join(dir, f))) {
        const book = BOOKS.find((b) => b.id === verse.book)!;
        if (book.testament !== "NT" || !verse.text) continue;
        const w = toWeb(book.osis, verse.chapter, verse.verse);
        const ord = ordOf.get(`${verse.book}.${w.chapter}.${w.verse}`);
        if (!ord || seen.has(ord)) {
          unplaced.push(`${book.osis} ${verse.chapter}:${verse.verse}`);
          continue;
        }
        seen.add(ord);
        rows.push({ translation_code: v.code, ord, end_ord: null, text: verse.text, para: verse.para });
      }
    }
    await sql.begin(async (tx) => {
      await tx`delete from verse_texts where translation_code = ${v.code}`;
      for (let i = 0; i < rows.length; i += 4000) await tx`insert into verse_texts ${tx(rows.slice(i, i + 4000))}`;
    });
    console.log(`${v.code}: ${rows.length} NT verses${unplaced.length ? ` · not placed: ${unplaced.join(", ")}` : ""}`);
  }
  await sql.end();
}

main().catch(async (e) => {
  console.error(e);
  await sql.end();
  process.exit(1);
});
