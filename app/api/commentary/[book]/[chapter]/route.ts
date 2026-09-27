import { json, ntChapter } from "@/lib/api";
import { getCommentary } from "@/lib/data/commentary";
import { sql } from "@/lib/db";

// GET /api/commentary/ephesians/3?from=6&to=6 → every commentator's notes on those verses.
export async function GET(req: Request, ctx: RouteContext<"/api/commentary/[book]/[chapter]">) {
  const { book, chapter } = await ctx.params;
  const target = ntChapter(book, chapter);
  if (!target) return json({ error: "not_found" }, 404);
  const [{ last }] = await sql<{ last: number | null }[]>`
    select max(verse) as last from verses where book_id = ${target.book.id} and chapter = ${target.chapter}`;
  if (!last) return json({ error: "not_found" }, 404);
  const url = new URL(req.url);
  const clamp = (n: number) => Math.max(1, Math.min(last, Number.isFinite(n) ? n : 1));
  const from = clamp(Number(url.searchParams.get("from") ?? 1));
  const to = Math.max(from, clamp(Number(url.searchParams.get("to") ?? from)));
  const commentators = await getCommentary(target.book.id, target.chapter, from, to);
  return Response.json({ from, to, commentators }, { headers: { "Cache-Control": "public, max-age=3600" } });
}
