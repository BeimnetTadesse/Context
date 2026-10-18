// A note's rich text, as the editor (Tiptap/ProseMirror) saves it: a small, fixed set of nodes and marks.
// Pure functions — no database — so the server can check what readers send and derive the plain-text body.

export type Mark = { type: "bold" } | { type: "italic" } | { type: "link"; attrs: { href: string } };
export type Inline = { type: "text"; text: string; marks?: Mark[] } | { type: "hardBreak" };
export type Paragraph = { type: "paragraph"; content?: Inline[] };
export type ListItem = { type: "listItem"; content: Block[] };
export type Block =
  | Paragraph
  | { type: "blockquote"; content: Block[] }
  | { type: "bulletList"; content: ListItem[] }
  | { type: "orderedList"; attrs?: { start: number }; content: ListItem[] };
// A type, not an interface, so it can be passed to sql.json() (which needs an index signature).
export type NoteDoc = { type: "doc"; content: Block[] };

/** Same cap as a plain note's body. */
export const MAX_TEXT = 5000;
const MAX_NODES = 2000;
const MAX_DEPTH = 8;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

/** Site paths and web links only: no javascript:, data: or protocol-relative URLs. */
export function safeHref(href: unknown): string | null {
  if (typeof href !== "string" || href.length > 500) return null;
  const h = href.trim();
  if (h.startsWith("/") && !h.startsWith("//")) return h;
  try {
    const u = new URL(h);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : null;
  } catch {
    return null;
  }
}

/**
 * Check a document sent by a reader and return a clean copy, or null if anything is unexpected.
 * Unknown node or mark types are rejected, not dropped, so a bad editor build fails loudly; unknown attrs
 * (Tiptap adds target, rel, class to links) are dropped.
 */
export function parseDoc(input: unknown): NoteDoc | null {
  let nodes = 0;
  const fail = Symbol();
  const count = () => {
    if (++nodes > MAX_NODES) throw fail;
  };

  const marks = (v: unknown): Mark[] | undefined => {
    if (v === undefined) return undefined;
    if (!Array.isArray(v)) throw fail;
    return v.map((m): Mark => {
      if (!isObj(m)) throw fail;
      if (m.type === "bold" || m.type === "italic") return { type: m.type };
      if (m.type === "link" && isObj(m.attrs)) {
        const href = safeHref(m.attrs.href);
        if (href) return { type: "link", attrs: { href } };
      }
      throw fail;
    });
  };

  const inline = (v: unknown): Inline => {
    count();
    if (!isObj(v)) throw fail;
    if (v.type === "hardBreak") return { type: "hardBreak" };
    if (v.type === "text" && typeof v.text === "string" && v.text) {
      const m = marks(v.marks);
      return m?.length ? { type: "text", text: v.text, marks: m } : { type: "text", text: v.text };
    }
    throw fail;
  };

  const list = <T>(v: unknown, each: (x: unknown) => T, optional = false): T[] => {
    if (v === undefined && optional) return [];
    if (!Array.isArray(v) || (!optional && !v.length)) throw fail;
    return v.map(each);
  };

  const block = (v: unknown, depth: number): Block => {
    count();
    if (!isObj(v) || depth > MAX_DEPTH) throw fail;
    const blocks = (c: unknown) => list(c, (x) => block(x, depth + 1));
    const items = (c: unknown) =>
      list(c, (x): ListItem => {
        count();
        if (!isObj(x) || x.type !== "listItem") throw fail;
        return { type: "listItem", content: blocks(x.content) };
      });
    switch (v.type) {
      case "paragraph": {
        const content = list(v.content, inline, true);
        return content.length ? { type: "paragraph", content } : { type: "paragraph" };
      }
      case "blockquote":
        return { type: "blockquote", content: blocks(v.content) };
      case "bulletList":
        return { type: "bulletList", content: items(v.content) };
      case "orderedList": {
        const start = isObj(v.attrs) && Number.isInteger(v.attrs.start) ? (v.attrs.start as number) : 1;
        if (start < 0 || start > 10000) throw fail;
        return start === 1 ? { type: "orderedList", content: items(v.content) } : { type: "orderedList", attrs: { start }, content: items(v.content) };
      }
      default:
        throw fail;
    }
  };

  try {
    if (!isObj(input) || input.type !== "doc") return null;
    const doc: NoteDoc = { type: "doc", content: list(input.content, (x) => block(x, 1)) };
    return docToText(doc).length <= MAX_TEXT ? doc : null;
  } catch (e) {
    if (e === fail) return null;
    throw e;
  }
}

/** Plain text for the body column: one line per paragraph, list markers kept, quotes marked with "> ". */
export function docToText(doc: NoteDoc): string {
  const inlineText = (p: Paragraph) => (p.content ?? []).map((n) => (n.type === "text" ? n.text : "\n")).join("");
  const lines = (b: Block): string[] => {
    switch (b.type) {
      case "paragraph":
        return inlineText(b).split("\n");
      case "blockquote":
        return b.content.flatMap(lines).map((l) => `> ${l}`);
      case "bulletList":
      case "orderedList": {
        const start = b.type === "orderedList" ? (b.attrs?.start ?? 1) : 0;
        return b.content.flatMap((item, i) => {
          const marker = b.type === "bulletList" ? "• " : `${start + i}. `;
          const inner = item.content.flatMap(lines);
          return inner.map((l, j) => (j === 0 ? marker : " ".repeat(marker.length)) + l);
        });
      }
    }
  };
  return doc.content.flatMap(lines).join("\n").trim();
}

/** An old plain-text note as a document, so it can be opened in the editor: one paragraph per line. */
export function textToDoc(text: string): NoteDoc {
  const content: Block[] = text.split("\n").map((line) => (line ? { type: "paragraph", content: [{ type: "text", text: line }] } : { type: "paragraph" }));
  return { type: "doc", content };
}

/** True when the reader hasn't written anything yet (the editor's empty state is one empty paragraph). */
export const isEmptyDoc = (doc: NoteDoc) => docToText(doc) === "";

/**
 * A note on a selected phrase: the phrase (or, for licensed text, only its reference) as a quote, then the reader's note.
 * The quote is part of the document, so it is kept when the note is edited later.
 */
export function withQuote(quote: string, doc: NoteDoc): NoteDoc {
  return { type: "doc", content: [{ type: "blockquote", content: [{ type: "paragraph", content: [{ type: "text", text: quote }] }] }, ...doc.content] };
}

/**
 * The words a note was written on, as they appear in the text: the “…” quote the popover saves first in the note,
 * or, for older plain notes, the “…” before the dash. Notes on licensed text keep only a reference, so they have none.
 */
export function quotedPhrase(doc: NoteDoc | null, body: string): string | null {
  if (!doc) return /^“([\s\S]+?)” — /.exec(body)?.[1] ?? null;
  const first = doc.content[0];
  if (first?.type !== "blockquote" || first.content[0]?.type !== "paragraph") return null;
  const text = (first.content[0].content ?? []).map((n) => (n.type === "text" ? n.text : "")).join("");
  return /^“([\s\S]+)”$/.exec(text)?.[1] ?? null;
}
