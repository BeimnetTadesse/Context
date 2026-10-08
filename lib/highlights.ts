// Verse highlight colours: highlighter tints, deliberately different from the six provenance-label colours.
export const HIGHLIGHTS = {
  yellow: { name: "Yellow", fill: "#f6e6a0" },
  green: { name: "Green", fill: "#d5eac4" },
  blue: { name: "Blue", fill: "#d2e4f5" },
  pink: { name: "Pink", fill: "#f4d2da" },
} as const;

export type HighlightColor = keyof typeof HIGHLIGHTS;
export const isHighlightColor = (c: unknown): c is HighlightColor => typeof c === "string" && c in HIGHLIGHTS;
/** A reader's highlights in one chapter: verse number → colour. */
export type ChapterHighlights = Record<number, HighlightColor>;
