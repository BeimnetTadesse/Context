import "server-only";
import { sql } from "@/lib/db";
import { cachedContent } from "@/lib/cache";
import { chapterName } from "@/lib/bible/books";

// Data for the cross-reference arc diagram: the whole Bible as a line of 1,189 chapters, and an arc from this
// chapter to every place OpenBible.info's readers link it to (references with at least one positive vote).

export interface ArcBook { name: string; slug: string; testament: "OT" | "NT"; offset: number; chapters: number }
export interface Arc { from: number; to: number; ref: string; href: string | null; votes: number }
export interface ChapterArcs {
  total: number;
  /** Verses in each of the 1,189 chapters, in Bible order (the bars along the line). */
  verseCounts: number[];
  books: ArcBook[];
  /** Index of this chapter on the line. */
  here: number;
  /** from = verse in this chapter, to = chapter index of the target. */
  arcs: Arc[];
}

const layout = () =>
  cachedContent(["arc-layout"], ["arcs"], async () => {
    const books = await sql<{ id: number; name: string; slug: string; testament: "OT" | "NT"; chapter_count: number }[]>`
      select id, name, slug, testament, chapter_count from books order by id`;
    const counts = await sql<{ book_id: number; chapter: number; n: number }[]>`
      select book_id, chapter, count(*)::int as n from verses group by 1, 2 order by 1, 2`;
    let offset = 0;
    const out = books.map((b) => {
      const x = { id: b.id, name: b.name, slug: b.slug, testament: b.testament, offset, chapters: b.chapter_count };
      offset += b.chapter_count;
      return x;
    });
    const byBook = new Map(out.map((b) => [b.id, b]));
    const verseCounts = new Array<number>(offset).fill(0);
    for (const c of counts) {
      const b = byBook.get(c.book_id);
      if (b && c.chapter <= b.chapters) verseCounts[b.offset + c.chapter - 1] = c.n;
    }
    return { books: out, verseCounts, total: offset };
  });

export function getChapterArcs(bookId: number, chapter: number): Promise<ChapterArcs> {
  return cachedContent(["arcs", bookId, chapter], ["arcs"], async () => {
    const { books, verseCounts, total } = await layout();
    const byId = new Map(books.map((b) => [b.id, b]));
    const rows = await sql<{ from_verse: number; book_id: number; chapter: number; verse: number; end_chapter: number; end_verse: number; votes: number }[]>`
      select fv.verse as from_verse, tv.book_id, tv.chapter, tv.verse, ev.chapter as end_chapter, ev.verse as end_verse, x.votes
      from cross_refs x
      join verses fv on fv.ord = x.from_start
      join verses tv on tv.ord = x.to_start
      join verses ev on ev.ord = x.to_end
      where fv.book_id = ${bookId} and fv.chapter = ${chapter} and x.votes > 0
      order by x.votes desc`;
    const here = byId.get(bookId)!.offset + chapter - 1;
    const arcs = rows.map((r) => {
      const b = byId.get(r.book_id)!;
      const end = r.end_chapter !== r.chapter ? `–${r.end_chapter}:${r.end_verse}` : r.end_verse !== r.verse ? `–${r.end_verse}` : "";
      return {
        from: r.from_verse,
        to: b.offset + r.chapter - 1,
        ref: `${chapterName(b.name)} ${r.chapter}:${r.verse}${end}`,
        href: `/study/${b.slug}/${r.chapter}#v${r.verse}`,
        votes: r.votes,
      };
    });
    return { total, verseCounts, here, arcs, books: books.map(({ name, slug, testament, offset, chapters }) => ({ name, slug, testament, offset, chapters })) };
  });
}
