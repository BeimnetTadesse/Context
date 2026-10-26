import { describe, expect, it } from "vitest";
import { parseHeadings } from "./import-headings";

describe("parseHeadings", () => {
  it("places each heading at the verse that follows it, across chapters", () => {
    const usfm = ["\\c 2", "\\v 25 He knew what was in a man.", "\\c 3", "\\s1 Jesus and Nicodemus", "\\r (Genesis 22:1–10)", "\\m",
      "\\v 1 Now there was a man…", "\\v 21 …in God.", "\\s1 John’s Testimony about Jesus", "\\m", "\\v 22 After this…"].join("\n");
    expect(parseHeadings(usfm)).toEqual([
      { chapter: 3, verse: 1, title: "Jesus and Nicodemus" },
      { chapter: 3, verse: 22, title: "John’s Testimony about Jesus" },
    ]);
  });
});
