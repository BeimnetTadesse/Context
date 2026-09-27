"use client";

import type { GreekWord, VerseRow } from "@/lib/data/chapter";
import { sharedWords } from "@/lib/diff";
import type { Label } from "@/lib/labels";
import { versionInfo, type ReadPrefs, type VersionCode } from "@/lib/versions";

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

/** Group verses into the translation's own paragraphs (USFM \p markers). */
function paragraphs(verses: VerseRow[]) {
  const out: VerseRow[][] = [];
  for (const v of verses) {
    if (v.para || out.length === 0) out.push([v]);
    else out[out.length - 1].push(v);
  }
  return out;
}

function Vn({ n, end, onVerse, active }: { n: number; end?: number | null; onVerse?: (v: number) => void; active?: boolean }) {
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
function Omitted() {
  return (
    <span className="font-sans text-[0.8rem] italic text-muted" title="Textual variant">
      [not in the manuscripts this version follows; the verse is omitted]
    </span>
  );
}

/** A verse's text in one version (Amharic merged ranges handled by the caller). */
const textOf = (v: VerseRow, code: VersionCode) => (code === "AMH" ? v.amh?.text : v.texts[code]);

/** Compared column: words that differ from the main version are highlighted. */
function Diffed({ base, text }: { base: string | undefined; text: string }) {
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

export function ReadStep({
  verses,
  prefs,
  selected,
  onSelectWord,
  marks = [],
  trail = null,
  onVerse,
  activeVerse = null,
}: {
  verses: VerseRow[];
  prefs: ReadPrefs;
  selected: GreekWord | null;
  onSelectWord: (w: GreekWord) => void;
  marks?: PhraseMark[];
  trail?: string | null;
  onVerse?: (v: number) => void;
  activeVerse?: number | null;
}) {
  // Provenance underlines are anchored to the WEB wording, so they only show on WEB.
  const markFor = (v: VerseRow, code: VersionCode) => (code === "WEB" ? marks.filter((m) => m.ord === v.ord) : []);

  if (prefs.greek) {
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

  // Compare: one row per verse, a column per version.
  if (prefs.compare.length) {
    const cols = [prefs.primary, ...prefs.compare];
    const grid = cols.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2";
    return (
      <div className="divide-y divide-rule">
        <div className={`hidden gap-6 pb-3 sm:grid ${grid}`}>
          {cols.map((c, i) => (
            <p key={c} className="eyebrow text-muted">
              {versionInfo(c).name}
              {i === 0 ? " · main" : ""}
            </p>
          ))}
        </div>
        {verses.map((v) => {
          const base = prefs.primary === "AMH" ? undefined : textOf(v, prefs.primary);
          return (
            <div key={v.ord} id={`v${v.verse}`} className={`grid scroll-mt-28 gap-3 py-4 sm:gap-6 ${grid}`}>
              {cols.map((c, i) => {
                const text = textOf(v, c);
                const amh = c === "AMH";
                return (
                  <div key={c}>
                    <p className="mb-0.5 font-mono text-[0.62rem] uppercase tracking-widest text-muted sm:hidden">{versionInfo(c).short}</p>
                    {text ? (
                      <p className={amh ? "ethiopic text-[1.05rem] leading-relaxed" : "font-serif text-[1.15rem] leading-relaxed"}>
                        <Vn n={v.verse} end={amh ? v.amh?.endVerse : null} onVerse={i === 0 && !amh ? onVerse : undefined} active={activeVerse === v.verse} />{" "}
                        {i === 0 ? (
                          amh ? text : <Marked text={text} marks={markFor(v, c)} trail={trail} />
                        ) : amh ? (
                          text
                        ) : (
                          <Diffed base={base} text={text} />
                        )}
                      </p>
                    ) : amh ? (
                      <p className="font-sans text-sm italic text-muted">Included in a combined verse above.</p>
                    ) : (
                      <p className="font-sans text-sm italic text-muted">
                        <Vn n={v.verse} /> Omitted — not in the manuscripts this version follows.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  }

  // Flowing text in one version.
  const code = prefs.primary;
  const amh = code === "AMH";
  return (
    <div className={`scripture ${amh ? "ethiopic" : ""}`}>
      {paragraphs(verses).map((para) => (
        <p key={para[0].ord} className="mb-6">
          {para.map((v) => {
            const text = textOf(v, code);
            if (!amh && !text)
              return (
                <span key={v.ord} id={`v${v.verse}`} className="scroll-mt-28">
                  <Vn n={v.verse} /> <Omitted />{" "}
                </span>
              );
            if (!text) return null; // Amharic: covered by a combined verse
            return (
              <span key={v.ord} id={`v${v.verse}`} className="scroll-mt-28">
                <Vn n={v.verse} end={amh ? v.amh?.endVerse : null} onVerse={amh ? undefined : onVerse} active={activeVerse === v.verse} />
                {amh ? text : <Marked text={text} marks={markFor(v, code)} trail={trail} />}{" "}
              </span>
            );
          })}
        </p>
      ))}
    </div>
  );
}
