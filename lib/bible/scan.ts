// Find Bible references inside free text (commentaries, AI explanations) and resolve them.
// Pure and unit-tested. Deliberately strict: only exact book names/abbreviations count as books,
// so ordinary words followed by numbers are never mistaken for references.
import { BOOKS, type Book } from "./books";

export interface FoundRef {
  raw: string;
  index: number;
  book: Book;
  chapter: number;
  verseStart: number;
  chapterEnd: number;
  verseEnd: number;
}

const norm = (s: string) => s.toLowerCase().replace(/[\s.]/g, "");
const exact = new Map<string, Book>();
for (const b of BOOKS) for (const k of [b.name, b.osis, b.step, b.usfm, b.slug, ...b.aliases]) exact.set(norm(k), b);

/** "Ti2" / "Co1" (e-Sword style used by JFB) → "2Ti" / "1Co"; otherwise exact lookup only. */
export function bookToken(token: string): Book | undefined {
  const t = token.trim();
  const esword = /^([A-Za-z]{2,3})([1-3])$/.exec(t);
  return exact.get(norm(esword ? `${esword[2]}${esword[1]}` : t));
}

// [book] chapter:verse[-verse | -chapter:verse]
const RX =
  /(?:\b((?:[1-3]\s?)?[A-Z][a-z]{1,13}\.?|[A-Z][a-z]{1,2}[1-3]))?\s*\b(\d{1,3}):(\d{1,3})(?:\s*[-–]\s*(\d{1,3})(?::(\d{1,3}))?)?/g;

// Full book names written in prose, e.g. "as Isaiah (35:4) tells us", "Luke's Gospel, (17:25)".
const PROSE_BOOK = new RegExp(
  `\\b(${BOOKS.map((b) => b.name.replace(/ /g, "\\s")).sort((x, y) => y.length - x.length).join("|")}|Psalm)(?:'s|’s)?\\b`,
  "g",
);

// Books outside the Protestant canon: real references, but not to verses Context has.
const APOCRYPHA = /^(?:[1-4]\s?)?(Maccabees|Macc|Esdras|Esd|Tobit|Tob|Judith|Jdt|Sirach|Sir|Ecclesiasticus|Wisdom|Wis|Baruch|Bar)\.?$/i;
export const isApocrypha = (token: string) => APOCRYPHA.test(token.trim());

function bookNamedBefore(text: string, index: number): Book | undefined {
  const window = text.slice(Math.max(0, index - 45), index);
  let found: Book | undefined;
  for (const m of window.matchAll(PROSE_BOOK)) found = bookToken(m[1] === "Psalm" ? "Ps" : m[1]);
  return found;
}

export function scanRefs(text: string, contextBook?: Book): FoundRef[] {
  const out: FoundRef[] = [];
  let listBook: Book | undefined; // book of the previous reference, valid only inside a ";"/"," list
  let lastEnd = -1;
  let listIsExternal = false; // the current list started with a non-canonical book (e.g. 1 Maccabees)
  for (const m of text.matchAll(RX)) {
    const [raw, token, c, v, e1, e2] = m;
    const start = m.index! + (raw.length - raw.trimStart().length);
    let book: Book | undefined;
    const before = text.slice(Math.max(0, start - 16), start);
    const external = /(?:Psalms of|Testament of|Apocalypse of|Odes of)\s*$|\b[4-5]\s*$/.test(before) ||
      (token !== undefined && /^(Enoch|Jubilees|Baruch|Sirach|Tobit|Judith)$/.test(token));
    if (token && bookToken(token) && !external) {
      book = bookToken(token);
    } else if (external) {
      listIsExternal = true;
      lastEnd = m.index! + raw.length;
      continue;
    } else {
      if (token && !/^(See|Cp|Cf|Comp|Ver|Verse|And|Also|Compare)\.?$/i.test(token)) {
        // A word right before "3:5" that is not a book (a name, "1 Maccabees", …): not a canonical reference.
        listIsExternal = true;
        lastEnd = m.index! + raw.length;
        continue;
      }
      const between = lastEnd >= 0 ? text.slice(lastEnd, start) : null;
      // Inside a list: "; 11:13", ", 50; 22:13" (bare verse numbers allowed), " and 28:16", "; cp. 2:8".
      const inList =
        between !== null &&
        /^(?:\s*[,;]\s*\d{1,3}(?:\s*[-–]\s*\d{1,3})?)*\s*(?:[,;]|\band\b)\s*(?:(?:and|cp\.?|see|cf\.?|also)\s+)?$/i.test(between);
      if (inList && listIsExternal) {
        lastEnd = m.index! + raw.length; // "1 Maccabees 2:18; 6:28": the follow-on stays outside the canon
        continue;
      }
      book = (inList ? listBook : undefined) ?? bookNamedBefore(text, start) ?? contextBook;
    }
    listIsExternal = false;
    if (!book) continue;
    listBook = book;
    lastEnd = m.index! + raw.length;
    const chapter = Number(c);
    const verseStart = Number(v);
    const [chapterEnd, verseEnd] = e2 ? [Number(e1), Number(e2)] : [chapter, e1 ? Number(e1) : verseStart];
    if (chapterEnd < chapter || (chapterEnd === chapter && verseEnd < verseStart)) continue;
    out.push({ raw: raw.trim(), index: start, book, chapter, verseStart, chapterEnd, verseEnd });
  }
  return out;
}
