"use client";

import type { GreekWord, VerseRow } from "@/lib/data/chapter";

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
}: {
  verses: VerseRow[];
  mode: ReadMode;
  selected: GreekWord | null;
  onSelectWord: (w: GreekWord) => void;
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
              <Vn n={v.verse} /> {v.web}
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
                {text}{" "}
              </span>
            );
          })}
        </p>
      ))}
    </div>
  );
}
