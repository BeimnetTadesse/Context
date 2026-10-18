"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { docToText, quotedPhrase } from "@/lib/notes/doc";
import { NoteView } from "./NoteView";
import { versionLabel } from "./NotesRail";
import type { VerseNote } from "./VerseNotes";

/** What the reader wrote, without the quoted phrase the note starts with. */
function written(n: VerseNote) {
  if (!n.doc) return quotedPhrase(null, n.body) ? n.body.replace(/^“[\s\S]+?” — /, "") : n.body;
  const [first, ...rest] = n.doc.content;
  return docToText({ type: "doc", content: first?.type === "blockquote" ? rest : n.doc.content });
}

/** Briefly tint a verse so the eye finds it after scrolling. */
function flash(verse: number) {
  const el = document.getElementById(`v${verse}`);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.animate([{ backgroundColor: "var(--l-personal-bg)" }, { backgroundColor: "transparent" }], { duration: 1800, easing: "ease-out" });
}

/**
 * Every note the reader has in this chapter, in verse order: search them, open one to read it in full,
 * and jump to its verse. `focus` (a verse) opens that verse's notes, e.g. from a Note chip in the text.
 */
export function ChapterNotes({
  notes,
  chapter,
  focus,
  onGo,
}: {
  notes: VerseNote[];
  chapter: number;
  focus: { verse: number; at: number } | null;
  /** Called before jumping to a verse (e.g. to switch to the Read step). */
  onGo?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  const list = useRef<HTMLUListElement>(null);

  const sorted = useMemo(() => [...notes].sort((a, b) => a.verse - b.verse || a.id - b.id), [notes]);
  const q = query.trim().toLowerCase();
  const shown = q
    ? sorted.filter((n) => `${chapter}:${n.verse} ${quotedPhrase(n.doc, n.body) ?? ""} ${written(n)}`.toLowerCase().includes(q))
    : sorted;

  // A chip in the text asked for this verse's notes: open the first (adjusting state while rendering, as React
  // recommends for props that reset state), then bring it into view once it's on screen.
  const [seen, setSeen] = useState(focus);
  if (focus !== seen) {
    setSeen(focus);
    const first = focus && sorted.find((n) => n.verse === focus.verse);
    if (first) {
      setQuery("");
      setOpen(first.id);
    }
  }
  useEffect(() => {
    if (focus && open !== null) list.current?.querySelector(`[data-note="${open}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [focus, open]);

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="mb-2 flex items-baseline justify-between">
        <p className="eyebrow text-muted">Your notes</p>
        {notes.length > 0 && <span className="font-mono text-xs text-muted">{notes.length}</span>}
      </div>

      {notes.length === 0 ? (
        <p className="text-sm leading-relaxed text-muted">Select any words in the text and choose “Add note”. Your notes on this chapter collect here.</p>
      ) : (
        <>
          {notes.length > 3 && (
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search notes…"
              aria-label="Search your notes"
              className="mb-2 w-full rounded-lg border border-rule bg-card px-3 py-1.5 text-sm placeholder:text-muted focus:border-ink focus:outline-none"
            />
          )}
          <ul ref={list} className="-mx-2 min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-2">
            {shown.map((n) => {
              const phrase = quotedPhrase(n.doc, n.body);
              const isOpen = open === n.id;
              return (
                <li key={n.id} data-note={n.id}>
                  <div className={`rounded-xl transition ${isOpen ? "bg-card shadow-[0_1px_0_var(--rule),0_8px_24px_-18px_rgba(40,30,20,0.35)]" : "hover:bg-paper-2"}`}>
                    <button type="button" onClick={() => setOpen(isOpen ? null : n.id)} aria-expanded={isOpen} className="block w-full px-3 py-2.5 text-left">
                      <span className="flex items-baseline gap-2">
                        <span className="font-mono text-xs text-accent">{chapter}:{n.verse}</span>
                        {versionLabel(n.version) && <span className="font-mono text-[0.6rem] uppercase text-muted">{versionLabel(n.version)}</span>}
                        {phrase && <span className="truncate font-serif text-sm italic text-muted">“{phrase}”</span>}
                      </span>
                      {!isOpen && <span className="mt-0.5 line-clamp-2 text-sm leading-snug text-ink-2">{written(n)}</span>}
                    </button>
                    {isOpen && (
                      <div className="px-3 pb-3">
                        {n.doc ? <NoteView doc={n.doc} className="font-serif text-[0.98rem] leading-relaxed" /> : <p className="whitespace-pre-wrap font-serif text-[0.98rem] leading-relaxed">{n.body}</p>}
                        <div className="mt-2 flex gap-4 text-xs">
                          <button type="button" onClick={() => { onGo?.(); setTimeout(() => flash(n.verse), 80); }} className="text-muted underline-offset-4 hover:text-ink hover:underline">
                            Go to verse {n.verse}
                          </button>
                          <a href="/notebook" className="text-muted underline-offset-4 hover:text-ink hover:underline">Edit in notebook</a>
                        </div>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
            {shown.length === 0 && <li className="px-3 py-2 text-sm text-muted">No notes match “{query}”.</li>}
          </ul>
        </>
      )}
    </section>
  );
}
