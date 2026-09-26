"use client";

import { useEffect, useState } from "react";
import { postJson, useStudy } from "@/components/study/context";

interface Sel {
  text: string;
  verse: number | null;
  x: number;
  y: number;
}

/** Select any phrase in Read → Text or Assumption? · Ask · Add note. */
export function SelectionPopover({
  container,
  onCheck,
  onAsk,
}: {
  container: React.RefObject<HTMLElement | null>;
  onCheck: (text: string) => void;
  onAsk: (text: string) => void;
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
      setSel({ text, verse, x: rect.left + rect.width / 2, y: rect.top });
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
              book: book.slug, chapter, kind: "note", verse: sel.verse, body: `“${sel.text}” — ${note.trim()}`,
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
          <button onClick={() => { onCheck(sel.text); close(); }} className="rounded-lg px-3 py-2 hover:bg-paper/10">Text or Assumption?</button>
          <button onClick={() => { onAsk(sel.text); close(); }} className="rounded-lg px-3 py-2 hover:bg-paper/10">Ask about this</button>
          <button onClick={() => setNoting(true)} className="rounded-lg px-3 py-2 hover:bg-paper/10">Add note</button>
        </div>
      )}
    </div>
  );
}
