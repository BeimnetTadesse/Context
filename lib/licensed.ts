import "server-only";
import { API_BIBLE, fetchApiBibleChapter, type ApiBibleCode } from "./apibible";
import type { Book } from "./bible/books";
import { STANDARD_TO_WEB, toWeb } from "./bible/versification";
import { fetchYouVersionChapter, youVersionNotice } from "./youversion";

// Every licensed translation, by provider. All are display-only: fetched live, cached ≤ 1 day, never stored in
// our database, never copyable, and never sent to any AI system.
export const YOUVERSION = {
  NASV: { bibleId: 1260, name: "New Amharic Standard Version 2024", publisher: { name: "Biblica, Inc.", url: "https://www.biblica.com" } },
  AMP: { bibleId: 1588, name: "Amplified Bible", publisher: { name: "The Lockman Foundation", url: "https://www.lockman.org" } },
  TPT: { bibleId: 1849, name: "The Passion Translation", publisher: { name: "BroadStreet Publishing", url: "https://broadstreetpublishing.com" } },
} as const;
type YouVersionCode = keyof typeof YOUVERSION;

export type LicensedCode = ApiBibleCode | YouVersionCode;
export const isLicensed = (c: unknown): c is LicensedCode => typeof c === "string" && (c in API_BIBLE || c in YOUVERSION);

export interface LicensedChapter {
  code: LicensedCode;
  verses: Record<number, string>;
  /** Combined verses: first → last. */
  spans: Record<number, number>;
  /** Verses this version prints here that Context (following the WEB) places elsewhere: verse → "14:24". */
  moved: Record<number, string>;
  copyright: string;
  trademark: string | null;
  /** API.Bible usage reporting token (YouVersion reports usage server-side). */
  fumsToken: string | null;
  /** Publisher to link wherever the text is shown (YouVersion licences require it). */
  publisher: { name: string; url: string } | null;
}

/** Other standard-numbered chapters with verses the WEB prints in this chapter (e.g. Rom 16:25–27 → Rom 14). */
function feeders(osis: string, chapter: number): number[] {
  const out = new Set<number>();
  for (const [from, to] of Object.entries(STANDARD_TO_WEB)) {
    const [fo, fc] = from.split(".");
    const [to_o, tc] = to.split(".");
    if (fo === osis && to_o === osis && Number(tc) === chapter && Number(fc) !== chapter) out.add(Number(fc));
  }
  return [...out];
}

/**
 * A chapter in Context's verse order. Providers number verses the standard way; Context follows the WEB,
 * which moves a few (Rom 16:25–27 → 14:24–26, 3 John 15 → 14, Rev 12:18 → 13:1). Renumber to match.
 */
export async function fetchLicensedChapter(code: LicensedCode, book: Pick<Book, "osis" | "usfm">, chapter: number): Promise<LicensedChapter | null> {
  const chapters = [chapter, ...feeders(book.osis, chapter)];
  const parts = await Promise.all(chapters.map((c) => fetchFrom(code, book.usfm, c).catch(() => null)));
  const main = parts[0];
  if (!main) return null; // provider unreachable: the reader sees "unavailable right now", not an error page

  const pieces: { c: number; v: number; web: number; text: string }[] = [];
  const spans: Record<number, number> = {};
  const moved: Record<number, string> = {};
  parts.forEach((part, i) => {
    if (!part) return;
    const c = chapters[i];
    for (const [v, text] of Object.entries(part.verses)) {
      const w = toWeb(book.osis, c, Number(v));
      if (w.chapter === chapter) pieces.push({ c, v: Number(v), web: w.verse, text });
      else if (c === chapter) moved[Number(v)] = `${w.chapter}:${w.verse}`;
    }
    for (const [start, end] of Object.entries(part.spans)) {
      const a = toWeb(book.osis, c, Number(start));
      const b = toWeb(book.osis, c, end);
      if (a.chapter === chapter && b.chapter === chapter) spans[a.verse] = b.verse;
    }
  });
  // A run of moved verses is labelled once, as a range ("14:24–26").
  const byTarget = new Map<string, number[]>();
  for (const v of Object.keys(moved).map(Number).sort((a, b) => a - b)) {
    const ch = moved[v].split(":")[0];
    byTarget.set(ch, [...(byTarget.get(ch) ?? []), v]);
  }
  for (const vs of byTarget.values()) {
    if (vs.length < 2) continue;
    const first = vs[0];
    const last = vs[vs.length - 1];
    moved[first] = `${moved[first]}–${moved[last].split(":")[1]}`;
    for (const v of vs.slice(1)) delete moved[v];
  }
  // Where the WEB joins two verses (3 John 14+15, Rev 12:18 + 13:1), keep the standard order.
  pieces.sort((x, y) => x.c - y.c || x.v - y.v);
  const verses: Record<number, string> = {};
  for (const p of pieces) verses[p.web] = verses[p.web] ? `${verses[p.web]} ${p.text}` : p.text;
  return { ...main, verses, spans, moved };
}

async function fetchFrom(code: LicensedCode, usfm: string, chapter: number): Promise<Omit<LicensedChapter, "moved"> | null> {
  if (code in YOUVERSION) {
    const { bibleId, publisher } = YOUVERSION[code as YouVersionCode];
    const [text, notice] = await Promise.all([fetchYouVersionChapter(bibleId, usfm, chapter), youVersionNotice(bibleId)]);
    if (!text || !notice) return null;
    return { code, ...text, copyright: notice.copyright, trademark: notice.trademark || null, fumsToken: null, publisher };
  }
  const d = await fetchApiBibleChapter(code as ApiBibleCode, usfm, chapter);
  return d && { code, verses: d.verses, spans: {}, copyright: d.copyright, trademark: null, fumsToken: d.fumsToken, publisher: null };
}
