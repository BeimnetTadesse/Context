import type { ReactNode } from "react";
import { STEPS, type StepKey } from "@/lib/steps";
import { versionInfo, type ReadPrefs } from "@/lib/versions";
import { chapterName } from "@/lib/bible/books";

/** Desktop left column: the seven steps, the passage being read, and (children) the reader's notes. */
export function MethodNav({
  step,
  onStep,
  bookName,
  chapter,
  first,
  last,
  verseCount,
  prefs,
  children,
}: {
  step: StepKey;
  onStep: (s: StepKey) => void;
  bookName: string;
  chapter: number;
  first: number;
  last: number;
  verseCount: number;
  prefs: ReadPrefs;
  children?: ReactNode;
}) {
  return (
    <aside className="hidden py-12 pl-5 pr-4 lg:block xl:pl-6">
      <div className="sticky top-24 flex max-h-[calc(100dvh-7rem)] flex-col">
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
            {chapterName(bookName)} {chapter}:{first}–{last}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            {verseCount} verses ·{" "}
            {prefs.greek ? "Greek · SBLGNT" : [prefs.primary, ...prefs.compare].map((c) => versionInfo(c).short).join(" · ")}
          </p>
          <p className="mt-1.5 font-mono text-[0.68rem] text-muted">⌘K go to · 1–7 steps</p>
        </div>

        {children && <div className="mt-4 flex min-h-0 flex-1 flex-col border-t border-rule pt-4">{children}</div>}
      </div>
    </aside>
  );
}
