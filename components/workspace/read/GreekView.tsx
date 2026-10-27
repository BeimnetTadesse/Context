import type { GreekWord, VerseRow } from "@/lib/data/chapter";
import { useStudy } from "@/components/study/context";

/**
 * The original-language interlinear: every word with its English gloss; tap a word for its lexicon entry.
 * Greek (New Testament) reads left to right; Hebrew and Aramaic (Old Testament) read right to left, so their words
 * flow from the right, each with its gloss underneath. A Psalm title (in the Hebrew, part of the text) sits on its own
 * line above verse 1.
 */
export function GreekView({ verses, selected, onSelectWord }: { verses: VerseRow[]; selected: GreekWord | null; onSelectWord: (w: GreekWord) => void }) {
  const hebrew = useStudy().book.testament === "OT";

  const word = (w: GreekWord) => {
    const on = selected?.strongs === w.strongs && !!w.strongs;
    return (
      <button
        key={w.position}
        onClick={() => onSelectWord(w)}
        className={`rounded-md px-1.5 py-1 transition-colors ${hebrew ? "text-right" : "text-left"} ${on ? "bg-[var(--l-historical-bg)]" : "hover:bg-paper-2"}`}
      >
        <span className={`block leading-tight ${hebrew ? "font-hebrew text-[1.6rem]" : "font-serif text-[1.35rem]"}`}>{w.surface}</span>
        <span dir="ltr" className="block font-sans text-[0.72rem] text-muted">{w.gloss}</span>
      </button>
    );
  };

  return (
    <div className="space-y-7">
      {verses.map((v) => {
        const title = v.greek.filter((w) => w.position < 0);
        const words = v.greek.filter((w) => w.position >= 0);
        return (
          <div key={v.ord} id={`v${v.verse}`} className="scroll-mt-28 space-y-3">
            {title.length > 0 && (
              <div className={`flex gap-4 ${hebrew ? "flex-row-reverse" : ""}`}>
                <span className="w-6 shrink-0" />
                <div dir={hebrew ? "rtl" : undefined} className="flex flex-wrap gap-x-1 gap-y-3 rounded-xl bg-paper-2/60 px-2 py-1">
                  <span dir="ltr" className="self-center px-1 font-mono text-[0.62rem] uppercase tracking-widest text-muted">Title</span>
                  {title.map(word)}
                </div>
              </div>
            )}
            <div className={`flex gap-4 ${hebrew ? "flex-row-reverse" : ""}`}>
              <span className={`w-6 shrink-0 pt-1 font-mono text-xs text-muted ${hebrew ? "text-left" : "text-right"}`}>{v.verse}</span>
              {words.length === 0 ? (
                <p className="text-sm italic text-muted">
                  {hebrew ? "No Hebrew text is tagged for this verse." : "Not in the SBL Greek text — this verse appears only in later manuscripts."}
                </p>
              ) : (
                <div dir={hebrew ? "rtl" : undefined} lang={hebrew ? "he" : "grc"} className="flex flex-wrap gap-x-1 gap-y-3">
                  {words.map(word)}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
