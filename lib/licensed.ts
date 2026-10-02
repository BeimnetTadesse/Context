import "server-only";
import { API_BIBLE, fetchApiBibleChapter, type ApiBibleCode } from "./apibible";
import { fetchYouVersionChapter, youVersionNotice } from "./youversion";

// Every licensed translation, by provider. All are display-only: fetched live, cached ≤ 1 day, never stored in
// our database, never selectable, and never sent to any AI system.
export const YOUVERSION = {
  NASV: { bibleId: 1260, name: "New Amharic Standard Version 2024" },
} as const;
type YouVersionCode = keyof typeof YOUVERSION;

export type LicensedCode = ApiBibleCode | YouVersionCode;
export const isLicensed = (c: unknown): c is LicensedCode => typeof c === "string" && (c in API_BIBLE || c in YOUVERSION);

export interface LicensedChapter {
  code: LicensedCode;
  verses: Record<number, string>;
  /** Combined verses: first → last. */
  spans: Record<number, number>;
  copyright: string;
  trademark: string | null;
  /** API.Bible usage reporting token (YouVersion reports usage server-side). */
  fumsToken: string | null;
}

export async function fetchLicensedChapter(code: LicensedCode, usfm: string, chapter: number): Promise<LicensedChapter | null> {
  try {
    return await fetchFrom(code, usfm, chapter);
  } catch {
    return null; // provider unreachable: the reader sees "unavailable right now", not an error page
  }
}

async function fetchFrom(code: LicensedCode, usfm: string, chapter: number): Promise<LicensedChapter | null> {
  if (code in YOUVERSION) {
    const { bibleId } = YOUVERSION[code as YouVersionCode];
    const [text, notice] = await Promise.all([fetchYouVersionChapter(bibleId, usfm, chapter), youVersionNotice(bibleId)]);
    if (!text || !notice) return null;
    return { code, ...text, copyright: notice.copyright, trademark: notice.trademark || null, fumsToken: null };
  }
  const d = await fetchApiBibleChapter(code as ApiBibleCode, usfm, chapter);
  return d && { code, verses: d.verses, spans: {}, copyright: d.copyright, trademark: null, fumsToken: d.fumsToken };
}
