import "server-only";
import { sql } from "@/lib/db";
import type { HighlightColor } from "@/lib/highlights";
import type { Label } from "@/lib/labels";

// Everything one reader has saved: for the profile page, the notebook, and "download my data".

export const REFLECTION_KINDS = ["reflection", "text_says", "i_bring"];

export async function getAccount(userId: number) {
  const [row] = await sql<{
    created_at: Date; last_sign_in: Date | null; notes: number; reflections: number; highlights: number;
    guesses: number; correct: number; questions: number;
  }[]>`
    select u.created_at, u.last_sign_in,
      (select count(*)::int from notes where user_id = u.id and kind = 'note') as notes,
      (select count(*)::int from notes where user_id = u.id and kind = any(${REFLECTION_KINDS})) as reflections,
      (select count(*)::int from highlights where user_id = u.id) as highlights,
      (select count(*)::int from assumption_guesses where user_id = u.id) as guesses,
      (select count(*)::int from assumption_guesses where user_id = u.id and correct) as correct,
      (select count(*)::int from ai_runs where user_id = u.id and kind in ('ask', 'assumption')) as questions
    from users u where u.id = ${userId}`;
  return row ?? null;
}

export type NoteItem = {
  id: number; kind: string; body: string; created_at: Date; book: string; slug: string; chapter: number;
  verse: number | null; prompt: string | null;
};
export type HighlightItem = { ord: number; color: HighlightColor; created_at: Date; book: string; slug: string; chapter: number; verse: number; text: string };
export type GuessItem = { item_id: number; guess: Label; expected: Label; correct: boolean; statement: string; book: string; slug: string; chapter: number };

export async function getNotebook(userId: number) {
  const [notes, highlights, guesses] = await Promise.all([
    sql<NoteItem[]>`
      select n.id, n.kind, n.body, n.created_at, b.name as book, b.slug, n.chapter, v.verse, r.text as prompt
      from notes n join books b on b.id = n.book_id
      left join verses v on v.ord = n.start_ord left join reflection_items r on r.id = n.item_id
      where n.user_id = ${userId} and n.kind <> 'text_issue'
      order by b.id, n.chapter, v.verse nulls first, n.created_at`,
    sql<HighlightItem[]>`
      select h.ord, h.color, h.created_at, b.name as book, b.slug, v.chapter, v.verse, t.text
      from highlights h join verses v on v.ord = h.ord join books b on b.id = v.book_id
      join verse_texts t on t.ord = h.ord and t.translation_code = 'WEB'
      where h.user_id = ${userId} order by h.ord`,
    sql<GuessItem[]>`
      select g.item_id, g.guess, r.expected_label as expected, g.correct, r.text as statement, b.name as book, b.slug, r.chapter
      from assumption_guesses g join reflection_items r on r.id = g.item_id join books b on b.id = r.book_id
      where g.user_id = ${userId} order by b.id, r.chapter, r.sort`,
  ]);
  return { notes, highlights, guesses };
}
