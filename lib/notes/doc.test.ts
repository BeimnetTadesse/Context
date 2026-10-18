import { describe, expect, it } from "vitest";
import { docToText, isEmptyDoc, MAX_TEXT, parseDoc, quotedPhrase, safeHref, textToDoc, withQuote } from "./doc";

const p = (text: string, marks?: unknown[]) => ({ type: "paragraph", content: [{ type: "text", text, ...(marks ? { marks } : {}) }] });
const doc = (...content: unknown[]) => ({ type: "doc", content });
const item = (...content: unknown[]) => ({ type: "listItem", content });

describe("parseDoc", () => {
  it("accepts the editor's nodes and marks", () => {
    const input = doc(
      p("Grace", [{ type: "bold" }, { type: "italic" }]),
      { type: "blockquote", content: [p("by faith")] },
      { type: "bulletList", content: [item(p("one")), item(p("two"))] },
      { type: "orderedList", attrs: { start: 3 }, content: [item(p("three"))] },
      { type: "paragraph" },
    );
    expect(parseDoc(input)).toEqual(input);
  });

  it("keeps a link's href and drops the attrs Tiptap adds", () => {
    const parsed = parseDoc(doc(p("Romans 3", [{ type: "link", attrs: { href: "/study/romans/3#v23", target: "_blank", rel: "noopener", class: null } }])));
    expect(parsed?.content[0]).toEqual(p("Romans 3", [{ type: "link", attrs: { href: "/study/romans/3#v23" } }]));
  });

  it("drops a default ordered-list start", () => {
    expect(parseDoc(doc({ type: "orderedList", attrs: { start: 1 }, content: [item(p("a"))] }))?.content[0]).toEqual({
      type: "orderedList",
      content: [item(p("a"))],
    });
  });

  it.each([
    ["not a doc", { type: "paragraph" }],
    ["no content", { type: "doc" }],
    ["unknown node", doc({ type: "image", attrs: { src: "x.png" } })],
    ["unknown mark", doc(p("x", [{ type: "underline" }]))],
    ["unsafe link", doc(p("x", [{ type: "link", attrs: { href: "javascript:alert(1)" } }]))],
    ["empty text node", doc({ type: "paragraph", content: [{ type: "text", text: "" }] })],
    ["empty list", doc({ type: "bulletList", content: [] })],
    ["list without listItem", doc({ type: "bulletList", content: [p("x")] })],
    ["html smuggled as a node", doc({ type: "html", content: "<script>" })],
  ])("rejects %s", (_, input) => {
    expect(parseDoc(input)).toBeNull();
  });

  it("rejects text longer than a note may be", () => {
    expect(parseDoc(doc(p("a".repeat(MAX_TEXT))))).not.toBeNull();
    expect(parseDoc(doc(p("a".repeat(MAX_TEXT + 1))))).toBeNull();
  });

  it("rejects documents nested too deeply", () => {
    let node: unknown = p("deep");
    for (let i = 0; i < 20; i++) node = { type: "blockquote", content: [node] };
    expect(parseDoc(doc(node))).toBeNull();
  });
});

describe("safeHref", () => {
  it.each([
    ["/study/john/1", "/study/john/1"],
    ["https://example.org/a", "https://example.org/a"],
    ["//evil.example", null],
    ["javascript:alert(1)", null],
    ["data:text/html,hi", null],
    ["not a url", null],
  ])("%s", (input, expected) => {
    expect(safeHref(input)).toBe(expected);
  });
});

describe("docToText", () => {
  it("writes one line per paragraph, with list and quote markers", () => {
    const parsed = parseDoc(
      doc(
        { type: "paragraph", content: [{ type: "text", text: "line one" }, { type: "hardBreak" }, { type: "text", text: "line two" }] },
        { type: "blockquote", content: [p("quoted")] },
        { type: "bulletList", content: [item(p("a"), { type: "bulletList", content: [item(p("nested"))] })] },
        { type: "orderedList", attrs: { start: 2 }, content: [item(p("b")), item(p("c"))] },
      ),
    )!;
    expect(docToText(parsed)).toBe(["line one", "line two", "> quoted", "• a", "  • nested", "2. b", "3. c"].join("\n"));
  });

  it("is empty for an empty document", () => {
    expect(docToText(parseDoc(doc({ type: "paragraph" }))!)).toBe("");
  });
});

describe("textToDoc", () => {
  it("turns each line into a paragraph and round-trips through docToText", () => {
    const text = "“In the beginning” — first thought\n\nsecond thought";
    const d = textToDoc(text);
    expect(parseDoc(d)).toEqual(d);
    expect(docToText(d)).toBe(text);
  });
});

describe("withQuote", () => {
  it("puts the selected phrase first, as a quote", () => {
    const d = withQuote("“the Word”", parseDoc(doc(p("my note")))!);
    expect(parseDoc(d)).toEqual(d);
    expect(docToText(d)).toBe("> “the Word”\nmy note");
  });
});

describe("isEmptyDoc", () => {
  it("an editor with nothing typed is empty", () => {
    expect(isEmptyDoc(parseDoc(doc({ type: "paragraph" }))!)).toBe(true);
    expect(isEmptyDoc(parseDoc(doc(p("x")))!)).toBe(false);
  });
});

describe("quotedPhrase", () => {
  const note = parseDoc(doc(p("my note")))!;
  it("reads the quote saved with a note on a phrase", () => {
    expect(quotedPhrase(withQuote("“the Word was God”", note), "")).toBe("the Word was God");
  });
  it("has none for a note on licensed text, which keeps only the reference", () => {
    expect(quotedPhrase(withQuote("John 1:1 (NIV)", note), "")).toBeNull();
  });
  it("reads older plain notes", () => {
    expect(quotedPhrase(null, "“In the beginning” — first thought")).toBe("In the beginning");
    expect(quotedPhrase(null, "John 1:1 (NIV) — a thought")).toBeNull();
  });
  it("has none for a note without a quote", () => {
    expect(quotedPhrase(note, "my note")).toBeNull();
  });
});
