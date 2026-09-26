import { getLemma } from "@/lib/data/chapter";

// Abbott-Smith entries arrive with light HTML (<b>, <BR />, <ref='…'>…</ref>).
// We reduce them to plain paragraphs server-side so no source HTML is ever injected into the page.
function toParagraphs(def: string | null): string[] {
  if (!def) return [];
  return def
    .replace(/<BR\s*\/?>/gi, "\n")
    .replace(/<ref='[^']*'>(.*?)<\/ref>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .split(/\n|(?=__\d+\.)/)
    .map((p) => p.replace(/__/g, "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

export async function GET(_req: Request, ctx: RouteContext<"/api/lexicon/[strongs]">) {
  const { strongs } = await ctx.params;
  if (!/^G\d{4}[A-Z]?$/.test(strongs)) return Response.json({ error: "bad id" }, { status: 400 });
  const entry = await getLemma(strongs);
  if (!entry) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(
    { ...entry, definition: toParagraphs(entry.definition) },
    { headers: { "Cache-Control": "public, max-age=86400" } },
  );
}
