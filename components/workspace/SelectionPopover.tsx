"use client";

import { useEffect, useState } from "react";
import { postJson, useStudy } from "@/components/study/context";

interface Sel {
  text: string;
  verse: number | null;
  /** Licensed version the selection touches (e.g. "NASV"): only the verse reference may leave the page. */
  licensed: string | null;
  x: number;
  y: number;
}

/**
 * Select any phrase in Read → Text or Assumption? · Ask · Add note. In licensed text (NIV, NASV…) the wording is
 * never sent anywhere: Ask asks about the verse by reference, and the note is saved without a quote.
 */
export function SelectionPopover({
  container,
  onCheck,
  onAsk,
  onAskVerse,
}: {
  container: React.RefObject<HTMLElement | null>;
  onCheck: (text: string) => void;
  onAsk: (text: string) => void;
  /** Licensed text: ask by reference ("Romans 16:3"), never with the wording. */
  onAskVerse: (ref: string) => void;
}) {
  const { book, chapter, setNoteCount } = useStudy();
  const [sel, setSel] = useState<Sel | null>(null);
  const [noting, setNoting] = useState(false);
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const onUp = () => {
      const s = window.getSelection();
      const text = s?.toString().trim() ?? "";
      if (!s || s.rangeCount === 0 || text.length < 3 || text.length > 400) return;
      const range = s.getRangeAt(0);
      if (!container.current?.contains(range.commonAncestorContainer)) return;
      const rect = range.getBoundingClientRect();
      const el = (range.startContainer.parentElement as HTMLElement | null)?.closest("[id^='v']");
      const verse = el ? Number(el.id.slice(1)) || null : null;
      const touched = [...container.current.querySelectorAll<HTMLElement>("[data-licensed]")].find((n) => range.intersectsNode(n));
      setSel({ text, verse, licensed: touched?.dataset.licensed ?? null, x: rect.left + rect.width / 2, y: rect.top });
      setNoting(false);
      setNote("");
      setSaved(false);
    };
    const onDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("[data-popover]")) setSel(null);
    };
    document.addEventListener("mouseup", onUp);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("mousedown", onDown);
    };
  }, [container]);

  if (!sel) return null;
  const ref = `${book.name} ${chapter}${sel.verse ? `:${sel.verse}` : ""}`;
  const close = () => {
    setSel(null);
    window.getSelection()?.removeAllRanges();
  };

  return (
    <div
      data-popover
      className="fixed z-40 -translate-x-1/2 -translate-y-full rounded-xl bg-ink p-1 text-sm text-paper shadow-xl"
      style={{ left: Math.max(170, Math.min(sel.x, window.innerWidth - 170)), top: Math.max(sel.y - 10, 70) }}
    >
      {noting ? (
        <form
          className="flex w-80 flex-col gap-2 p-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!note.trim()) return;
            const r = await postJson<{ count: number }>("/api/notes", {
              book: book.slug, chapter, kind: "note", verse: sel.verse,
              body: sel.licensed ? `${ref} (${sel.licensed}) — ${note.trim()}` : `“${sel.text}” — ${note.trim()}`,
            });
            setNoteCount(r.count);
            setSaved(true);
            setTimeout(close, 900);
          }}
        >
          <textarea autoFocus value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Your note…"
            className="rounded-lg bg-paper/10 px-3 py-2 text-paper placeholder:text-paper/50 focus:outline-none" />
          <button className="self-end rounded-lg bg-paper px-3 py-1 text-ink">{saved ? "Saved ✓" : "Save note"}</button>
        </form>
      ) : (
        <div className="flex">
          {sel.licensed ? (
            <button onClick={() => { onAskVerse(ref); close(); }} className="rounded-lg px-3 py-2 hover:bg-paper/10">Ask about {sel.verse ? `verse ${sel.verse}` : "this"}</button>
          ) : (
            <>
              <button onClick={() => { onCheck(sel.text); close(); }} className="rounded-lg px-3 py-2 hover:bg-paper/10">Text or Assumption?</button>
              <button onClick={() => { onAsk(sel.text); close(); }} className="rounded-lg px-3 py-2 hover:bg-paper/10">Ask about this</button>
            </>
          )}
          <button onClick={() => setNoting(true)} className="rounded-lg px-3 py-2 hover:bg-paper/10">Add note</button>
        </div>
      )}
    </div>
  );
}
