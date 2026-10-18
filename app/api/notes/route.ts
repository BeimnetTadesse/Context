import { clean, json, ntChapter } from "@/lib/api";
import { sql } from "@/lib/db";
import { docToText, parseDoc } from "@/lib/notes/doc";
import { currentUserId, ensureUserId } from "@/lib/user";

const KINDS = ["note", "reflection", "text_says", "i_bring", "text_issue"];

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const target = ntChapter(b.book, b.chapter);
  // Rich notes send the editor's document; the plain-text body is derived from it. Plain notes send body.
  const doc = b.doc === undefined ? null : parseDoc(b.doc);
  if (b.doc !== undefined && !doc) return json({ error: "bad_request" }, 400);
  const body = doc ? docToText(doc) : clean(b.body, 5000);
  if (!target || !KINDS.includes(b.kind) || !body) return json({ error: "bad_request" }, 400);
  const userId = await ensureUserId();
  const ord = async (verse: unknown) => {
    if (!Number.isInteger(verse)) return null;
    const [r] = await sql<{ ord: number }[]>`select ord from verses where book_id = ${target.book.id} and chapter = ${target.chapter} and verse = ${verse as number}`;
    return r?.ord ?? null;
  };
  const start = await ord(b.verse);
  const itemId = Number.isInteger(b.itemId) ? (b.itemId as number) : null;
  if (itemId) {
    // Must be a reflection prompt of this chapter; otherwise the insert would fail with a server error.
    const [item] = await sql`select 1 from reflection_items where id = ${itemId} and book_id = ${target.book.id} and chapter = ${target.chapter}`;
    if (!item) return json({ error: "bad_request" }, 400);
  }
  // One answer per prompt: re-saving replaces it.
  if (itemId) await sql`delete from notes where user_id = ${userId} and item_id = ${itemId}`;
  const [row] = await sql<{ id: number }[]>`
    insert into notes (user_id, book_id, chapter, start_ord, end_ord, kind, item_id, body, doc)
    values (${userId}, ${target.book.id}, ${target.chapter}, ${start}, ${start}, ${b.kind}, ${itemId}, ${body}, ${doc ? sql.json(doc) : null}) returning id`;
  const [{ count }] = await sql<{ count: number }[]>`select count(*)::int as count from notes where user_id = ${userId} and kind <> 'text_issue'`;
  return json({ id: row.id, count });
}

/** Edit a note's text. Only the reader's own notes, and not text-problem reports (those are feedback, not notes). */
export async function PATCH(req: Request) {
  const b = await req.json().catch(() => ({}));
  const doc = parseDoc(b.doc);
  const body = doc ? docToText(doc) : "";
  if (!Number.isInteger(b.id) || !doc || !body) return json({ error: "bad_request" }, 400);
  const userId = await currentUserId();
  if (!userId) return json({ error: "not_found" }, 404);
  const [row] = await sql`
    update notes set doc = ${sql.json(doc)}, body = ${body}, updated_at = now()
    where id = ${b.id as number} and user_id = ${userId} and kind <> 'text_issue' returning id`;
  return row ? json({ ok: true }) : json({ error: "not_found" }, 404);
}

export async function DELETE(req: Request) {
  const { id } = await req.json().catch(() => ({}));
  if (!Number.isInteger(id)) return json({ error: "bad_request" }, 400);
  const userId = await ensureUserId();
  await sql`delete from notes where id = ${id} and user_id = ${userId}`;
  return json({ ok: true });
}
