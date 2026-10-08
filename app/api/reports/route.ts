import { clean, json, ntChapter } from "@/lib/api";
import { sql } from "@/lib/db";
import { ensureUserId } from "@/lib/user";

// POST /api/reports { book, chapter, translation, body } → a problem in a Bible text, for the owner (/stats).
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const target = ntChapter(b.book, b.chapter);
  const translation = clean(b.translation, 100);
  const body = clean(b.body, 2000);
  if (!target || !translation || !body) return json({ error: "bad_request" }, 400);
  const userId = await ensureUserId();
  // Ten a day per reader is plenty for real reports, and stops the form being used to flood the list.
  const [{ n }] = await sql<{ n: number }[]>`
    select count(*)::int as n from text_reports where user_id = ${userId} and created_at > now() - interval '1 day'`;
  if (n >= 10) return json({ error: "too_many" }, 429);
  await sql`
    insert into text_reports (user_id, book_id, chapter, translation, body)
    values (${userId}, ${target.book.id}, ${target.chapter}, ${translation}, ${body})`;
  return json({ ok: true });
}
