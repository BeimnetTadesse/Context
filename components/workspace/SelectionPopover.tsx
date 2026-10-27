"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { postJson, useStudy } from "@/components/study/context";
import { HIGHLIGHTS, type ChapterHighlights, type HighlightColor } from "@/lib/highlights";
import { docToText, isEmptyDoc, withQuote, type NoteDoc } from "@/lib/notes/doc";
import type { VerseNote } from "@/components/notes/VerseNotes";
import { chapterLabel } from "@/lib/bible/books";

// Loaded only when a reader chooses "Add note".
const NoteEditor = dynamic(() => import("@/components/notes/NoteEditor"), {
  ssr: false,
  loading: () => <div className="h-[8.5rem] rounded-xl border border-rule bg-paper" />,
});

interface Sel {
  text: string;
  verse: number | null;
  /** Every verse the selection touches (for highlighting). */
  verses: number[];
  /** Licensed version the selection touches (e.g. "NASV"): only the verse reference may leave the page. */
  licensed: string | null;
  /** The translation the words were selected in (e.g. "KJV"). */
  version: string | null;
  /** The selected text, kept so the popover can follow it when the page scrolls. */
  range: Range;
  box: Box;
}

interface Box {
  x: number;
  top: number;
  bottom: number;
}

const measure = (range: Range): Box => {
  const r = range.getBoundingClientRect();
  return { x: r.left + r.width / 2, top: r.top, bottom: r.bottom };
};

/**
 * The verse words a double-click in the space around them belongs to: the verse it's in, and, side by side, the
 * version column under the pointer (or the nearest one).
 */
function verseTextNear(target: HTMLElement, x: number): HTMLElement | null {
  const own = target.closest?.<HTMLElement>("[data-version]");
  if (own?.querySelector("[data-verse-text]") && !own.querySelector("[id^='v'] [data-version]")) {
    // Inside one column: in compare view that column is this verse; in flowing text, use the verse clicked in.
    const verse = target.closest<HTMLElement>("[id^='v']");
    if (verse && own.contains(verse)) return verse.querySelector<HTMLElement>("[data-verse-text]");
    // Compare view: the column is one verse. Flowing text between verses (a paragraph gap): leave it to the browser.
    return target.closest("[id^='v']") ? own.querySelector<HTMLElement>("[data-verse-text]") : null;
  }
  const row = target.closest?.<HTMLElement>("[id^='v']");
  const cells = row ? [...row.querySelectorAll<HTMLElement>("[data-version]")].filter((c) => c.querySelector("[data-verse-text]")) : [];
  const distance = (c: HTMLElement) => {
    const r = c.getBoundingClientRect();
    return x < r.left ? r.left - x : x > r.right ? x - r.right : 0;
  };
  const cell = cells.sort((a, b) => distance(a) - distance(b))[0];
  return cell?.querySelector<HTMLElement>("[data-verse-text]") ?? row?.querySelector<HTMLElement>("[data-verse-text]") ?? null;
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
  onNoteSaved,
  askEnabled = true,
}: {
  container: React.RefObject<HTMLElement | null>;
  onCheck: (text: string) => void;
  onAsk: (text: string) => void;
  /** Licensed text: ask by reference ("Romans 16:3"), never with the wording. */
  onAskVerse: (ref: string) => void;
  highlights: ChapterHighlights;
  /** Colour these verses, or clear them (null). */
  onHighlight: (verses: number[], color: HighlightColor | null) => void;
  /** A note was saved on this verse: show its marker straight away. */
  onNoteSaved: (note: VerseNote) => void;
  /** Ask and Text or Assumption? open in the margin; off while it's hidden. */
  askEnabled?: boolean;
}) {
  const { book, chapter, setNoteCount } = useStudy();
  const [sel, setSel] = useState<Sel | null>(null);
  const [noting, setNoting] = useState(false);
  const [note, setNote] = useState<NoteDoc | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const onUp = (e?: Event) => {
      const s = window.getSelection();
      if (!s) return;
      // Double- or triple-click in a verse: select exactly that verse's words in that version, instead of the
      // browser's word or paragraph (which runs on into Note chips, labels and other verses).
      if (e instanceof MouseEvent && e.detail >= 2) {
        const target = e.target as HTMLElement;
        const verse = target.closest?.<HTMLElement>("[data-verse-text]") ?? verseTextNear(target, e.clientX);
        if (verse && container.current?.contains(verse)) {
          const whole = document.createRange();
          whole.selectNodeContents(verse);
          s.removeAllRanges();
          s.addRange(whole);
        }
      }
      if (s.rangeCount === 0) return;
      const range = s.getRangeAt(0);
      if (!container.current?.contains(range.commonAncestorContainer)) return;
      // A note is on one version's words: a drag that runs on into the next column stops at the end of this one.
      const versionAt = (node: Node) => (node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement)?.closest<HTMLElement>("[data-version]");
      const column = versionAt(range.startContainer);
      const words = range.cloneRange();
      if (column && !column.contains(range.endContainer)) words.setEnd(column, column.childNodes.length);
      // The words only: not verse numbers or margin letters (<sup>), Note chips and other buttons, or column labels.
      const copy = words.cloneContents();
      copy.querySelectorAll("sup, button, [data-noquote]").forEach((el) => el.remove());
      const text = (copy.textContent ?? "").replace(/\s+/g, " ").trim();
      if (text.length < 3 || text.length > 400) return;
      const verseAt = (node: Node) => {
        const el = (node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement)?.closest("[id^='v']");
        return el ? Number(el.id.slice(1)) || null : null;
      };
      const verse = verseAt(range.startContainer);
      const last = verseAt(range.endContainer) ?? verse;
      const verses = verse && last ? Array.from({ length: Math.max(0, last - verse) + 1 }, (_, i) => verse + i) : [];
      const touched = [...container.current.querySelectorAll<HTMLElement>("[data-licensed]")].find((n) => range.intersectsNode(n));
      // Which translation: the column the selection starts in, else where it ends, else the first column it touches.
      const version =
        column?.dataset.version ??
        versionAt(range.endContainer)?.dataset.version ??
        [...container.current.querySelectorAll<HTMLElement>("[data-version]")].find((n) => range.intersectsNode(n))?.dataset.version ??
        null;
      setSel({ text, verse, verses, licensed: touched?.dataset.licensed ?? null, version, range: range.cloneRange(), box: measure(range) });
      setNoting(false);
      setNote(null);
      setSaved(false);
      setFailed(false);
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

  // Stay attached to the selected words while the page scrolls or resizes.
  const open = sel !== null;
  useEffect(() => {
    if (!open) return;
    let frame = 0;
    const follow = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setSel((s) => (s ? { ...s, box: measure(s.range) } : s)));
    };
    window.addEventListener("scroll", follow, { capture: true, passive: true });
    window.addEventListener("resize", follow);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", follow, { capture: true });
      window.removeEventListener("resize", follow);
    };
  }, [open]);

  if (!sel) return null;
  const ref = `${chapterLabel(book.name, chapter)}${sel.verse ? `:${sel.verse}` : ""}`;
  const close = () => {
    setSel(null);
    window.getSelection()?.removeAllRanges();
  };
  // Licensed text: only the reference is kept with the note, never the wording.
  const quote = sel.licensed ? `${ref} (${sel.licensed})` : `“${sel.text}”`;
  const canSave = !!note && !isEmptyDoc(note) && !saving && !saved;
  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const doc = withQuote(quote, note);
      const r = await postJson<{ id: number; count: number }>("/api/notes", { book: book.slug, chapter, kind: "note", verse: sel.verse, version: sel.version, doc });
      setNoteCount(r.count);
      if (sel.verse) onNoteSaved({ id: r.id, verse: sel.verse, doc, body: docToText(doc), version: sel.version, createdAt: new Date().toISOString(), replies: [] });
      setSaved(true);
      setTimeout(close, 900);
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };
  const half = noting ? 216 : 170;
  // Above the words when there's room, otherwise below them.
  const below = sel.box.top < (noting ? 330 : 140);

  return (
    <div
      data-popover
      className={`fixed z-40 -translate-x-1/2 rounded-xl border border-rule bg-card p-1 text-sm text-ink shadow-[0_12px_40px_-12px_rgb(31_27_23/0.35)] ${below ? "" : "-translate-y-full"}`}
      style={{ left: Math.max(half, Math.min(sel.box.x, window.innerWidth - half)), top: below ? sel.box.bottom + 10 : sel.box.top - 10 }}
    >
      {noting ? (
        <div className="w-[26rem] max-w-[calc(100vw-2rem)] p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="eyebrow !text-[0.62rem] text-muted">Note · {ref}{sel.version ? ` · ${sel.version}` : ""}</p>
            <button type="button" onClick={close} aria-label="Close" className="grid h-6 w-6 place-items-center rounded-md text-muted hover:bg-paper-2 hover:text-ink">✕</button>
          </div>
          <p className="mb-3 line-clamp-2 border-l-2 border-[var(--l-personal)]/50 pl-3 font-serif text-[0.98rem] italic leading-snug text-ink-2">{quote}</p>
          <NoteEditor
            autoFocus
            placeholder="What do you notice here?"
            onChange={(d) => { setNote(d); setFailed(false); }}
            onSubmit={save}
            onCancel={close}
            actions={
              <button type="button" onClick={save} disabled={!canSave}
                className="rounded-lg bg-ink px-3 py-1 text-sm text-paper transition disabled:opacity-40">
                {saved ? "Saved ✓" : saving ? "Saving…" : "Save"}
              </button>
            }
          />
          <p className="mt-2 text-[0.7rem] text-muted">
            {failed ? <span className="text-accent">Couldn’t save. Please try again.</span> : <>⌘↵ to save · Esc to close · Kept in your notebook</>}
          </p>
        </div>
      ) : (
        <div className="flex flex-col">
          {sel.verses.length > 0 && (
            <div className="flex items-center gap-2 border-b border-rule px-3 py-2">
              <span className="mr-1 text-xs text-muted">Highlight {sel.verses.length > 1 ? `${sel.verses[0]}–${sel.verses[sel.verses.length - 1]}` : `v${sel.verses[0]}`}</span>
              {(Object.keys(HIGHLIGHTS) as HighlightColor[]).map((c) => (
                <button
                  key={c}
                  onClick={() => { onHighlight(sel.verses, c); close(); }}
                  aria-label={`Highlight ${HIGHLIGHTS[c].name.toLowerCase()}`}
                  title={HIGHLIGHTS[c].name}
                  className={`h-6 w-6 rounded-full border-2 ring-1 ring-ink/10 transition hover:scale-110 ${sel.verses.every((v) => highlights[v] === c) ? "border-ink" : "border-transparent"}`}
                  style={{ backgroundColor: HIGHLIGHTS[c].fill }}
                />
              ))}
              {sel.verses.some((v) => highlights[v]) && (
                <button onClick={() => { onHighlight(sel.verses, null); close(); }} className="ml-1 rounded-md px-2 py-0.5 text-xs text-ink-2 hover:bg-paper-2">
                  Clear
                </button>
              )}
            </div>
          )}
          <div className="flex">
          {!askEnabled ? null : sel.licensed ? (
            <button onClick={() => { onAskVerse(ref); close(); }} className="rounded-lg px-3 py-2 hover:bg-paper-2">Ask about {sel.verse ? `verse ${sel.verse}` : "this"}</button>
          ) : (
            <>
              <button onClick={() => { onCheck(sel.text); close(); }} className="rounded-lg px-3 py-2 hover:bg-paper-2">Text or Assumption?</button>
              <button onClick={() => { onAsk(sel.text); close(); }} className="rounded-lg px-3 py-2 hover:bg-paper-2">Ask about this</button>
            </>
          )}
          <button onClick={() => setNoting(true)} className="rounded-lg px-3 py-2 hover:bg-paper-2">Add note</button>
          </div>
        </div>
      )}
    </div>
  );
}
