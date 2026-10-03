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

/** Other standard-numbered chapters with verses the WEB prints in this chapter (Rom 14 ← Rom 16:25–27). */
export function feederChapters(osis: string, chapter: number): number[] {
  const out = new Set<number>();
  for (const [from, to] of Object.entries(STANDARD_TO_WEB)) {
    const [fromOsis, fromChapter] = from.split(".");
    const [toOsis, toChapter] = to.split(".");
    if (fromOsis === osis && toOsis === osis && Number(toChapter) === chapter && Number(fromChapter) !== chapter) out.add(Number(fromChapter));
  }
  return [...out];
}

export interface NumberedChapter {
  /** Standard chapter number this text came from. */
  chapter: number;
  verses: Record<number, string>;
  /** Combined verses: first → last. */
  spans: Record<number, number>;
}

/**
 * Renumber standard-numbered text (as providers give it) into the WEB's order for one WEB chapter.
 * `parts` are the chapter itself plus any feederChapters(). Verses the WEB prints elsewhere are left out and
 * listed in `moved` (verse → "14:24–26", one label per run); where the WEB joins two verses, the texts are
 * joined in standard order (3 John 14 + 15, Rev 12:18 + 13:1).
 */
export function renumberToWeb(osis: string, chapter: number, parts: NumberedChapter[]) {
  const pieces: { c: number; v: number; web: number; text: string }[] = [];
  const spans: Record<number, number> = {};
  const moved: Record<number, string> = {};
  for (const part of parts) {
    const c = part.chapter;
    for (const [v, text] of Object.entries(part.verses)) {
      const w = toWeb(osis, c, Number(v));
      if (w.chapter === chapter) pieces.push({ c, v: Number(v), web: w.verse, text });
      else if (c === chapter) moved[Number(v)] = `${w.chapter}:${w.verse}`;
    }
    for (const [start, end] of Object.entries(part.spans)) {
      const a = toWeb(osis, c, Number(start));
      const b = toWeb(osis, c, end);
      if (a.chapter === chapter && b.chapter === chapter) spans[a.verse] = b.verse;
    }
  }
  // A run of moved verses is labelled once, as a range ("14:24–26").
  const byTarget = new Map<string, number[]>();
  for (const v of Object.keys(moved).map(Number).sort((a, b) => a - b)) {
    const target = moved[v].split(":")[0];
    byTarget.set(target, [...(byTarget.get(target) ?? []), v]);
  }
  for (const vs of byTarget.values()) {
    if (vs.length < 2) continue;
    const first = vs[0];
    moved[first] = `${moved[first]}–${moved[vs[vs.length - 1]].split(":")[1]}`;
    for (const v of vs.slice(1)) delete moved[v];
  }
  pieces.sort((x, y) => x.c - y.c || x.v - y.v);
  const verses: Record<number, string> = {};
  for (const p of pieces) verses[p.web] = verses[p.web] ? `${verses[p.web]} ${p.text}` : p.text;
  return { verses, spans, moved };
}
