// Imports the Berean Standard Bible's section headings (\s1 lines in its USFM) for the whole Bible, plus Psalm 119's
// 22 stanzas from the World English Bible (each headed by a letter of the Hebrew alphabet, the psalm's own structure),
// which replace the BSB's single heading for that psalm.
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

const LETTERS: Record<string, string> = {
  ALEPH: "א", BETH: "ב", GIMEL: "ג", DALETH: "ד", HE: "ה", VAV: "ו", ZAYIN: "ז", HETH: "ח", TETH: "ט", YODH: "י", KAPF: "כ",
  LAMEDH: "ל", MEM: "מ", NUN: "נ", SAMEKH: "ס", AYIN: "ע", PE: "פ", TZADHE: "צ", QOPH: "ק", RESH: "ר", "SIN AND SHIN": "ש", TAV: "ת",
};

/** The stanza headings of a chapter (its \d lines), e.g. Psalm 119's ALEPH, BETH… → "Aleph (א)" at verses 1, 9… */
export function parseStanzas(usfm: string, chapter: number) {
  const out: { verse: number; title: string }[] = [];
  let inChapter = false, pending: string | null = null;
  for (const line of usfm.split(/\r?\n/)) {
    const c = line.match(/^\\c\s+(\d+)/);
    if (c) { inChapter = Number(c[1]) === chapter; continue; }
    if (!inChapter) continue;
    const v = line.match(/^\\v\s+(\d+)/);
    if (v) {
      if (pending) { out.push({ verse: Number(v[1]), title: pending }); pending = null; }
      continue;
    }
    const d = line.match(/^\\d\s+(.+?)\s*$/);
    if (d) {
      const name = d[1].replace(/\\w\s+([^|\\]*)(\|[^\\]*)?\\w\*/g, "$1").replace(/\s+/g, " ").trim();
      if (name) {
        const nice = ({ KAPF: "Kaph", "SIN AND SHIN": "Sin and Shin" } as Record<string, string>)[name] ?? name.toLowerCase().replace(/\b\w/g, (x) => x.toUpperCase());
        pending = LETTERS[name] ? `${nice} (${LETTERS[name]})` : nice;
      }
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
  // Psalm 119: its 22 alphabet stanzas (WEB) instead of the BSB's one heading.
  const [web] = await sql<{ id: number }[]>`select id from sources where key = 'WEB'`;
  const psalms = BOOKS.find((b) => b.osis === "Ps")!;
  const webFile = readdirSync(join(process.cwd(), "data/raw/web")).find((f) => f.includes("-PSA") && f.endsWith(".usfm"));
  const stanzas = webFile ? parseStanzas(readFileSync(join(process.cwd(), "data/raw/web", webFile), "utf8"), 119) : [];
  const stanzaRows = stanzas.map((s) => ({
    source_id: web.id, book_id: psalms.id, chapter: 119, title: s.title,
    start_ord: verses.find((v) => v.book_id === psalms.id && v.chapter === 119 && v.verse === s.verse)!.ord,
  }));
  const finalRows = stanzaRows.length ? rows.filter((r) => !(r.book_id === psalms.id && r.chapter === 119)).concat(stanzaRows) : rows;

  await sql.begin(async (tx) => {
    await tx`delete from section_headings where source_id in (${bsb.id}, ${web.id})`;
    for (let i = 0; i < finalRows.length; i += 500) await tx`insert into section_headings ${tx(finalRows.slice(i, i + 500))}`;
  });
  console.log(`${finalRows.length - stanzaRows.length} BSB section headings and ${stanzaRows.length} Psalm 119 stanzas (WEB) imported${unplaced ? ` (${unplaced} could not be placed)` : ""}`);
  await sql.end();
}

if (process.argv[1]?.endsWith("import-headings.ts")) main().catch((e) => { console.error(e); process.exit(1); });
