// Imports chapter superscriptions (\d lines, mostly the Psalm titles) from the World English Bible's USFM.
// Idempotent: replaces them. Needs data/raw/web. Run: npm run db:titles
import { config } from "dotenv";
config({ path: ".env.local" });
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";
import { BOOKS } from "../lib/bible/books";

const sql = postgres(process.env.DATABASE_URL!, { onnotice: () => {}, max: 1 });
const DIR = join(process.cwd(), "data/raw/web");

/**
 * "\c 23" then "\d A Psalm by David." → [{ chapter: 23, title }]. Only a \d before the chapter's first verse is its
 * title (Psalm 119's \d lines inside the chapter are the Hebrew letters heading its stanzas). Markup is removed.
 */
export function parseTitles(usfm: string) {
  const out: { chapter: number; title: string }[] = [];
  let chapter = 0;
  let inVerses = false;
  for (const line of usfm.split(/\r?\n/)) {
    const c = line.match(/^\\c\s+(\d+)/);
    if (c) { chapter = Number(c[1]); inVerses = false; continue; }
    if (/^\\v\s/.test(line) || /\\v\s+\d/.test(line)) inVerses = true;
    const d = line.match(/^\\d\s+(.+?)\s*$/);
    if (d && chapter && !inVerses) {
      const title = d[1].replace(/\\w\s+([^|\\]*)(\|[^\\]*)?\\w\*/g, "$1").replace(/\\f\s.*?\\f\*/g, "").replace(/\\\+?\w+\*?/g, "").replace(/\s+/g, " ").trim();
      if (title) out.push({ chapter, title });
    }
  }
  return out;
}

async function main() {
  const [web] = await sql<{ id: number }[]>`select id from sources where key = 'WEB'`;
  const files = readdirSync(DIR);
  const rows: { book_id: number; chapter: number; title: string; source_id: number }[] = [];
  for (const book of BOOKS) {
    const file = files.find((f) => f.includes(`-${book.usfm}`) && f.endsWith(".usfm"));
    if (!file) continue;
    for (const t of parseTitles(readFileSync(join(DIR, file), "utf8"))) rows.push({ book_id: book.id, chapter: t.chapter, title: t.title, source_id: web.id });
  }
  await sql.begin(async (tx) => {
    await tx`delete from chapter_titles`;
    if (rows.length) await tx`insert into chapter_titles ${tx(rows)}`;
  });
  console.log(`${rows.length} chapter titles imported`);
  await sql.end();
}

if (process.argv[1]?.endsWith("import-titles.ts")) main().catch((e) => { console.error(e); process.exit(1); });
