// Imports the Church Fathers' quotes (from `npm run data:fathers`) into fathers / father_quotes.
// Additive and idempotent: replaces only these two tables. Run: npm run db:fathers
import { config } from "dotenv";
config({ path: ".env.local" });
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";
import type { FatherQuote } from "./fetch-church-fathers";

const sql = postgres(process.env.DATABASE_URL!, { onnotice: () => {}, max: 1 });
const FILE = join(process.cwd(), "data/raw/fathers/quotes.json");

async function main() {
  if (!existsSync(FILE)) throw new Error("Run `npm run data:fathers` first.");
  const quotes: FatherQuote[] = JSON.parse(readFileSync(FILE, "utf8"));

  // Verse → ord for the whole New Testament. A quote whose verse Context doesn't have (a different numbering)
  // falls back to the last verse of that chapter; one whose chapter doesn't exist is skipped.
  const verses = await sql<{ slug: string; id: number; chapter: number; verse: number; ord: number }[]>`
    select b.slug, b.id, v.chapter, v.verse, v.ord from verses v join books b on b.id = v.book_id where b.testament = 'NT'`;
  const ords = new Map(verses.map((v) => [`${v.slug} ${v.chapter}:${v.verse}`, v]));
  const lastInChapter = new Map<string, (typeof verses)[number]>();
  for (const v of verses) {
    const k = `${v.slug} ${v.chapter}`;
    if ((lastInChapter.get(k)?.verse ?? 0) < v.verse) lastInChapter.set(k, v);
  }
  const find = (book: string, c: number, v: number) => ords.get(`${book} ${c}:${v}`) ?? lastInChapter.get(`${book} ${c}`);

  let skipped = 0;
  await sql.begin(async (tx) => {
    await tx`delete from father_quotes`;
    await tx`delete from fathers`;

    const fathers = new Map<string, FatherQuote>();
    for (const q of quotes) fathers.set(q.father, q);
    const ids = new Map<string, number>();
    for (const f of fathers.values()) {
      const [row] = await tx<{ id: number }[]>`
        insert into fathers (name, year, category, condemned, note, wiki_url)
        values (${f.father}, ${f.year}, ${f.category}, ${f.condemned}, ${f.note}, ${f.wiki}) returning id`;
      ids.set(f.father, row.id);
    }

    const rows = [];
    for (const q of quotes) {
      const a = find(q.book, q.startChapter, q.startVerse);
      const z = find(q.book, q.endChapter, q.endVerse) ?? a;
      if (!a || !z) { skipped++; continue; }
      rows.push({
        father_id: ids.get(q.father)!, book_id: a.id, chapter: a.chapter, start_ord: a.ord, end_ord: Math.max(a.ord, z.ord),
        text: q.text, work: q.work, via: q.via, translation: q.translation, url: q.url, source_ref: q.id,
      });
    }
    for (let i = 0; i < rows.length; i += 1000) await tx`insert into father_quotes ${tx(rows.slice(i, i + 1000))}`;
    console.log(`${fathers.size} fathers, ${rows.length} quotes${skipped ? ` (${skipped} skipped: verse not in Context)` : ""}`);
  });

  await sql`
    insert into sources (key, title, author, publisher, year, url, tier, source_type, orientation, license, can_display, notes, written, tradition)
    values ('Fathers', 'The Church Fathers on the New Testament (to AD 750)', 'Chrysostom, Augustine, Tertullian, Cyril of Alexandria and others',
      'HistoricalChristianFaith Commentaries Database', '2nd–8th centuries', 'https://github.com/HistoricalChristianFaith/Commentaries-Database',
      2, 'Church Fathers · tradition', 'patristic', 'Public domain', true,
      'Exact quotes, filed by verse. Only old public-domain translations are shown: Aquinas’s Catena Aurea (1841–45), the Ante-Nicene and Nicene and Post-Nicene Fathers (1885–1900), and a few other 19th-century translations. AI-made and modern translations are left out.',
      '2nd–8th centuries', 'Early church (East and West)')
    on conflict (key) do update set title = excluded.title, author = excluded.author, publisher = excluded.publisher, year = excluded.year,
      url = excluded.url, tier = excluded.tier, source_type = excluded.source_type, orientation = excluded.orientation,
      notes = excluded.notes, written = excluded.written, tradition = excluded.tradition`;
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
