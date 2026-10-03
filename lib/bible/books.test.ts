import { describe, expect, it } from "vitest";
import { BOOKS, NT_BOOKS, ntChapter } from "./books";

describe("books", () => {
  it("has the 66-book canon with 260 New Testament chapters", () => {
    expect(BOOKS).toHaveLength(66);
    expect(NT_BOOKS.reduce((n, b) => n + b.chapters, 0)).toBe(260);
    expect(BOOKS[18]).toMatchObject({ name: "Psalms", chapters: 150 });
  });
});

describe("ntChapter", () => {
  it("accepts real New Testament chapters", () => {
    expect(ntChapter("john", 3)?.chapter).toBe(3);
    expect(ntChapter("revelation", "22")?.book.osis).toBe("Rev");
    expect(ntChapter("jude", 1)?.chapter).toBe(1);
  });

  it("rejects chapters that don't exist", () => {
    expect(ntChapter("john", 22)).toBeNull();
    expect(ntChapter("john", 99)).toBeNull();
    expect(ntChapter("jude", 2)).toBeNull();
    expect(ntChapter("john", 0)).toBeNull();
    expect(ntChapter("john", 2.5)).toBeNull();
  });

  it("rejects unknown books, Old Testament books and junk", () => {
    expect(ntChapter("hezekiah", 1)).toBeNull();
    expect(ntChapter("genesis", 1)).toBeNull();
    expect(ntChapter(undefined, 1)).toBeNull();
    expect(ntChapter({ slug: "john" }, 1)).toBeNull();
  });
});
