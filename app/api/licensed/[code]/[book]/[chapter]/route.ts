import { json, ntChapter } from "@/lib/api";
import { fetchLicensedChapter, isLicensed } from "@/lib/licensed";

// GET /api/licensed/NIV/ephesians/3 → that chapter’s verses (display only), copyright and FUMS token.
// Provider keys (API.Bible, YouVersion) stay on the server.
export async function GET(_req: Request, ctx: RouteContext<"/api/licensed/[code]/[book]/[chapter]">) {
  const { code, book, chapter } = await ctx.params;
  const target = ntChapter(book, chapter);
  if (!target || !isLicensed(code)) return json({ error: "not_found" }, 404);
  const data = await fetchLicensedChapter(code, target.book, target.chapter);
  if (!data) return json({ error: "unavailable", message: `${code} is not available right now.` }, 503);
  // Private: each view must produce its own FUMS report; the upstream fetch is cached server-side.
  return Response.json(data, { headers: { "Cache-Control": "private, no-store" } });
}
