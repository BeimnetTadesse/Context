// Parse human references ("Eph 3", "1 John 4:7-12", "rom 8:28") into structured refs.
// Pure functions — no database — so they are easy to unit-test.

import { BOOKS, type Book } from "./books";

export interface Ref {
  book: Book;
  chapter: number;
  verseStart?: number;
  verseEnd?: number;
}

const normalize = (s: string) => s.toLowerCase().replace(/[\s.]/g, "");

// Every accepted spelling → book. Built once.
const lookup = new Map<string, Book>();
for (const b of BOOKS) {
  for (const key of [b.name, b.osis, b.step, b.usfm, b.slug, ...b.aliases]) {
    lookup.set(normalize(key), b);
  }
}

export function findBook(input: string): Book | undefined {
  const key = normalize(input);
  if (!key) return undefined;
  const exact = lookup.get(key);
  if (exact) return exact;
  // Prefix match on full names ("ephes" → Ephesians), NT first so "jo" doesn't beat "john" oddly.
  const byPrefix = [...BOOKS]
    .sort((a, b) => (a.testament === b.testament ? a.id - b.id : a.testament === "NT" ? -1 : 1))
    .find((b) => normalize(b.name).startsWith(key));
  return byPrefix;
}

const REF = /^\s*((?:[1-3]\s*)?[a-z][a-z .]*?)\s*(\d+)?(?:\s*[:.]\s*(\d+)(?:\s*[-–]\s*(\d+))?)?\s*$/i;

export function parseRef(input: string): Ref | null {
  const m = REF.exec(input);
  if (!m) return null;
  const book = findBook(m[1]);
  if (!book) return null;
  const chapter = m[2] ? Number(m[2]) : 1;
  const verseStart = m[3] ? Number(m[3]) : undefined;
  const verseEnd = m[4] ? Number(m[4]) : verseStart;
  if (verseStart && verseEnd && verseEnd < verseStart) return null;
  return { book, chapter, verseStart, verseEnd };
}

export function formatRef(r: Ref): string {
  const base = `${r.book.name} ${r.chapter}`;
  if (!r.verseStart) return base;
  if (!r.verseEnd || r.verseEnd === r.verseStart) return `${base}:${r.verseStart}`;
  return `${base}:${r.verseStart}–${r.verseEnd}`;
}

/** "Eph.3.6" or "Eph.3.6-Eph.3.8" (OpenBible / OSIS style) → parts. */
export function parseOsis(osis: string): { book: string; chapter: number; verse: number } | null {
  const m = /^([1-3]?[A-Za-z]+)\.(\d+)\.(\d+)$/.exec(osis.trim());
  return m ? { book: m[1], chapter: Number(m[2]), verse: Number(m[3]) } : null;
}

export const studyPath = (book: Pick<Book, "slug">, chapter: number) => `/study/${book.slug}/${chapter}`;

export interface Suggestion {
  book: Book;
  chapter?: number; // absent: the suggestion completes the book name only
  label: string;
}

/**
 * Autocomplete for a reference being typed. "ge" → Genesis; "1 j" → 1 John…; "ps 2" → Psalm 2, Psalm 20–29…;
 * "rom 8:2" → Romans 8:2. Books whose name starts with the input come before those that only contain it or match an alias.
 */
export function suggestRefs(input: string, limit = 8): Suggestion[] {
  const m = /^\s*((?:[1-3]\s*)?[a-z][a-z .]*?)\s*(?:(\d+)(?:\s*[:.]\s*(\d+)?)?)?\s*$/i.exec(input);
  if (!m) return [];
  const [, bookPart, ch, verse] = m;
  const key = normalize(bookPart);
  if (!key) return [];

  if (ch) {
    const book = findBook(bookPart);
    if (!book) return [];
    const name = book.name === "Psalms" ? "Psalm" : book.name;
    if (verse !== undefined || /[:.]\s*$/.test(input)) {
      const c = Number(ch);
      return c >= 1 && c <= book.chapters
        ? [{ book, chapter: c, label: `${name} ${c}${verse ? `:${verse}` : ""}` }]
        : [];
    }
    const out: Suggestion[] = [];
    for (let c = 1; c <= book.chapters && out.length < limit; c++) {
      if (String(c).startsWith(ch)) out.push({ book, chapter: c, label: `${name} ${c}` });
    }
    return out;
  }

  const rank = (b: Book) => {
    const n = normalize(b.name);
    if (n.startsWith(key)) return 0;
    if ([b.osis, b.usfm, ...b.aliases].some((a) => normalize(a) === key)) return 1;
    if (n.includes(key)) return 2;
    return -1;
  };
  return BOOKS.map((b) => ({ b, r: rank(b) }))
    .filter((x) => x.r >= 0)
    .sort((x, y) => x.r - y.r || x.b.id - y.b.id)
    .slice(0, limit)
    .map(({ b }) => ({ book: b, label: b.name }));
}
