import { STEPS, type StepKey } from "@/lib/steps";
import { versionInfo, type ReadPrefs } from "@/lib/versions";

/** Desktop left column: the seven steps, and the passage being read. */
export function MethodNav({
  step,
  onStep,
  bookName,
  chapter,
  first,
  last,
  verseCount,
  prefs,
}: {
  step: StepKey;
  onStep: (s: StepKey) => void;
  bookName: string;
  chapter: number;
  first: number;
  last: number;
  verseCount: number;
  prefs: ReadPrefs;
}) {
  return (
    <aside className="hidden px-6 py-12 lg:block">
      <div className="sticky top-24">
        <p className="eyebrow mb-4 text-muted">Method</p>
        <nav className="space-y-1">
          {STEPS.map((s) => {
            const on = s.key === step;
            return (
              <button
                key={s.key}
                onClick={() => onStep(s.key)}
                className={`flex w-full items-start gap-4 rounded-xl px-4 py-2.5 text-left transition ${
                  on ? "bg-card shadow-[0_1px_0_var(--rule),0_8px_24px_-18px_rgba(40,30,20,0.35)]" : "hover:bg-paper-2"
                }`}
              >
                <span className="w-6 pt-0.5 font-mono text-xs text-accent">{s.numeral}</span>
                <span className="flex-1">
                  <span className="block text-[1.02rem]">{s.name}</span>
                  <span className="block text-sm text-muted">{s.tagline}</span>
                </span>
                <span
                  className="mt-2 h-1.5 w-1.5 rounded-full"
                  style={{ background: on ? "var(--accent)" : "var(--rule)" }}
                />
              </button>
            );
          })}
        </nav>

        <div className="mt-3 border-t border-rule pt-3">
          <p className="eyebrow mb-1 text-muted">Passage</p>
          <p className="font-serif text-xl">
            {bookName} {chapter}:{first}–{last}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            {verseCount} verses ·{" "}
            {prefs.greek ? "Greek · SBLGNT" : [prefs.primary, ...prefs.compare].map((c) => versionInfo(c).short).join(" · ")}
          </p>
          <p className="mt-1.5 font-mono text-[0.68rem] text-muted">⌘K go to · 1–7 steps</p>
        </div>
      </div>
    </aside>
  );
}
