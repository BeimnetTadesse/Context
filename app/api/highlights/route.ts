import { json, ntChapter } from "@/lib/api";
import { sql } from "@/lib/db";
import { chapterHighlights } from "@/lib/data/highlights";
import { isHighlightColor } from "@/lib/highlights";
import { ensureUserId } from "@/lib/user";

// POST { book, chapter, verses: [3, 4], color: "yellow" | null } → highlight (or clear) those verses.
// Returns the reader's highlights for the whole chapter.
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const target = ntChapter(b.book, b.chapter);
  const verses: number[] = Array.isArray(b.verses) ? b.verses.filter((v: unknown) => Number.isInteger(v)).slice(0, 200) : [];
  if (!target || !verses.length || !(b.color === null || isHighlightColor(b.color))) return json({ error: "bad_request" }, 400);
  const userId = await ensureUserId();
  const ords = await sql<{ ord: number }[]>`
    select ord from verses where book_id = ${target.book.id} and chapter = ${target.chapter} and verse = any(${verses})`;
  if (!ords.length) return json({ error: "bad_request" }, 400);
  const list = ords.map((o) => o.ord);
  if (b.color === null) await sql`delete from highlights where user_id = ${userId} and ord = any(${list})`;
  else
    await sql`insert into highlights (user_id, ord, color) select ${userId}, unnest(${list}::int[]), ${b.color}
              on conflict (user_id, ord) do update set color = excluded.color, created_at = now()`;
  return json({ highlights: await chapterHighlights(userId, target.book.id, target.chapter) });
}
