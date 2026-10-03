import "server-only";
import { API_BIBLE, fetchApiBibleChapter, type ApiBibleCode } from "./apibible";
import type { Book } from "./bible/books";
import { feederChapters, renumberToWeb } from "./bible/versification";
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

/**
 * A chapter in Context's verse order. Providers number verses the standard way; Context follows the WEB,
 * which moves a few (Rom 16:25–27 → 14:24–26, 3 John 15 → 14, Rev 12:18 → 13:1). Renumber to match.
 */
export async function fetchLicensedChapter(code: LicensedCode, book: Pick<Book, "osis" | "usfm">, chapter: number): Promise<LicensedChapter | null> {
  const chapters = [chapter, ...feederChapters(book.osis, chapter)];
  const parts = await Promise.all(chapters.map((c) => fetchFrom(code, book.usfm, c).catch(() => null)));
  const main = parts[0];
  if (!main) return null; // provider unreachable: the reader sees "unavailable right now", not an error page
  const numbered = parts.flatMap((p, i) => (p ? [{ chapter: chapters[i], verses: p.verses, spans: p.spans }] : []));
  return { ...main, ...renumberToWeb(book.osis, chapter, numbered) };
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
