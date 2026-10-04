import { askPassage } from "@/lib/ai/ask";
import { aiBudgetExceeded, aiError, clean, json, ntChapter, signInRequired } from "@/lib/api";
import { ensureUserId } from "@/lib/user";

export const maxDuration = 120;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const target = ntChapter(body.book, body.chapter);
  const question = clean(body.question, 500);
  if (!target || question.length < 3) return json({ error: "bad_request" }, 400);
  const needsSignIn = await signInRequired();
  if (needsSignIn) return needsSignIn;
  const userId = await ensureUserId();
  const limited = await aiBudgetExceeded(userId);
  if (limited) return limited;
  try {
    return json(await askPassage(target.book, target.chapter, question, userId));
  } catch (e) {
    return aiError(e);
  }
}
