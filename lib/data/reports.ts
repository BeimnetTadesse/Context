import "server-only";
import { sql } from "@/lib/db";

export type TextReport = {
  id: number; book: string; slug: string; chapter: number; translation: string; body: string;
  created_at: Date; resolved_at: Date | null;
};

/** Problems readers reported in a Bible text: open ones first (newest first), then the last 20 fixed. */
export async function getTextReports() {
  const rows = await sql<TextReport[]>`
    (select r.id, b.name as book, b.slug, r.chapter, r.translation, r.body, r.created_at, r.resolved_at
     from text_reports r join books b on b.id = r.book_id where r.resolved_at is null order by r.created_at desc)
    union all
    (select r.id, b.name as book, b.slug, r.chapter, r.translation, r.body, r.created_at, r.resolved_at
     from text_reports r join books b on b.id = r.book_id where r.resolved_at is not null order by r.resolved_at desc limit 20)`;
  return { open: rows.filter((r) => !r.resolved_at), fixed: rows.filter((r) => r.resolved_at) };
}
