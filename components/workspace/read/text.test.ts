import { describe, expect, it } from "vitest";
import type { VerseRow } from "@/lib/data/chapter";
import type { LicensedText } from "../Licensed";
import { coveredBy, paragraphs, spanEnd, textOf } from "./text";

const row = (verse: number, extra: Partial<VerseRow> = {}): VerseRow => ({
  ord: 1000 + verse, verse, para: false, web: `web ${verse}`, amh: null, movedTo: null, texts: { WEB: `web ${verse}` }, greek: [], ...extra,
});
const nasv = (verses: Record<number, string>, spans: Record<number, number> = {}): Record<string, LicensedText> => ({
  NASV: { verses, spans, moved: {}, publisher: null, copyright: "", trademark: null },
});

describe("read/text", () => {
  // Eph 3 in the 1962 Amharic: verses 5–6 are printed as one
  const eph3 = [
    row(4, { amh: { text: "አራት", endVerse: null, restored: false } }),
    row(5, { para: true, amh: { text: "አምስትና ስድስት", endVerse: 6, restored: true } }),
    row(6),
    row(7, { amh: { text: "ሰባት", endVerse: null, restored: true } }),
  ];

  it("reads each version's text for a verse", () => {
    expect(textOf(eph3[0], "WEB", {})).toBe("web 4");
    expect(textOf(eph3[1], "AMH", {})).toBe("አምስትና ስድስት");
    expect(textOf(eph3[2], "AMH", {})).toBeUndefined();
    expect(textOf(eph3[0], "NASV", nasv({ 4: "አራት" }))).toBe("አራት");
    expect(textOf(eph3[0], "NASV", {})).toBeUndefined(); // not loaded yet
  });

  it("knows where a combined verse ends, and which combined verse includes a verse", () => {
    expect(spanEnd(eph3[1], "AMH", {})).toBe(6);
    expect(coveredBy(eph3[2], "AMH", {}, eph3)).toEqual({ start: 5, end: 6 });
    expect(coveredBy(eph3[3], "AMH", {}, eph3)).toBeNull();
    expect(spanEnd(eph3[1], "NASV", nasv({ 5: "…" }, { 5: 6 }))).toBe(6);
    expect(coveredBy(eph3[2], "NASV", nasv({ 5: "…" }, { 5: 6 }), eph3)).toEqual({ start: 5, end: 6 });
  });

  it("groups verses into the translation's paragraphs", () => {
    expect(paragraphs(eph3).map((p) => p.map((v) => v.verse))).toEqual([[4], [5, 6, 7]]);
  });
});
