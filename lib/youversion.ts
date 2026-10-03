import "server-only";

// Licensed translations via the YouVersion Platform (non-commercial; per-publisher licence accepted in the
// Platform dashboard). Terms we follow: fetched live and cached ≤ 1 day (never stored in our database), shown
// unaltered, copyright + trademark notices from the API shown with the text, publisher linked, and NEVER sent
// to any AI system (Biblica's licence excludes AI-generated content from its text).
import { parsePassageHtml, type YvChapter } from "./bible/yvhtml";

const BASE = "https://api.youversion.com/v1";

export async function fetchYouVersionChapter(bibleId: number, usfm: string, chapter: number): Promise<YvChapter | null> {
  const key = process.env.YVP_APP_KEY;
  if (!key) return null;
  const r = await fetch(`${BASE}/bibles/${bibleId}/passages/${usfm}.${chapter}?format=html`, {
    headers: { "X-YVP-App-Key": key },
    next: { revalidate: 86400 },
  });
  if (!r.ok) return null;
  const { content } = (await r.json()) as { content: string };
  return parsePassageHtml(content);
}

/** Official copyright and trademark notices, from the version's own metadata (never retyped). */
export async function youVersionNotice(bibleId: number): Promise<{ title: string; copyright: string; trademark: string } | null> {
  const key = process.env.YVP_APP_KEY;
  if (!key) return null;
  const r = await fetch(`${BASE}/bibles/${bibleId}`, { headers: { "X-YVP-App-Key": key }, next: { revalidate: 86400 } }).catch(() => null);
  if (!r?.ok) return null;
  const d = (await r.json()) as { title: string; copyright: string | null; promotional_content: string | null };
  // The trademark lines sit in the promotional text after the copyright block ("… are trademarks registered …").
  const lines = (d.promotional_content ?? "").split("\n").map((l) => l.replace(/[‪-‮]/g, "").trim());
  // Skip long promotional paragraphs and anything the copyright notice already says.
  const trademark = lines.filter((l) => /trademark/i.test(l) && l.length <= 300 && !(d.copyright ?? "").includes(l)).join(" ");
  return { title: d.title, copyright: (d.copyright ?? "").trim(), trademark };
}
