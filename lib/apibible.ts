import "server-only";

// Licensed translations via API.Bible (Starter plan, non-commercial).
// Terms we follow: fetched live and cached ≤ 1 day (never stored in our database), shown unaltered,
// copyright notice + api.bible link displayed, usage reported via FUMS, and NEVER sent to any AI system.
// Which versions, and their bibleIds, are listed in lib/versions.ts.

const BASE = "https://rest.api.bible/v1";

export interface ApiBibleChapter {
  verses: Record<number, string>;
  copyright: string;
  fumsToken: string | null;
}

export interface Node {
  name?: string;
  type: string;
  text?: string;
  attrs?: { verseId?: string; style?: string; number?: string };
  items?: Node[];
}

/**
 * Collect the text of each verse from API.Bible's JSON, in reading order. Most text nodes carry their verseId, but
 * in poetry (e.g. NLT Genesis 1:27, the Psalms) the lines after a verse marker don't: those belong to the verse
 * whose marker came last.
 */
export function collect(nodes: Node[], out: Record<number, string>, state: { verse: number | null } = { verse: null }) {
  for (const n of nodes) {
    if (n.name === "verse") {
      // The verse marker: its number starts the verse; its own items are just the printed number.
      const v = parseInt(String(n.attrs?.number ?? n.attrs?.verseId?.split(".")[2] ?? ""), 10);
      if (v) state.verse = v;
      continue;
    }
    if (n.type === "text" && n.text) {
      const v = n.attrs?.verseId ? Number(n.attrs.verseId.split(".")[2]) : state.verse;
      if (v) {
        out[v] = (out[v] ?? "") + n.text;
        state.verse = v;
      }
    }
    if (n.items) collect(n.items, out, state);
  }
}

export async function fetchApiBibleChapter(bibleId: string, usfm: string, chapter: number): Promise<ApiBibleChapter | null> {
  const key = process.env.API_BIBLE_KEY;
  if (!key) return null;
  const url = `${BASE}/bibles/${bibleId}/chapters/${usfm}.${chapter}?content-type=json&include-notes=false&include-titles=false&include-chapter-numbers=false&include-verse-numbers=true&include-verse-spans=false`;
  const r = await fetch(url, { headers: { "api-key": key }, next: { revalidate: 86400 } }); // ≤ 1 day, well within the 30-day rule
  if (!r.ok) return null;
  const body = (await r.json()) as { data: { content: Node[]; copyright: string }; meta?: { fumsToken?: string } };
  const verses: Record<number, string> = {};
  collect(body.data.content, verses);
  for (const v of Object.keys(verses)) verses[Number(v)] = verses[Number(v)].replace(/\s+/g, " ").trim();
  return { verses, copyright: body.data.copyright, fumsToken: body.meta?.fumsToken ?? null };
}
