import "server-only";
import { sql } from "@/lib/db";
import type { ChapterHighlights } from "@/lib/highlights";

/** A reader's highlights in one chapter: verse number → colour. */
export async function chapterHighlights(userId: number, bookId: number, chapter: number): Promise<ChapterHighlights> {
  const rows = await sql<{ verse: number; color: ChapterHighlights[number] }[]>`
    select v.verse, h.color from highlights h join verses v on v.ord = h.ord
    where h.user_id = ${userId} and v.book_id = ${bookId} and v.chapter = ${chapter}`;
  return Object.fromEntries(rows.map((r) => [r.verse, r.color]));
}
