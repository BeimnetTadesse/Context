// Small pieces of the reading view: verse numbers, provenance underlines, word differences, and the notes shown
// where a version has no text for a verse.
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

/** Split a verse into plain text, provenance underlines (with a margin letter) and word-trail highlights. */
export function Marked({ text, marks, trail }: { text: string; marks: PhraseMark[]; trail: string | null }) {
  const lower = text.toLowerCase();
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
    out.push(text.slice(pos, r.start));
    const piece = text.slice(r.start, r.end);
    out.push(
      r.mark ? (
        <span key={r.start}>
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
  out.push(text.slice(pos));
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
        title={`Commentators on verse ${n}`}
        className={`rounded px-0.5 transition hover:bg-[var(--l-scholarly-bg)] hover:text-ink ${active ? "bg-[var(--l-scholarly-bg)] text-ink" : ""}`}
      >
        {label}
      </button>
    </sup>
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
export function Diffed({ base, text }: { base: string | undefined; text: string }) {
  if (!base) return <>{text}</>;
  return (
    <>
      {sharedWords(base, text).map((t, i) =>
        t.shared ? t.token : (
          <span key={i} className="rounded-sm bg-[var(--l-scholarly-bg)] text-ink" title="Differs from your main version">
            {t.token}
          </span>
        ),
      )}
    </>
  );
}

/** A reader's highlight behind a verse's words (wraps across lines like a highlighter). */
export function Highlight({ color, children }: { color: HighlightColor | undefined; children: React.ReactNode }) {
  if (!color) return <>{children}</>;
  return (
    <span className="rounded-sm px-0.5 [box-decoration-break:clone]" style={{ backgroundColor: HIGHLIGHTS[color].fill }}>
      {children}
    </span>
  );
}
