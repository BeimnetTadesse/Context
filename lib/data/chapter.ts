import "server-only";
import { cache } from "react";
import { sql } from "@/lib/db";
import { bookBySlug, type Book } from "@/lib/bible/books";

export interface GreekWord {
  position: number;
  surface: string;
  translit: string | null;
  gloss: string | null;
  strongs: string | null;
  morph: string | null;
}

export interface VerseRow {
  ord: number;
  verse: number;
  para: boolean;
  web: string;
  amh: { text: string; endVerse: number | null } | null; // null = covered by a merged range above
  greek: GreekWord[];
}

export interface ChapterData {
  book: Book;
  chapter: number;
  chapterCount: number;
  verses: VerseRow[];
  prev: { slug: string; chapter: number; label: string } | null;
  next: { slug: string; chapter: number; label: string } | null;
}

/** Everything the Read step needs for one chapter. cache() dedupes the call between metadata and page. */
export const getChapter = cache(async (slug: string, chapter: number): Promise<ChapterData | null> => {
  const book = bookBySlug(slug);
  if (!book || book.testament !== "NT" || !Number.isInteger(chapter)) return null;

  const [meta] = await sql<{ chapter_count: number }[]>`select chapter_count from books where id = ${book.id}`;
  if (!meta || chapter < 1 || chapter > meta.chapter_count) return null;

  const rows = await sql<
    { ord: number; verse: number; para: boolean; web: string; amh: string | null; amh_end: number | null }[]
  >`
    select v.ord, v.verse,
           coalesce(w.para, false) as para,
           w.text as web,
           a.text as amh,
           ev.verse as amh_end
    from verses v
    left join verse_texts w on w.ord = v.ord and w.translation_code = 'WEB'
    left join verse_texts a on a.ord = v.ord and a.translation_code = 'AMH'
    left join verses ev on ev.ord = a.end_ord
    where v.book_id = ${book.id} and v.chapter = ${chapter}
    order by v.ord`;

  const words = await sql<(GreekWord & { ord: number })[]>`
    select g.ord, g.position, g.surface, g.translit, g.gloss, g.strongs, g.morph
    from greek_words g
    where g.ord between ${rows[0].ord} and ${rows[rows.length - 1].ord}
    order by g.ord, g.position`;
  const byOrd = new Map<number, GreekWord[]>();
  for (const { ord, ...w } of words) byOrd.set(ord, [...(byOrd.get(ord) ?? []), w]);

  const verses: VerseRow[] = rows.map((r) => ({
    ord: r.ord,
    verse: r.verse,
    para: r.para,
    web: r.web,
    amh: r.amh ? { text: r.amh, endVerse: r.amh_end } : null,
    greek: byOrd.get(r.ord) ?? [],
  }));

  const neighbour = async (dir: 1 | -1) => {
    const [n] = await sql<{ slug: string; chapter: number; name: string }[]>`
      select b.slug, v.chapter, b.name from verses v join books b on b.id = v.book_id
      where b.testament = 'NT' and ${dir === 1 ? sql`v.ord > ${rows[rows.length - 1].ord}` : sql`v.ord < ${rows[0].ord}`}
      order by v.ord ${dir === 1 ? sql`asc` : sql`desc`} limit 1`;
    return n ? { slug: n.slug, chapter: n.chapter, label: `${n.name} ${n.chapter}` } : null;
  };
  const [prev, next] = await Promise.all([neighbour(-1), neighbour(1)]);

  return { book, chapter, chapterCount: meta.chapter_count, verses, prev, next };
});

export interface LexiconEntry {
  strongs: string;
  lemma: string;
  translit: string | null;
  gloss: string | null;
  definition: string | null;
  occurrences: number;
}

export async function getLemma(strongs: string): Promise<LexiconEntry | null> {
  const [row] = await sql<LexiconEntry[]>`
    select l.strongs, l.lemma, l.translit, l.gloss, l.definition,
           (select count(*)::int from greek_words g where g.strongs = l.strongs) as occurrences
    from lemmas l where l.strongs = ${strongs}`;
  return row ?? null;
}

export async function getNtBooks() {
  return sql<{ slug: string; name: string; osis: string; chapter_count: number }[]>`
    select slug, name, osis, chapter_count from books where testament = 'NT' order by id`;
}
