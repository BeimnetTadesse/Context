import { json, ntChapter } from "@/lib/api";
import { getFatherCounts, getFathers } from "@/lib/data/fathers";
import { sql } from "@/lib/db";

// GET /api/fathers/ephesians/2?from=8&to=8 → what each Church Father said about those verses,
// plus how many Fathers speak to each verse of the chapter.
export async function GET(req: Request, ctx: RouteContext<"/api/fathers/[book]/[chapter]">) {
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
  const [fathers, counts] = await Promise.all([
    getFathers(target.book.id, target.chapter, from, to),
    getFatherCounts(target.book.id, target.chapter),
  ]);
  return Response.json({ from, to, fathers, counts }, { headers: { "Cache-Control": "public, max-age=3600" } });
}
