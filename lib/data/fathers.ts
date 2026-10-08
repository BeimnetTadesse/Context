import "server-only";
import { sql } from "@/lib/db";
import { cachedContent } from "@/lib/cache";

export interface FatherQuote {
  id: number;
  range: string; // "3:16" or "3:14–21"
  text: string;
  work: string | null;
  via: string | null;
  translation: string;
  url: string | null;
}

export interface FatherVoice {
  name: string;
  year: number;
  category: string;
  condemned: boolean;
  note: string | null;
  wiki: string | null;
  quotes: FatherQuote[];
}

/** Every Church Father's quotes that touch verses [from, to] of a chapter, earliest writer first. */
export function getFathers(bookId: number, chapter: number, from: number, to: number): Promise<FatherVoice[]> {
  return cachedContent(["fathers", bookId, chapter, from, to], ["fathers"], () => loadFathers(bookId, chapter, from, to));
}

async function loadFathers(bookId: number, chapter: number, from: number, to: number): Promise<FatherVoice[]> {
  const rows = await sql<{
    id: number; name: string; year: number; category: string; condemned: boolean; note: string | null; wiki_url: string | null;
    text: string; work: string | null; via: string | null; translation: string; url: string | null; sc: number; sv: number; ec: number; ev: number;
  }[]>`
    select q.id, f.name, f.year, f.category, f.condemned, f.note, f.wiki_url, q.text, q.work, q.via, q.translation, q.url,
           a.chapter as sc, a.verse as sv, z.chapter as ec, z.verse as ev
    from father_quotes q
    join fathers f on f.id = q.father_id
    join verses a on a.ord = q.start_ord
    join verses z on z.ord = q.end_ord
    where q.start_ord <= (select ord from verses where book_id = ${bookId} and chapter = ${chapter} and verse = ${to})
      and q.end_ord   >= (select ord from verses where book_id = ${bookId} and chapter = ${chapter} and verse = ${from})
    order by f.year, f.name, q.start_ord, q.id`;

  const voices = new Map<string, FatherVoice>();
  for (const r of rows) {
    const v = voices.get(r.name) ?? {
      name: r.name, year: r.year, category: r.category, condemned: r.condemned, note: r.note, wiki: r.wiki_url, quotes: [],
    };
    const range = r.sc !== r.ec ? `${r.sc}:${r.sv}–${r.ec}:${r.ev}` : r.sv === r.ev ? `${r.sc}:${r.sv}` : `${r.sc}:${r.sv}–${r.ev}`;
    v.quotes.push({ id: r.id, range, text: r.text, work: r.work, via: r.via, translation: r.translation, url: r.url });
    voices.set(r.name, v);
  }
  return [...voices.values()];
}

/** How many Fathers speak to each verse of a chapter (for the verse picker). */
export function getFatherCounts(bookId: number, chapter: number): Promise<Record<number, number>> {
  return cachedContent(["father-counts", bookId, chapter], ["fathers"], async () => {
    const rows = await sql<{ verse: number; n: number }[]>`
      select v.verse, count(distinct q.father_id)::int as n
      from verses v join father_quotes q on q.start_ord <= v.ord and q.end_ord >= v.ord
      where v.book_id = ${bookId} and v.chapter = ${chapter}
      group by v.verse`;
    return Object.fromEntries(rows.map((r) => [r.verse, r.n]));
  });
}
