import { describe, expect, it } from "vitest";
import { feederChapters, movedTo, renumberToWeb, toWeb } from "./versification";

const chapter = (n: number, verses: Record<number, string>, spans: Record<number, number> = {}) => ({ chapter: n, verses, spans });

describe("toWeb / movedTo", () => {
  it("maps the verses the WEB numbers differently", () => {
    expect(toWeb("Rom", 16, 25)).toEqual({ chapter: 14, verse: 24 });
    expect(toWeb("3John", 1, 15)).toEqual({ chapter: 1, verse: 14 });
    expect(toWeb("Rev", 12, 18)).toEqual({ chapter: 13, verse: 1 });
    expect(toWeb("John", 3, 16)).toEqual({ chapter: 3, verse: 16 });
  });

  it("labels where a moved verse went, as a range when several move together", () => {
    expect(movedTo("Rom", 16, 25)).toBe("14:24–26");
    expect(movedTo("Rev", 12, 18)).toBe("13:1");
    expect(movedTo("3John", 1, 15)).toBeNull(); // joined into v14 of the same chapter, not moved
    expect(movedTo("John", 3, 16)).toBeNull();
  });

  it("knows which other chapters feed a WEB chapter", () => {
    expect(feederChapters("Rom", 14)).toEqual([16]);
    expect(feederChapters("Rev", 13)).toEqual([12]);
    expect(feederChapters("Rom", 16)).toEqual([]);
  });
});

describe("renumberToWeb", () => {
  it("brings the Romans doxology into chapter 14", () => {
    const r = renumberToWeb("Rom", 14, [chapter(14, { 23: "faith" }), chapter(16, { 24: "grace", 25: "to him", 26: "now", 27: "glory" })]);
    expect(r.verses).toEqual({ 23: "faith", 24: "to him", 25: "now", 26: "glory" });
    expect(r.moved).toEqual({});
  });

  it("says where the doxology went when reading chapter 16, even when the version combines verses", () => {
    // e.g. NASV prints 16:25–26 as one verse
    const r = renumberToWeb("Rom", 16, [chapter(16, { 24: "grace", 25: "to him … now", 27: "glory" }, { 25: 26 })]);
    expect(r.verses).toEqual({ 24: "grace" });
    expect(r.moved).toEqual({ 25: "14:24–26" });
    expect(r.spans).toEqual({});
  });

  it("joins 3 John 15 into 14, in order", () => {
    const r = renumberToWeb("3John", 1, [chapter(1, { 14: "I hope to see you", 15: "Peace be to you" })]);
    expect(r.verses[14]).toBe("I hope to see you Peace be to you");
  });

  it("starts Revelation 13 with 12:18 and says so when reading 12", () => {
    const r13 = renumberToWeb("Rev", 13, [chapter(13, { 1: "Then I saw a beast" }), chapter(12, { 17: "war", 18: "And he stood on the sand" })]);
    expect(r13.verses[1]).toBe("And he stood on the sand Then I saw a beast");
    const r12 = renumberToWeb("Rev", 12, [chapter(12, { 17: "war", 18: "And he stood on the sand" })]);
    expect(r12.moved).toEqual({ 18: "13:1" });
  });

  it("keeps combined verses that stay in the chapter", () => {
    const r = renumberToWeb("Eph", 3, [chapter(3, { 7: "servant … grace", 9: "plan" }, { 7: 8 })]);
    expect(r.spans).toEqual({ 7: 8 });
  });
});
