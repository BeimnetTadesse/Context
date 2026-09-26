import { aiConfigured } from "@/lib/ai/client";
import { aiError, json, ntChapter } from "@/lib/api";
import { beginGeneration, failGeneration, generateChapterStudy } from "@/lib/study/generate";

// Generating a chapter study is one long model call (~1–3 minutes).
export const maxDuration = 300;

export async function POST(_req: Request, ctx: RouteContext<"/api/study/[book]/[chapter]">) {
  const { book: slug, chapter: ch } = await ctx.params;
  const target = ntChapter(slug, ch);
  if (!target) return json({ error: "not_found" }, 404);
  if (!aiConfigured()) return json({ error: "ai_unavailable", message: "Add GEMINI_API_KEY to .env.local to prepare studies." }, 503);

  const claim = await beginGeneration(target.book.id, target.chapter);
  if (claim !== "started") return json({ status: claim === "ready" ? "ready" : "pending" });
  try {
    const result = await generateChapterStudy(target.book, target.chapter);
    return json({ status: "ready", ...result });
  } catch (e) {
    await failGeneration(target.book.id, target.chapter, e instanceof Error ? e.message : String(e));
    return aiError(e);
  }
}
