import { json } from "@/lib/api";
import { sql } from "@/lib/db";
import { curatorMode } from "@/lib/user";
import { refreshChapter } from "@/lib/cache";

// Curator action: "I opened these sources and they support the claim."
// The database trigger still decides: historical/scholarly claims need a tier 2–4 source.
export async function POST(_req: Request, ctx: RouteContext<"/api/claims/[id]/verify">) {
  if (!curatorMode()) return json({ error: "forbidden" }, 403);
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return json({ error: "bad_request" }, 400);
  try {
    await sql.begin(async (tx) => {
      await tx`update citations set checked = true where claim_id = ${id}`;
      await tx`update claims set status = 'verified' where id = ${id}`;
    });
    const [c] = await sql<{ slug: string; chapter: number | null }[]>`
      select b.slug, c.chapter from claims c join books b on b.id = c.book_id where c.id = ${id}`;
    if (c?.chapter) refreshChapter(c.slug, c.chapter);
    return json({ status: "verified" });
  } catch (e) {
    // The trigger's message explains exactly what evidence is missing.
    return json({ error: "rejected", message: e instanceof Error ? e.message : String(e) }, 422);
  }
}
