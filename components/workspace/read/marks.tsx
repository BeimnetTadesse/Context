// Small pieces of the reading view: verse numbers, provenance underlines, word differences, and the notes shown
// where a version has no text for a verse.
import { Fragment } from "react";
import { sharedWords } from "@/lib/diff";
import { HIGHLIGHTS, type HighlightColor } from "@/lib/highlights";
import type { Label } from "@/lib/labels";

export interface PhraseMark {
  ord: number;
  quote: string;
  label: Label;
  letter: string;
}

interface Range {
  start: number;
  end: number;
  mark?: PhraseMark;
}

interface NoteRange {
  start: number;
  end: number;
  quote: string;
}

/** Where the reader's noted phrases fall in this version's text (only where the exact words appear). */
function noteRanges(text: string, noted: string[]): NoteRange[] {
  const out: NoteRange[] = [];
  for (const quote of noted) {
    const start = text.indexOf(quote);
    if (start >= 0) out.push({ start, end: start + quote.length, quote });
  }
  return out.sort((a, b) => a.start - b.start).filter((r, i, all) => i === 0 || r.start >= all[i - 1].end);
}

/**
 * One stretch of a verse (text[from, from + piece.length)) with the noted phrases inside it tinted. Notes are their
 * own layer, so they show inside provenance underlines and word differences instead of competing with them.
 */
function withNotes(piece: string, from: number, notes: NoteRange[], key: string | number = 0): React.ReactNode {
  if (!notes.length) return piece;
  const to = from + piece.length;
  const out: React.ReactNode[] = [];
  let pos = from;
  for (const n of notes) {
    if (n.end <= pos || n.start >= to) continue;
    const a = Math.max(n.start, pos);
    const b = Math.min(n.end, to);
    if (a > pos) out.push(piece.slice(pos - from, a - from));
    out.push(
      <span key={`${key}-${a}`} data-noted={n.quote} title="You wrote a note on this"
        className="cursor-pointer rounded-sm bg-[var(--l-personal-bg)] underline decoration-[var(--l-personal)] decoration-dotted decoration-2 underline-offset-[6px] transition-colors [box-decoration-break:clone]">
        {piece.slice(a - from, b - from)}
      </span>,
    );
    pos = b;
  }
  if (pos < to) out.push(piece.slice(pos - from));
  return out.length === 1 ? out[0] : <Fragment key={key}>{out}</Fragment>;
}

/** A verse with only the reader's noted phrases marked (Amharic, and anywhere without other marks). */
export function Noted({ text, noted = [] }: { text: string; noted?: string[] }) {
  return <>{withNotes(text, 0, noteRanges(text, noted))}</>;
}

/** Split a verse into plain text, provenance underlines (with a margin letter), word-trail highlights and noted phrases. */
export function Marked({ text, marks, trail, noted = [] }: { text: string; marks: PhraseMark[]; trail: string | null; noted?: string[] }) {
  const lower = text.toLowerCase();
  const notes = noteRanges(text, noted);
  const ranges: Range[] = [];
  for (const m of marks) {
    const i = lower.indexOf(m.quote.toLowerCase());
    if (i >= 0) ranges.push({ start: i, end: i + m.quote.length, mark: m });
  }
  if (trail) {
    const re = new RegExp(`\\b${trail}\\w*`, "gi");
    for (let m; (m = re.exec(text)); ) ranges.push({ start: m.index, end: m.index + m[0].length });
  }
  ranges.sort((a, b) => a.start - b.start);
  const out: React.ReactNode[] = [];
  let pos = 0;
  for (const r of ranges) {
    if (r.start < pos) continue; // overlapping: first wins
    out.push(withNotes(text.slice(pos, r.start), pos, notes, `p${pos}`));
    const piece = withNotes(text.slice(r.start, r.end), r.start, notes, `m${r.start}`);
    out.push(
      r.mark ? (
        // A study note: click (or Enter) opens it beside the phrase. The text container handles the click.
        <span key={r.start} data-study-letter={r.mark.letter} role="button" tabIndex={0} aria-label={`Study note ${r.mark.letter}`}
          className="cursor-pointer rounded-sm transition hover:bg-paper-2 focus-visible:outline-2 focus-visible:outline-accent">
          <span
            className="underline decoration-2 underline-offset-[6px]"
            style={{ textDecorationColor: `var(--l-${r.mark.label})` }}
          >
            {piece}
          </span>
          <sup className="ml-0.5 font-sans text-[0.6rem] text-accent">{r.mark.letter}</sup>
        </span>
      ) : (
        <mark key={r.start} className="rounded bg-[var(--l-explicit-bg)] px-0.5 text-ink">{piece}</mark>
      ),
    );
    pos = r.end;
  }
  out.push(withNotes(text.slice(pos), pos, notes, `p${pos}`));
  return <>{out}</>;
}

export function Vn({ n, end, onVerse, active }: { n: number; end?: number | null; onVerse?: (v: number) => void; active?: boolean }) {
  const label = end && end !== n ? `${n}–${end}` : n;
  if (!onVerse) return <sup className="vn">{label}</sup>;
  return (
    <sup className="vn">
      <button
        type="button"
        onClick={() => onVerse(n)}
        title={`Commentary on verse ${n}`}
        aria-label={`Commentary on verse ${n}`}
        // inline-block + padding: a real tap target (inside <sup> the button would otherwise be 0px tall).
        className={`-my-1 inline-block rounded px-1 py-1 leading-none text-accent/80 transition hover:bg-[var(--l-scholarly-bg)] hover:text-ink ${active ? "bg-[var(--l-scholarly-bg)] !text-ink" : ""}`}
      >
        {label}
      </button>
    </sup>
  );
}

/**
 * The reader has written on this verse: a small chip at the end of it that opens their notes in the margin.
 * Not selectable, so copying the text never picks it up.
 */
export function NoteChip({ verse, count, onOpen, besideText = false }: { verse: number; count?: number; onOpen?: (v: number) => void; besideText?: boolean }) {
  if (!count) return null;
  const label = count > 1 ? `${count} notes` : "Note";
  return (
    <button
      type="button"
      onClick={() => onOpen?.(verse)}
      disabled={!onOpen}
      title={`Your ${count > 1 ? `${count} notes` : "note"} on verse ${verse}`}
      className={`mx-1 inline-flex select-none ${besideText ? "lg:hidden" : ""} items-center gap-1 rounded-full border border-[var(--l-personal)]/35 bg-[var(--l-personal-bg)] px-2 py-px align-[0.15em] font-sans text-[0.68rem] font-medium leading-4 text-ink-2 transition hover:border-[var(--l-personal)] hover:text-ink`}
    >
      <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" aria-hidden>
        <path d="M8.2 1.6 10.4 3.8 4.3 9.9 1.6 10.4 2.1 7.7z" />
      </svg>
      {label}
    </button>
  );
}

/** WEB leaves some verse numbers empty: they appear only in later manuscripts. Say so. */
export function Omitted() {
  return (
    <span className="font-sans text-[0.8rem] italic text-muted" title="Textual variant">
      [not in the manuscripts this version follows; the verse is omitted]
    </span>
  );
}

/** Amharic verses missing from the eBible e-text, restored from WordProject's copy of the same 1962 translation. */
export function Restored() {
  return (
    <sup
      className="ml-0.5 font-sans text-[0.8rem] font-semibold text-[var(--l-tradition)]"
      title="Restored from WordProject’s copy of the 1962 Amharic Bible (missing from the eBible.org e-text). Worth checking against a printed Bible."
    >
      ◦
    </sup>
  );
}

/** A verse this version prints here, but Context (following the WEB's numbering) shows at another place. */
export function Moved({ to }: { to: string }) {
  return <span className="font-sans text-[0.8rem] italic text-muted">[shown at {to}, where Context’s verse numbering places it]</span>;
}

export function Combined({ start, end }: { start: number; end: number }) {
  return (
    <span className="font-sans text-[0.8rem] italic text-muted">
      [included in verses {start}–{end} above]
    </span>
  );
}

/**
 * Licensed text: display only. It can be selected (to add a note or ask about a verse) but not copied, dragged
 * out or right-clicked; the selection popover sends only the verse reference onward, never the wording.
 */
export const guard = {
  onCopy: (e: React.ClipboardEvent) => e.preventDefault(),
  onCut: (e: React.ClipboardEvent) => e.preventDefault(),
  onDragStart: (e: React.DragEvent) => e.preventDefault(),
  onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
};

/** Compared column: words that differ from the main version are highlighted. */
export function Diffed({ base, text, noted = [] }: { base: string | undefined; text: string; noted?: string[] }) {
  const notes = noteRanges(text, noted);
  if (!base) return <>{withNotes(text, 0, notes)}</>;
  // Each token's offset in the verse (the tokens are the whole text, in order).
  const tokens = sharedWords(base, text);
  const offsets = tokens.reduce<number[]>((acc, t, i) => [...acc, i ? acc[i - 1] + tokens[i - 1].token.length : 0], []);
  return (
    <>
      {tokens.map((t, i) => {
        const piece = withNotes(t.token, offsets[i], notes, i);
        return t.shared ? (
          <span key={i}>{piece}</span>
        ) : (
          <span key={i} className="rounded-sm bg-[var(--l-scholarly-bg)] text-ink" title="Differs from your main version">
            {piece}
          </span>
        );
      })}
    </>
  );
}

/**
 * A verse's words, with the reader's highlight behind them (wraps across lines like a highlighter).
 * data-verse-text marks exactly the words, so a double-click can select the verse and nothing around it.
 */
export function Highlight({ color, children }: { color: HighlightColor | undefined; children: React.ReactNode }) {
  if (!color) return <span data-verse-text>{children}</span>;
  return (
    <span data-verse-text className="rounded-sm px-0.5 [box-decoration-break:clone]" style={{ backgroundColor: HIGHLIGHTS[color].fill }}>
      {children}
    </span>
  );
}
