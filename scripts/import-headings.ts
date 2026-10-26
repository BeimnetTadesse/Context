// Imports the Berean Standard Bible's section headings (\s1 lines in its USFM) for the whole Bible.
// Each heading starts at the next verse after it. Idempotent: replaces the BSB headings.
// Needs data/raw/engbsb (npm run data:fetch). Run: npm run db:headings
import { config } from "dotenv";
config({ path: ".env.local" });
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";
import { BOOKS } from "../lib/bible/books";

const sql = postgres(process.env.DATABASE_URL!, { onnotice: () => {}, max: 1 });
const DIR = join(process.cwd(), "data/raw/engbsb");

/** "\s1 Jesus and Nicodemus" lines → [{ chapter, verse, title }], each at the first verse that follows it. */
export function parseHeadings(usfm: string) {
  const out: { chapter: number; verse: number; title: string }[] = [];
  let chapter = 0;
  let pending: string[] = [];
  for (const line of usfm.split(/\r?\n/)) {
    const c = line.match(/^\\c\s+(\d+)/);
    if (c) { chapter = Number(c[1]); continue; }
    const s = line.match(/^\\s1\s+(.+?)\s*$/);
    if (s) { pending.push(s[1].replace(/\\\w+\*?/g, "").trim()); continue; }
    const v = line.match(/^\\v\s+(\d+)/);
    if (v && pending.length) {
      for (const title of pending) out.push({ chapter, verse: Number(v[1]), title });
      pending = [];
    }
  }
  return out;
}

async function main() {
  const [bsb] = await sql<{ id: number }[]>`select id from sources where key = 'BSB'`;
  if (!bsb) throw new Error("BSB source missing: run npm run db:translations first.");
  const files = readdirSync(DIR);
  const verses = await sql<{ book_id: number; chapter: number; verse: number; ord: number }[]>`
    select book_id, chapter, verse, ord from verses order by ord`;

  const rows: { source_id: number; book_id: number; chapter: number; start_ord: number; title: string }[] = [];
  let unplaced = 0;
  for (const book of BOOKS) {
    const file = files.find((f) => f.includes(`-${book.usfm}engbsb.usfm`));
    if (!file) throw new Error(`no BSB file for ${book.usfm}`);
    for (const h of parseHeadings(readFileSync(join(DIR, file), "utf8"))) {
      // The verse it starts at, or (if Context's text omits that verse) the next one in the chapter.
      const at = verses.find((v) => v.book_id === book.id && v.chapter === h.chapter && v.verse >= h.verse);
      if (!at) { unplaced++; continue; }
      rows.push({ source_id: bsb.id, book_id: book.id, chapter: h.chapter, start_ord: at.ord, title: h.title });
    }
  }
  await sql.begin(async (tx) => {
    await tx`delete from section_headings where source_id = ${bsb.id}`;
    for (let i = 0; i < rows.length; i += 500) await tx`insert into section_headings ${tx(rows.slice(i, i + 500))}`;
  });
  console.log(`${rows.length} BSB section headings imported${unplaced ? ` (${unplaced} could not be placed)` : ""}`);
  await sql.end();
}

if (process.argv[1]?.endsWith("import-headings.ts")) main().catch((e) => { console.error(e); process.exit(1); });
