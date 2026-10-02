import "server-only";

// Licensed translations via API.Bible (Starter plan, non-commercial).
// Terms we follow: fetched live and cached ≤ 1 day (never stored in our database), shown unaltered,
// copyright notice + api.bible link displayed, usage reported via FUMS, and NEVER sent to any AI system.
export const API_BIBLE = {
  NIV: { bibleId: "78a9f6124f344018-01", name: "New International Version (2011)" },
  NLT: { bibleId: "d6e14a625393b4da-01", name: "New Living Translation" },
  NASB: { bibleId: "a761ca71e0b3ddcf-01", name: "New American Standard Bible 2020" },
} as const;
export type ApiBibleCode = keyof typeof API_BIBLE;

const BASE = "https://rest.api.bible/v1";

export interface ApiBibleChapter {
  verses: Record<number, string>;
  copyright: string;
  fumsToken: string | null;
}

interface Node {
  name?: string;
  type: string;
  text?: string;
  attrs?: { verseId?: string; style?: string };
  items?: Node[];
}

/** Collect the text of each verse from API.Bible's JSON (text nodes carry their verseId). */
function collect(nodes: Node[], out: Record<number, string>) {
  for (const n of nodes) {
    if (n.type === "text" && n.attrs?.verseId && n.text) {
      const verse = Number(n.attrs.verseId.split(".")[2]);
      if (verse) out[verse] = (out[verse] ?? "") + n.text;
    }
    // Skip verse-number tags; recurse into paragraphs and character styles (e.g. words of Jesus).
    if (n.items && n.name !== "verse") collect(n.items, out);
  }
}

export async function fetchApiBibleChapter(code: ApiBibleCode, usfm: string, chapter: number): Promise<ApiBibleChapter | null> {
  const key = process.env.API_BIBLE_KEY;
  if (!key) return null;
  const url = `${BASE}/bibles/${API_BIBLE[code].bibleId}/chapters/${usfm}.${chapter}?content-type=json&include-notes=false&include-titles=false&include-chapter-numbers=false&include-verse-numbers=true&include-verse-spans=false`;
  const r = await fetch(url, { headers: { "api-key": key }, next: { revalidate: 86400 } }); // ≤ 1 day, well within the 30-day rule
  if (!r.ok) return null;
  const body = (await r.json()) as { data: { content: Node[]; copyright: string }; meta?: { fumsToken?: string } };
  const verses: Record<number, string> = {};
  collect(body.data.content, verses);
  for (const v of Object.keys(verses)) verses[Number(v)] = verses[Number(v)].replace(/\s+/g, " ").trim();
  return { verses, copyright: body.data.copyright, fumsToken: body.meta?.fumsToken ?? null };
}
