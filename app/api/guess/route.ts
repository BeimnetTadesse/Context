import { json } from "@/lib/api";
import { sql } from "@/lib/db";
import { LABELS, type Label } from "@/lib/labels";
import { ensureUserId } from "@/lib/user";

// Reflect › Text or Assumption?: record the reader's label, then reveal the answer.
export async function POST(req: Request) {
  const { itemId, guess } = await req.json().catch(() => ({}));
  if (!Number.isInteger(itemId) || !LABELS.includes(guess)) return json({ error: "bad_request" }, 400);
  const [item] = await sql<{ expected_label: Label }[]>`select expected_label from reflection_items where id = ${itemId} and kind = 'statement'`;
  if (!item) return json({ error: "not_found" }, 404);
  const userId = await ensureUserId();
  const correct = item.expected_label === guess;
  await sql`insert into assumption_guesses (user_id, item_id, guess, correct) values (${userId}, ${itemId}, ${guess}, ${correct})
            on conflict (user_id, item_id) do update set guess = excluded.guess, correct = excluded.correct, created_at = now()`;
  return json({ correct, expected: item.expected_label });
}

export async function DELETE(req: Request) {
  const { itemIds } = await req.json().catch(() => ({}));
  if (!Array.isArray(itemIds)) return json({ error: "bad_request" }, 400);
  const userId = await ensureUserId();
  await sql`delete from assumption_guesses where user_id = ${userId} and item_id = any(${itemIds.filter(Number.isInteger)})`;
  return json({ ok: true });
}
