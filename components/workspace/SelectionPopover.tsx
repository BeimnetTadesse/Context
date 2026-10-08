"use client";

import { useEffect, useState } from "react";
import { postJson, useStudy } from "@/components/study/context";
import { HIGHLIGHTS, type ChapterHighlights, type HighlightColor } from "@/lib/highlights";

interface Sel {
  text: string;
  verse: number | null;
  /** Every verse the selection touches (for highlighting). */
  verses: number[];
  /** Licensed version the selection touches (e.g. "NASV"): only the verse reference may leave the page. */
  licensed: string | null;
  x: number;
  y: number;
}

/**
 * Select any phrase in Read → highlight the verse(s) · Text or Assumption? · Ask · Add note. In licensed text (NIV, NASV…) the wording is
 * never sent anywhere: Ask asks about the verse by reference, and the note is saved without a quote.
 */
export function SelectionPopover({
  container,
  onCheck,
  onAsk,
  onAskVerse,
  highlights,
  onHighlight,
}: {
  container: React.RefObject<HTMLElement | null>;
  onCheck: (text: string) => void;
  onAsk: (text: string) => void;
  /** Licensed text: ask by reference ("Romans 16:3"), never with the wording. */
  onAskVerse: (ref: string) => void;
  highlights: ChapterHighlights;
  /** Colour these verses, or clear them (null). */
  onHighlight: (verses: number[], color: HighlightColor | null) => void;
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
      const verseAt = (node: Node) => {
        const el = (node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement)?.closest("[id^='v']");
        return el ? Number(el.id.slice(1)) || null : null;
      };
      const verse = verseAt(range.startContainer);
      const last = verseAt(range.endContainer) ?? verse;
      const verses = verse && last ? Array.from({ length: Math.max(0, last - verse) + 1 }, (_, i) => verse + i) : [];
      const touched = [...container.current.querySelectorAll<HTMLElement>("[data-licensed]")].find((n) => range.intersectsNode(n));
      setSel({ text, verse, verses, licensed: touched?.dataset.licensed ?? null, x: rect.left + rect.width / 2, y: rect.top });
      setNoting(false);
      setNote("");
      setSaved(false);
    };
    const onDown = (e: Event) => {
      if (!(e.target as HTMLElement).closest("[data-popover]")) setSel(null);
    };
    // Phones select text by touch: read the selection once the finger lifts and the selection has settled.
    const onTouchEnd = () => setTimeout(onUp, 60);
    document.addEventListener("mouseup", onUp);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchend", onTouchEnd);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchstart", onDown);
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
        <div className="flex flex-col">
          {sel.verses.length > 0 && (
            <div className="flex items-center gap-2 border-b border-paper/15 px-3 py-2">
              <span className="mr-1 text-xs text-paper/60">Highlight {sel.verses.length > 1 ? `${sel.verses[0]}–${sel.verses[sel.verses.length - 1]}` : `v${sel.verses[0]}`}</span>
              {(Object.keys(HIGHLIGHTS) as HighlightColor[]).map((c) => (
                <button
                  key={c}
                  onClick={() => { onHighlight(sel.verses, c); close(); }}
                  aria-label={`Highlight ${HIGHLIGHTS[c].name.toLowerCase()}`}
                  title={HIGHLIGHTS[c].name}
                  className={`h-6 w-6 rounded-full border-2 transition hover:scale-110 ${sel.verses.every((v) => highlights[v] === c) ? "border-paper" : "border-transparent"}`}
                  style={{ backgroundColor: HIGHLIGHTS[c].fill }}
                />
              ))}
              {sel.verses.some((v) => highlights[v]) && (
                <button onClick={() => { onHighlight(sel.verses, null); close(); }} className="ml-1 rounded-md px-2 py-0.5 text-xs text-paper/80 hover:bg-paper/10">
                  Clear
                </button>
              )}
            </div>
          )}
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
        </div>
      )}
    </div>
  );
}
