import "server-only";
import { cache } from "react";
import { sql } from "@/lib/db";
import { cachedContent, chapterTag } from "@/lib/cache";
import { bookBySlug, type Book } from "@/lib/bible/books";
import { movedTo } from "@/lib/bible/versification";

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
  /** null = covered by a combined verse above. restored = filled from WordProject (missing from the eBible e-text). */
  amh: { text: string; endVerse: number | null; restored: boolean } | null;
  /** Printed elsewhere in Context's (WEB) numbering, e.g. Rom 16:25 → "14:24–26". */
  movedTo: string | null;
  /** Other English versions by code (BSB, KJV, ASV, YLT); missing key = the version omits this verse. */
  texts: Record<string, string>;
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

/**
 * Everything the Read step needs for one chapter. cachedContent serves it from the data cache (no database);
 * React's cache() dedupes the call between metadata and page within one request.
 */
export const getChapter = cache((slug: string, chapter: number): Promise<ChapterData | null> =>
  Number.isInteger(chapter) ? cachedContent(["chapter", slug, chapter], [chapterTag(slug, chapter)], () => loadChapter(slug, chapter)) : Promise.resolve(null),
);

async function loadChapter(slug: string, chapter: number): Promise<ChapterData | null> {
  const book = bookBySlug(slug);
  if (!book || book.testament !== "NT" || !Number.isInteger(chapter)) return null;

  const [meta] = await sql<{ chapter_count: number }[]>`select chapter_count from books where id = ${book.id}`;
  if (!meta || chapter < 1 || chapter > meta.chapter_count) return null;

  const rows = await sql<
    { ord: number; verse: number; para: boolean; web: string; amh: string | null; amh_end: number | null; amh_restored: boolean }[]
  >`
    select v.ord, v.verse,
           coalesce(w.para, false) as para,
           w.text as web,
           a.text as amh,
           ev.verse as amh_end,
           a.source_id is not null as amh_restored
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
  const others = await sql<{ ord: number; code: string; text: string }[]>`
    select ord, translation_code as code, text from verse_texts
    where ord between ${rows[0].ord} and ${rows[rows.length - 1].ord}
      and translation_code in ('BSB', 'KJV', 'ASV', 'YLT')`;
  const textsByOrd = new Map<number, Record<string, string>>();
  for (const o of others) textsByOrd.set(o.ord, { ...(textsByOrd.get(o.ord) ?? {}), [o.code]: o.text });

  const byOrd = new Map<number, GreekWord[]>();
  for (const { ord, ...w } of words) byOrd.set(ord, [...(byOrd.get(ord) ?? []), w]);

  const verses: VerseRow[] = rows.map((r) => ({
    ord: r.ord,
    verse: r.verse,
    para: r.para,
    web: r.web,
    amh: r.amh ? { text: r.amh, endVerse: r.amh_end, restored: r.amh_restored } : null,
    movedTo: movedTo(book.osis, chapter, r.verse),
    texts: { ...(textsByOrd.get(r.ord) ?? {}), ...(r.web ? { WEB: r.web } : {}) },
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
}

export interface LexiconEntry {
  strongs: string;
  lemma: string;
  translit: string | null;
  gloss: string | null;
  definition: string | null;
  occurrences: number;
}

export function getLemma(strongs: string): Promise<LexiconEntry | null> {
  return cachedContent(["lemma", strongs], ["lexicon"], () => loadLemma(strongs));
}

async function loadLemma(strongs: string): Promise<LexiconEntry | null> {
  const [row] = await sql<LexiconEntry[]>`
    select l.strongs, l.lemma, l.translit, l.gloss, l.definition,
           (select count(*)::int from greek_words g where g.strongs = l.strongs) as occurrences
    from lemmas l where l.strongs = ${strongs}`;
  return row ?? null;
}

export function getNtBooks() {
  return cachedContent(["books"], ["books"], async () =>
    [...(await sql<{ slug: string; name: string; osis: string; chapter_count: number }[]>`
      select slug, name, osis, chapter_count from books where testament = 'NT' order by id`)],
  );
}
