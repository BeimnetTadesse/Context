// USFM (Unified Standard Format Markers) → verses. Used by the import scripts.
import { readFileSync } from "node:fs";
import { bookByUsfm } from "./books";

// Strips word-level markup (\w word|strong="G…"\w*), footnotes (\f … \f*), cross-refs (\x … \x*),
// and character styles, keeping only the readable text. Tracks paragraph starts for layout.
export interface UsfmVerse { book: number; chapter: number; verse: number; verseEnd?: number; text: string; para: boolean }

export function parseUsfm(path: string): UsfmVerse[] {
  const src = readFileSync(path, "utf8");
  const id = /\\id\s+(\w{3})/.exec(src)?.[1];
  const book = id ? bookByUsfm(id) : undefined;
  if (!book) return [];

  const out: UsfmVerse[] = [];
  let chapter = 0;
  let pendingPara = false;
  let cur: UsfmVerse | null = null;

  const clean = (s: string) =>
    s
      .replace(/\\f\s.*?\\f\*/g, "")
      .replace(/\\x\s.*?\\x\*/g, "")
      .replace(/\\\+?w\s+([^|\\]*?)(\|[^\\]*)?\\\+?w\*/g, "$1")
      .replace(/\\\+?[a-z]+\d*\*?/g, "")
      .replace(/\s+/g, " ");

  for (const line of src.split(/\r?\n/)) {
    const marker = /^\\(\w+\d*)\s?(.*)$/.exec(line.trim());
    if (!marker) {
      if (cur && line.trim()) cur.text += " " + clean(line);
      continue;
    }
    const [, tag, rest] = marker;
    if (tag === "c") {
      chapter = Number(rest.trim());
      cur = null;
      continue;
    }
    if (["p", "m", "pi", "pi1", "pi2", "q", "q1", "q2", "q3", "nb", "li", "li1", "li2", "b", "pmo", "mi"].includes(tag)) {
      pendingPara = pendingPara || tag !== "nb";
      if (rest && cur) cur.text += " " + clean(rest);
      continue;
    }
    if (tag === "v") {
      const vm = /^(\d+)(?:-(\d+))?\s*(.*)$/.exec(rest);
      if (!vm || !chapter) continue;
      cur = {
        book: book.id, chapter, verse: Number(vm[1]),
        verseEnd: vm[2] ? Number(vm[2]) : undefined,
        text: clean(vm[3]), para: pendingPara,
      };
      pendingPara = false;
      out.push(cur);
      continue;
    }
    // headings, titles, etc. (\s, \d, \mt, \h, \toc …) are not verse text
  }
  for (const v of out) v.text = v.text.replace(/\s+([,.;:!?’”»])/g, "$1").trim();
  return out;
}

