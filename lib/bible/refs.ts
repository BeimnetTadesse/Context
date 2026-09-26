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
