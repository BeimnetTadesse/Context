// Which words a version has for a verse, in Context's (WEB) verse order. No UI here, so it is unit-tested.
import type { VerseRow } from "@/lib/data/chapter";
import { isLicensedVersion, type VersionCode } from "@/lib/versions";
import type { LicensedText } from "../Licensed";

/** Group verses into the translation's own paragraphs (USFM \p markers). */
export function paragraphs(verses: VerseRow[]) {
  const out: VerseRow[][] = [];
  for (const v of verses) {
    if (v.para || out.length === 0) out.push([v]);
    else out[out.length - 1].push(v);
  }
  return out;
}

/** A verse's text in one version (Amharic merged ranges handled by the caller). */
export const textOf = (v: VerseRow, code: VersionCode, licensed: Record<string, LicensedText>) =>
  code === "AMH" ? v.amh?.text : isLicensedVersion(code) ? licensed[code]?.verses[v.verse] || undefined : v.texts[code];

/** Last verse of a combined verse starting here (Amharic 1962 merged ranges, NASV's "25-26"). */
export const spanEnd = (v: VerseRow, code: VersionCode, licensed: Record<string, LicensedText>) =>
  code === "AMH" ? v.amh?.endVerse ?? null : licensed[code]?.spans?.[v.verse] ?? null;

/** A version that prints verses together (Amharic 1962, NASV): the combined verse that includes this one. */
export function coveredBy(v: VerseRow, code: VersionCode, licensed: Record<string, LicensedText>, verses: VerseRow[]) {
  if (code === "AMH") {
    const start = verses.findLast((r) => r.verse < v.verse && r.amh?.endVerse && r.amh.endVerse >= v.verse);
    return start ? { start: start.verse, end: start.amh!.endVerse! } : null;
  }
  const spans = licensed[code]?.spans ?? {};
  for (const [start, end] of Object.entries(spans)) if (Number(start) < v.verse && end >= v.verse) return { start: Number(start), end };
  return null;
}
