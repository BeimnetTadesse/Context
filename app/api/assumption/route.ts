import { classifyStatement } from "@/lib/ai/ask";
import { aiBudgetExceeded, aiError, clean, json, ntChapter } from "@/lib/api";
import { ensureUserId } from "@/lib/user";

export const maxDuration = 120;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const target = ntChapter(body.book, body.chapter);
  const statement = clean(body.statement, 400);
  if (!target || statement.length < 3) return json({ error: "bad_request" }, 400);
  const userId = await ensureUserId();
  const limited = await aiBudgetExceeded(userId);
  if (limited) return limited;
  try {
    return json(await classifyStatement(target.book, target.chapter, statement, userId));
  } catch (e) {
    return aiError(e);
  }
}
