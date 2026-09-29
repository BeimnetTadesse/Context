import "server-only";
import { sql } from "@/lib/db";
import { cachedContent } from "@/lib/cache";

export interface CommentaryRef {
  raw: string;
  href: string | null; // /study/... for NT, null for OT (shown as plain text with a tooltip)
  label: string;
}

export interface CommentaryNote {
  id: number;
  range: string; // "3:1–13"
  startVerse: number;
  text: string;
  refs: CommentaryRef[];
}

export interface Commentator {
  key: string;
  title: string;
  author: string | null;
  written: string | null;
  tradition: string | null;
  tier: number;
  license: string;
  url: string | null;
  notes: CommentaryNote[];
}

/** Every commentator's notes that overlap verses [from, to] of a chapter, oldest voice first. */
export function getCommentary(bookId: number, chapter: number, from: number, to: number): Promise<Commentator[]> {
  return cachedContent(["commentary", bookId, chapter, from, to], ["commentary"], () => loadCommentary(bookId, chapter, from, to));
}

async function loadCommentary(bookId: number, chapter: number, from: number, to: number): Promise<Commentator[]> {
  const rows = await sql<{
    id: number; key: string; title: string; author: string | null; written: string | null; tradition: string | null;
    tier: number; license: string; url: string | null; text: string; sv: number; ev: number; sc: number; ec: number;
  }[]>`
    select n.id, s.key, s.title, s.author, s.written, s.tradition, s.tier, s.license, s.url, n.text,
           a.verse as sv, z.verse as ev, a.chapter as sc, z.chapter as ec
    from commentary_notes n
    join sources s on s.id = n.source_id
    join verses a on a.ord = n.start_ord
    join verses z on z.ord = n.end_ord
    where n.start_ord <= (select ord from verses where book_id = ${bookId} and chapter = ${chapter} and verse = ${to})
      and n.end_ord   >= (select ord from verses where book_id = ${bookId} and chapter = ${chapter} and verse = ${from})
    order by s.written, n.start_ord, n.sort`;
  if (!rows.length) return [];

  const refRows = await sql<{ note_id: number; raw: string; slug: string | null; testament: string | null; name: string | null; c: number | null; v: number | null }[]>`
    select r.note_id, r.raw, b.slug, b.testament, b.name, v.chapter as c, v.verse as v
    from commentary_refs r
    left join verses v on v.ord = r.start_ord
    left join books b on b.id = v.book_id
    where r.note_id = any(${rows.map((r) => r.id)}) and r.resolved`;

  const byKey = new Map<string, Commentator>();
  for (const r of rows) {
    const c = byKey.get(r.key) ?? {
      key: r.key, title: r.title, author: r.author, written: r.written, tradition: r.tradition,
      tier: r.tier, license: r.license, url: r.url, notes: [],
    };
    const range = r.sc !== r.ec ? `${r.sc}:${r.sv}–${r.ec}:${r.ev}` : r.sv === r.ev ? `${r.sc}:${r.sv}` : `${r.sc}:${r.sv}–${r.ev}`;
    c.notes.push({
      id: r.id, range, startVerse: r.sv, text: r.text,
      refs: refRows.filter((x) => x.note_id === r.id).map((x) => ({
        raw: x.raw,
        href: x.testament === "NT" ? `/study/${x.slug}/${x.c}#v${x.v}` : null,
        label: `${x.name} ${x.c}:${x.v}`,
      })),
    });
    byKey.set(r.key, c);
  }
  return [...byKey.values()];
}

export async function getBookIntros(bookId: number) {
  return sql<{ key: string; title: string; author: string | null; written: string | null; tradition: string | null; license: string; text: string }[]>`
    select s.key, s.title, s.author, s.written, s.tradition, s.license, i.text
    from book_intros i join sources s on s.id = i.source_id
    where i.book_id = ${bookId} order by s.written desc`;
}
