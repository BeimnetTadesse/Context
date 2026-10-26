import { json, bibleChapter } from "@/lib/api";
import { getChapterArcs } from "@/lib/data/arcs";

// GET /api/arcs/john/3 → the whole-Bible line and this chapter's cross-reference arcs (for the Connections step).
export async function GET(_req: Request, ctx: RouteContext<"/api/arcs/[book]/[chapter]">) {
  const { book, chapter } = await ctx.params;
  const target = bibleChapter(book, chapter);
  if (!target) return json({ error: "not_found" }, 404);
  return Response.json(await getChapterArcs(target.book.id, target.chapter), { headers: { "Cache-Control": "public, max-age=3600" } });
}
