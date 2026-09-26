"use client";

import type { GreekWord, VerseRow } from "@/lib/data/chapter";
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
function Marked({ text, marks, trail }: { text: string; marks: PhraseMark[]; trail: string | null }) {
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

export type ReadMode = "web" | "amh" | "parallel" | "greek";

export const READ_MODES: { key: ReadMode; label: string }[] = [
  { key: "web", label: "English" },
  { key: "amh", label: "አማርኛ" },
  { key: "parallel", label: "Side by side" },
  { key: "greek", label: "Greek" },
];

/** Group verses into the translation's own paragraphs (USFM \p markers). */
function paragraphs(verses: VerseRow[]) {
  const out: VerseRow[][] = [];
  for (const v of verses) {
    if (v.para || out.length === 0) out.push([v]);
    else out[out.length - 1].push(v);
  }
  return out;
}

function Vn({ n, end }: { n: number; end?: number | null }) {
  return <sup className="vn">{end && end !== n ? `${n}–${end}` : n}</sup>;
}

export function ReadStep({
  verses,
  mode,
  selected,
  onSelectWord,
  marks = [],
  trail = null,
}: {
  verses: VerseRow[];
  mode: ReadMode;
  selected: GreekWord | null;
  onSelectWord: (w: GreekWord) => void;
  marks?: PhraseMark[];
  trail?: string | null;
}) {
  if (mode === "parallel") {
    return (
      <div className="divide-y divide-rule">
        <div className="hidden grid-cols-2 gap-8 pb-3 sm:grid">
          <p className="eyebrow text-muted">World English Bible</p>
          <p className="eyebrow text-muted">Amharic 1962</p>
        </div>
        {verses.map((v) => (
          <div key={v.ord} id={`v${v.verse}`} className="grid scroll-mt-28 gap-3 py-4 sm:grid-cols-2 sm:gap-8">
            <p className="font-serif text-[1.2rem] leading-relaxed">
              <Vn n={v.verse} /> <Marked text={v.web} marks={marks.filter((m) => m.ord === v.ord)} trail={trail} />
            </p>
            {v.amh ? (
              <p className="ethiopic text-[1.05rem] leading-relaxed">
                <Vn n={v.verse} end={v.amh.endVerse} /> {v.amh.text}
              </p>
            ) : (
              <p className="self-center font-sans text-sm italic text-muted">Included in a combined verse above.</p>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (mode === "greek") {
    return (
      <div className="space-y-7">
        {verses.map((v) => (
          <div key={v.ord} id={`v${v.verse}`} className="flex scroll-mt-28 gap-4">
            <span className="w-6 shrink-0 pt-1 text-right font-mono text-xs text-muted">{v.verse}</span>
            {v.greek.length === 0 ? (
              <p className="text-sm italic text-muted">
                Not in the SBL Greek text — this verse appears only in later manuscripts.
              </p>
            ) : (
              <div className="flex flex-wrap gap-x-1 gap-y-3">
                {v.greek.map((w) => {
                  const on = selected?.strongs === w.strongs && !!w.strongs;
                  return (
                    <button
                      key={w.position}
                      onClick={() => onSelectWord(w)}
                      className={`rounded-md px-1.5 py-1 text-left transition-colors ${
                        on ? "bg-[var(--l-historical-bg)]" : "hover:bg-paper-2"
                      }`}
                    >
                      <span className="block font-serif text-[1.35rem] leading-tight">{w.surface}</span>
                      <span className="block font-sans text-[0.72rem] text-muted">{w.gloss}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  // Flowing text: English or Amharic
  const amh = mode === "amh";
  return (
    <div className={`scripture ${amh ? "ethiopic" : ""}`}>
      {paragraphs(verses).map((para) => (
        <p key={para[0].ord} className="mb-6">
          {para.map((v) => {
            const text = amh ? v.amh?.text : v.web;
            if (!text) return null; // Amharic: covered by a combined verse
            return (
              <span key={v.ord} id={`v${v.verse}`} className="scroll-mt-28">
                <Vn n={v.verse} end={amh ? v.amh?.endVerse : null} />
                {amh ? text : <Marked text={text} marks={marks.filter((m) => m.ord === v.ord)} trail={trail} />}{" "}
              </span>
            );
          })}
        </p>
      ))}
    </div>
  );
}
