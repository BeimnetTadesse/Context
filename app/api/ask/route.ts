import { askPassage } from "@/lib/ai/ask";
import { aiError, clean, json, ntChapter } from "@/lib/api";
import { ensureUserId } from "@/lib/user";

export const maxDuration = 120;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const target = ntChapter(body.book, body.chapter);
  const question = clean(body.question, 500);
  if (!target || question.length < 3) return json({ error: "bad_request" }, 400);
  try {
    return json(await askPassage(target.book, target.chapter, question, await ensureUserId()));
  } catch (e) {
    return aiError(e);
  }
}
