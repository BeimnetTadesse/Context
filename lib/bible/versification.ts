// Where WEB (Majority Text numbering) differs from the standard critical/English numbering
// that most commentaries use. Keys and values are "Osis.chapter.verse".
export const STANDARD_TO_WEB: Record<string, string> = {
  "Rom.16.25": "Rom.14.24", // the doxology: WEB prints it after 14:23
  "Rom.16.26": "Rom.14.25",
  "Rom.16.27": "Rom.14.26",
  "3John.1.15": "3John.1.14", // WEB joins v15 into v14
  "Rev.12.18": "Rev.13.1", // "he stood on the sand of the sea" begins 13:1 in WEB
};

export function toWeb(osis: string, chapter: number, verse: number): { chapter: number; verse: number } {
  const m = STANDARD_TO_WEB[`${osis}.${chapter}.${verse}`];
  if (!m) return { chapter, verse };
  const [, c, v] = m.split(".");
  return { chapter: Number(c), verse: Number(v) };
}

/**
 * Where a standard-numbered verse (and the ones moved with it) sits in WEB numbering, if elsewhere:
 * Rom 16:25 → "14:24–26". Null when the verse stays put.
 */
export function movedTo(osis: string, chapter: number, verse: number): string | null {
  const first = toWeb(osis, chapter, verse);
  if (first.chapter === chapter) return null;
  let last = first;
  for (let v = verse + 1; ; v++) {
    const w = toWeb(osis, chapter, v);
    if (w.chapter !== first.chapter || w.verse !== last.verse + 1) break;
    last = w;
  }
  return `${first.chapter}:${first.verse}${last.verse !== first.verse ? `–${last.verse}` : ""}`;
}

/** Verses WEB leaves empty because they appear only in later manuscripts. */
export const OMITTED_IN_WEB = new Set(["Luke.17.36", "Acts.8.37", "Acts.15.34", "Acts.24.7", "Rom.16.25"]);
