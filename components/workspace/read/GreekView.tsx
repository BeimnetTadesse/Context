import type { GreekWord, VerseRow } from "@/lib/data/chapter";

/** Greek interlinear: every word with its gloss; tap a word for its lexicon entry. */
export function GreekView({ verses, selected, onSelectWord }: { verses: VerseRow[]; selected: GreekWord | null; onSelectWord: (w: GreekWord) => void }) {
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
