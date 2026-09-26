import { clean, json, ntChapter } from "@/lib/api";
import { sql } from "@/lib/db";
import { ensureUserId } from "@/lib/user";

const KINDS = ["note", "reflection", "text_says", "i_bring", "text_issue"];

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const target = ntChapter(b.book, b.chapter);
  const body = clean(b.body, 5000);
  if (!target || !KINDS.includes(b.kind) || !body) return json({ error: "bad_request" }, 400);
  const userId = await ensureUserId();
  const ord = async (verse: unknown) => {
    if (!Number.isInteger(verse)) return null;
    const [r] = await sql<{ ord: number }[]>`select ord from verses where book_id = ${target.book.id} and chapter = ${target.chapter} and verse = ${verse as number}`;
    return r?.ord ?? null;
  };
  const start = await ord(b.verse);
  const itemId = Number.isInteger(b.itemId) ? b.itemId : null;
  // One answer per prompt: re-saving replaces it.
  if (itemId) await sql`delete from notes where user_id = ${userId} and item_id = ${itemId}`;
  const [row] = await sql<{ id: number }[]>`
    insert into notes (user_id, book_id, chapter, start_ord, end_ord, kind, item_id, body)
    values (${userId}, ${target.book.id}, ${target.chapter}, ${start}, ${start}, ${b.kind}, ${itemId}, ${body}) returning id`;
  const [{ count }] = await sql<{ count: number }[]>`select count(*)::int as count from notes where user_id = ${userId} and kind <> 'text_issue'`;
  return json({ id: row.id, count });
}

export async function DELETE(req: Request) {
  const { id } = await req.json().catch(() => ({}));
  if (!Number.isInteger(id)) return json({ error: "bad_request" }, 400);
  const userId = await ensureUserId();
  await sql`delete from notes where id = ${id} and user_id = ${userId}`;
  return json({ ok: true });
}
