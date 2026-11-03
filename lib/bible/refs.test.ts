import { describe, expect, it } from "vitest";
import { formatRef, parseOsis, parseRef, suggestRefs } from "./refs";

describe("parseRef", () => {
  it.each([
    ["Eph 3", "Ephesians", 3, undefined, undefined],
    ["ephesians 3:6", "Ephesians", 3, 6, 6],
    ["Eph 3:1-13", "Ephesians", 3, 1, 13],
    ["1 John 4:7–12", "1 John", 4, 7, 12],
    ["1jn 4", "1 John", 4, undefined, undefined],
    ["rom 8:28", "Romans", 8, 28, 28],
    ["Rev", "Revelation", 1, undefined, undefined],
    ["Phil 2.5", "Philippians", 2, 5, 5],
    ["mt 5", "Matthew", 5, undefined, undefined],
    ["Philemon 1", "Philemon", 1, undefined, undefined],
  ])("%s", (input, book, chapter, vs, ve) => {
    const r = parseRef(input);
    expect(r?.book.name).toBe(book);
    expect(r?.chapter).toBe(chapter);
    expect(r?.verseStart).toBe(vs);
    expect(r?.verseEnd).toBe(ve);
  });

  it("rejects nonsense and backwards ranges", () => {
    expect(parseRef("hello world 3")).toBeNull();
    expect(parseRef("Eph 3:9-2")).toBeNull();
    expect(parseRef("")).toBeNull();
  });
});

describe("formatRef", () => {
  it("formats ranges with an en dash", () => {
    expect(formatRef(parseRef("Eph 3:1-13")!)).toBe("Ephesians 3:1–13");
    expect(formatRef(parseRef("Eph 3")!)).toBe("Ephesians 3");
  });
});

describe("parseOsis", () => {
  it("parses OpenBible ids", () => {
    expect(parseOsis("1Cor.15.9")).toEqual({ book: "1Cor", chapter: 15, verse: 9 });
    expect(parseOsis("bad")).toBeNull();
  });
});

describe("suggestRefs", () => {
  const labels = (q: string) => suggestRefs(q).map((s) => s.label);

  it("completes book names, prefix matches first", () => {
    expect(labels("ge")).toEqual(["Genesis", "Judges"]); // "Judges" only contains it
    expect(labels("1 j")).toEqual(["1 John"]);
    expect(labels("john").slice(0, 4)).toEqual(["John", "1 John", "2 John", "3 John"]);
    expect(labels("ps")[0]).toBe("Psalms");
  });

  it("suggests chapters that start with the typed number, within the book", () => {
    expect(labels("ps 2").slice(0, 3)).toEqual(["Psalm 2", "Psalm 20", "Psalm 21"]);
    expect(labels("jude 2")).toEqual([]);
    expect(labels("Genesis 5")).toEqual(["Genesis 5", "Genesis 50"]);
  });

  it("keeps a verse once one is typed, and rejects a missing chapter", () => {
    expect(labels("rom 8:28")).toEqual(["Romans 8:28"]);
    expect(labels("rom 17:1")).toEqual([]);
  });

  it("returns nothing for empty or unknown input", () => {
    expect(labels("")).toEqual([]);
    expect(labels("xyz")).toEqual([]);
  });
});
