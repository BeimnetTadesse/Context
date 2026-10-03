import "server-only";
import { fetchApiBibleChapter } from "./apibible";
import type { Book } from "./bible/books";
import { feederChapters, renumberToWeb } from "./bible/versification";
import { isLicensedVersion, isVersion, versionInfo, type VersionCode } from "./versions";
import { fetchYouVersionChapter, youVersionNotice } from "./youversion";

// Licensed translations (listed in lib/versions.ts) are display-only: fetched live, cached ≤ 1 day, never stored
// in our database, never copyable, and never sent to any AI system.
export type LicensedCode = VersionCode;
export const isLicensed = (c: unknown): c is LicensedCode => isVersion(c) && isLicensedVersion(c);

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
  const { source } = versionInfo(code);
  if (source.kind === "youversion") {
    const [text, notice] = await Promise.all([fetchYouVersionChapter(source.bibleId, usfm, chapter), youVersionNotice(source.bibleId)]);
    if (!text || !notice) return null;
    return { code, ...text, copyright: notice.copyright, trademark: notice.trademark || null, fumsToken: null, publisher: source.publisher };
  }
  if (source.kind !== "apibible") return null;
  const d = await fetchApiBibleChapter(source.bibleId, usfm, chapter);
  return d && { code, verses: d.verses, spans: {}, copyright: d.copyright, trademark: null, fumsToken: d.fumsToken, publisher: null };
}
