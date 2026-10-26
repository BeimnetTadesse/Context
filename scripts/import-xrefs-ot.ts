// Adds OpenBible.info's cross-references FROM Old Testament verses (the first import only took those from the NT).
// Targets may be anywhere in the Bible. Idempotent: replaces only the OT-origin rows. Needs data/raw/xref.
// Run: npm run db:xrefs-ot
import { config } from "dotenv";
config({ path: ".env.local" });
import { readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";
import { BOOKS, bookByOsis } from "../lib/bible/books";

const sql = postgres(process.env.DATABASE_URL!, { onnotice: () => {}, max: 1 });

async function main() {
  const [src] = await sql<{ id: number }[]>`select id from sources where key = 'OpenBible'`;
  const verses = await sql<{ ord: number; book_id: number; chapter: number; verse: number }[]>`select ord, book_id, chapter, verse from verses`;
  const ordOf = new Map(verses.map((v) => [`${v.book_id}.${v.chapter}.${v.verse}`, v.ord]));
  const toOrd = (osis: string) => {
    const [b, c, v] = osis.split(".");
    const book = bookByOsis(b);
    return book ? ordOf.get(`${book.id}.${Number(c)}.${Number(v)}`) : undefined;
  };
  const range = (s: string) => {
    const [a, b] = s.split("-");
    const start = toOrd(a);
    return start ? [start, b ? toOrd(b) ?? start : start] : null;
  };
  const firstNt = BOOKS.find((b) => b.testament === "NT")!.id;
  const rows: { from_start: number; from_end: number; to_start: number; to_end: number; votes: number; source_id: number }[] = [];
  let skipped = 0;
  for (const line of readFileSync(join(process.cwd(), "data/raw/xref/cross_references.txt"), "utf8").split("\n").slice(1)) {
    const [from, to, votes] = line.split("\t");
    if (!from || !to) continue;
    if ((bookByOsis(from.split(".")[0])?.id ?? 99) >= firstNt) continue; // NT-origin rows are already in
    const f = range(from), t = range(to);
    if (!f || !t) { skipped++; continue; }
    rows.push({ from_start: f[0], from_end: f[1], to_start: t[0], to_end: t[1], votes: Number(votes) || 0, source_id: src.id });
  }
  const lastOt = Math.max(...verses.filter((v) => v.book_id < firstNt).map((v) => v.ord));
  await sql.begin(async (tx) => {
    await tx`delete from cross_refs where from_start <= ${lastOt}`;
    for (let i = 0; i < rows.length; i += 5000) await tx`insert into cross_refs ${tx(rows.slice(i, i + 5000))}`;
  });
  console.log(`${rows.length} cross-references from Old Testament verses imported${skipped ? ` (${skipped} could not be placed)` : ""}`);
  await sql.end();
}

main().catch(async (e) => { console.error(e); await sql.end(); process.exit(1); });
