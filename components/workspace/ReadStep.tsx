"use client";

import type { GreekWord, VerseRow } from "@/lib/data/chapter";
import { sharedWords } from "@/lib/diff";
import type { Label } from "@/lib/labels";
import { isEthiopic, isLicensedVersion, versionInfo, type ReadPrefs, type VersionCode } from "@/lib/versions";
import type { LicensedText } from "./Licensed";

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
const textOf = (v: VerseRow, code: VersionCode, licensed: Record<string, LicensedText>) =>
  code === "AMH" ? v.amh?.text : isLicensedVersion(code) ? licensed[code]?.verses[v.verse] || undefined : v.texts[code];

/** Last verse of a combined verse starting here (Amharic 1962 merged ranges, NASV's "25-26"). */
const spanEnd = (v: VerseRow, code: VersionCode, licensed: Record<string, LicensedText>) =>
  code === "AMH" ? v.amh?.endVerse ?? null : licensed[code]?.spans?.[v.verse] ?? null;

/** A version that prints verses together (Amharic 1962, NASV): the combined verse that includes this one. */
function coveredBy(v: VerseRow, code: VersionCode, licensed: Record<string, LicensedText>, verses: VerseRow[]) {
  if (code === "AMH") {
    const start = verses.findLast((r) => r.verse < v.verse && r.amh?.endVerse && r.amh.endVerse >= v.verse);
    return start ? { start: start.verse, end: start.amh!.endVerse! } : null;
  }
  const spans = licensed[code]?.spans ?? {};
  for (const [start, end] of Object.entries(spans)) if (Number(start) < v.verse && end >= v.verse) return { start: Number(start), end };
  return null;
}

/** Amharic verses missing from the eBible e-text, restored from WordProject's copy of the same 1962 translation. */
function Restored() {
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
function Moved({ to }: { to: string }) {
  return <span className="font-sans text-[0.8rem] italic text-muted">[shown at {to}, where Context’s verse numbering places it]</span>;
}

function Combined({ start, end }: { start: number; end: number }) {
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
const guard = {
  onCopy: (e: React.ClipboardEvent) => e.preventDefault(),
  onCut: (e: React.ClipboardEvent) => e.preventDefault(),
  onDragStart: (e: React.DragEvent) => e.preventDefault(),
  onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
};

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
  licensed = {},
  licensedFailed = [],
}: {
  verses: VerseRow[];
  prefs: ReadPrefs;
  licensed?: Record<string, LicensedText>;
  licensedFailed?: string[];
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
          // Highlight differences only between texts in the same script, and not across combined verses.
          const base = spanEnd(v, prefs.primary, licensed) ? undefined : textOf(v, prefs.primary, licensed);
          return (
            <div key={v.ord} id={`v${v.verse}`} className={`grid scroll-mt-28 gap-3 py-4 sm:gap-6 ${grid}`}>
              {cols.map((c, i) => {
                const text = textOf(v, c, licensed);
                const pending = isLicensedVersion(c) && !licensed[c];
                const amh = c === "AMH";
                const ethiopic = isEthiopic(c);
                const end = spanEnd(v, c, licensed);
                const combined = text ? null : coveredBy(v, c, licensed, verses);
                const moved = text ? null : licensed[c]?.moved?.[v.verse];
                const diffBase = isEthiopic(prefs.primary) === ethiopic && !end ? base : undefined;
                return (
                  <div key={c} {...(isLicensedVersion(c) ? { ...guard, "data-licensed": c } : {})}>
                    <p className="mb-0.5 font-mono text-[0.62rem] uppercase tracking-widest text-muted sm:hidden">{versionInfo(c).short}</p>
                    {pending ? (
                      <p className="font-sans text-sm italic text-muted">
                        {licensedFailed.includes(c) ? `${versionInfo(c).short} is unavailable right now.` : `Loading ${versionInfo(c).short}…`}
                      </p>
                    ) : text ? (
                      <p className={ethiopic ? "ethiopic text-[1.05rem] leading-relaxed" : "font-serif text-[1.15rem] leading-relaxed"}>
                        <Vn n={v.verse} end={end} onVerse={i === 0 && !amh ? onVerse : undefined} active={activeVerse === v.verse} />
                        {amh && v.amh?.restored && <Restored />}{" "}
                        {i === 0 ? (
                          ethiopic ? text : <Marked text={text} marks={markFor(v, c)} trail={trail} />
                        ) : (
                          <Diffed base={diffBase} text={text} />
                        )}
                      </p>
                    ) : combined ? (
                      <p className="text-sm">
                        <Combined {...combined} />
                      </p>
                    ) : moved ? (
                      <p className="text-sm">
                        <Vn n={v.verse} /> <Moved to={moved} />
                      </p>
                    ) : amh && v.movedTo ? (
                      <p className="text-sm">
                        <Vn n={v.verse} /> <Moved to={v.movedTo} />
                      </p>
                    ) : amh ? (
                      <p className="font-sans text-sm italic text-muted">Missing from the digital copies of the Amharic text.</p>
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
  const ethiopic = isEthiopic(code);
  if (isLicensedVersion(code) && !licensed[code])
    return (
      <p className="font-sans italic text-muted">
        {licensedFailed.includes(code) ? `${versionInfo(code).short} is unavailable right now.` : `Loading ${versionInfo(code).short}…`}
      </p>
    );
  return (
    <div
      className={`scripture ${ethiopic ? "ethiopic" : ""}`}
      {...(isLicensedVersion(code) ? { ...guard, "data-licensed": code } : {})}
    >
      {paragraphs(verses).map((para) => (
        <p key={para[0].ord} className="mb-6">
          {para.map((v) => {
            const text = textOf(v, code, licensed);
            const combined = text ? null : coveredBy(v, code, licensed, verses);
            const moved = text ? null : licensed[code]?.moved?.[v.verse];
            if (moved)
              return (
                <span key={v.ord} id={`v${v.verse}`} className="scroll-mt-28">
                  <Vn n={v.verse} /> <Moved to={moved} />{" "}
                </span>
              );
            // Already labelled on the combined verse ("5–6"): keep only an anchor for jumping to this verse.
            if (combined) return <span key={v.ord} id={`v${v.verse}`} className="scroll-mt-28" />;
            if (!amh && !text)
              return (
                <span key={v.ord} id={`v${v.verse}`} className="scroll-mt-28">
                  <Vn n={v.verse} /> <Omitted />{" "}
                </span>
              );
            if (!text && v.movedTo)
              return (
                <span key={v.ord} id={`v${v.verse}`} className="scroll-mt-28">
                  <Vn n={v.verse} /> <Moved to={v.movedTo} />{" "}
                </span>
              );
            if (!text)
              // Amharic: say so instead of skipping silently (every NT verse is present now, but stay honest).
              return (
                <span key={v.ord} id={`v${v.verse}`} className="scroll-mt-28">
                  <Vn n={v.verse} />{" "}
                  <span className="font-sans text-[0.8rem] italic text-muted">[missing from the digital copies]</span>{" "}
                </span>
              );
            return (
              <span key={v.ord} id={`v${v.verse}`} className="scroll-mt-28">
                <Vn n={v.verse} end={spanEnd(v, code, licensed)} onVerse={amh ? undefined : onVerse} active={activeVerse === v.verse} />
                {amh && v.amh?.restored && <Restored />}
                {ethiopic ? text : <Marked text={text} marks={markFor(v, code)} trail={trail} />}{" "}
              </span>
            );
          })}
        </p>
      ))}
    </div>
  );
}
