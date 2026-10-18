import { quotedPhrase, type NoteDoc } from "@/lib/notes/doc";
import { NoteView } from "./NoteView";

/** A reader's note on a verse of the chapter they're reading (kind "note", anchored by its first verse). */
export interface NoteReply {
  id: number;
  doc: NoteDoc | null;
  body: string;
  /** ISO time. */
  createdAt: string;
}

export interface VerseNote {
  id: number;
  verse: number;
  doc: NoteDoc | null;
  body: string;
  /** The translation it was written on (e.g. "KJV"); null for older notes. */
  version: string | null;
  /** ISO time. */
  createdAt: string;
  replies: NoteReply[];
}

/** Notes per verse, for the marker beside each verse number. */
export const notedVerses = (notes: VerseNote[]) =>
  notes.reduce<Record<number, number>>((m, n) => ({ ...m, [n.verse]: (m[n.verse] ?? 0) + 1 }), {});

/** Phrases with notes, per verse, for marking them in the text. */
export function notedPhrases(notes: VerseNote[]) {
  const out: Record<number, string[]> = {};
  for (const n of notes) {
    const q = quotedPhrase(n.doc, n.body);
    if (q) (out[n.verse] ??= []).push(q);
  }
  return out;
}

/** "Your notes" in the margin, above the commentators, when a noted verse is open. */
export function VerseNotes({ verse, chapter, notes }: { verse: number; chapter: number; notes: VerseNote[] }) {
  if (!notes.length) return null;
  return (
    <div className="rounded-2xl border border-[var(--l-personal)]/40 bg-[var(--l-personal-bg)] p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <p className="eyebrow text-ink-2">Your {notes.length > 1 ? `${notes.length} notes` : "note"} · {chapter}:{verse}</p>
        <a href="/notebook" className="text-xs text-muted underline-offset-4 hover:text-ink hover:underline">Notebook →</a>
      </div>
      <ul className="space-y-4">
        {notes.map((n) => (
          <li key={n.id} className="text-[0.98rem] leading-relaxed text-ink">
            {n.doc ? <NoteView doc={n.doc} className="font-serif" /> : <p className="whitespace-pre-wrap font-serif">{n.body}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
