import Link from "next/link";
import { Wordmark } from "@/components/ui";
import { AccountButton, type ViewerInfo } from "@/components/AccountButton";
import { STEPS, type StepKey } from "@/lib/steps";

/** Sticky top bar: passage (opens the switcher), step progress, notebook, account; step pills on phones. */
export function TopBar({
  bookName,
  chapter,
  first,
  last,
  translationLabel,
  step,
  onStep,
  onOpenSwitcher,
  noteCount,
  viewer,
}: {
  bookName: string;
  chapter: number;
  first: number;
  last: number;
  translationLabel: string;
  step: StepKey;
  onStep: (s: StepKey) => void;
  onOpenSwitcher: () => void;
  noteCount: number;
  viewer: ViewerInfo;
}) {
  const stepIndex = STEPS.findIndex((s) => s.key === step);
  return (
    <header className="sticky top-0 z-30 border-b border-rule bg-paper/95 backdrop-blur">
      <div className="flex h-16 items-center gap-2 px-4 sm:gap-4 sm:px-8">
        <Wordmark />
        <span className="hidden h-7 w-px bg-rule sm:block" />
        <button
          onClick={onOpenSwitcher}
          className="group flex items-baseline gap-2 whitespace-nowrap rounded-lg px-2 py-1 hover:bg-paper-2"
          title="Go to passage (⌘K)"
        >
          <span className="font-serif text-lg sm:text-xl">
            {bookName} {chapter}
          </span>
          <span className="hidden font-mono text-[0.7rem] tracking-widest text-muted sm:inline">
            {first}–{last} · {translationLabel}
          </span>
          <span className="text-xs text-muted group-hover:text-ink">▾</span>
        </button>

        <div className="ml-auto flex items-center gap-5">
          <div className="hidden items-center gap-3 md:flex" aria-label={`Step ${stepIndex + 1} of 7`}>
            <div className="flex gap-1">
              {STEPS.map((s, i) => (
                <span
                  key={s.key}
                  className="h-[3px] w-5 rounded-full"
                  style={{ background: i === stepIndex ? "var(--accent)" : i < stepIndex ? "var(--ink)" : "var(--rule)" }}
                />
              ))}
            </div>
            <span className="font-mono text-xs text-muted">{stepIndex + 1} / 7</span>
          </div>
          <Link
            href="/notebook"
            className="flex items-center gap-2 rounded-xl border border-rule bg-card px-3 py-2 text-[0.95rem] hover:border-ink sm:px-4"
            aria-label="Notebook"
          >
            <span className="hidden sm:inline">Notebook</span>
            <span className="sm:hidden">✎</span>
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-ink px-1 font-mono text-[0.65rem] text-paper">
              {noteCount}
            </span>
          </Link>
          <AccountButton viewer={viewer} />
        </div>
      </div>

      {/* Mobile step pills */}
      <nav className="flex gap-2 overflow-x-auto border-t border-rule px-4 py-3 lg:hidden">
        {STEPS.map((s) => (
          <button
            key={s.key}
            onClick={() => onStep(s.key)}
            className={`shrink-0 rounded-full border px-4 py-2 text-[0.95rem] ${
              s.key === step ? "border-ink bg-ink text-paper" : "border-rule bg-card"
            }`}
          >
            <span className={`mr-1.5 font-mono text-xs ${s.key === step ? "text-paper/70" : "text-muted"}`}>{s.numeral}</span>
            {s.name}
          </button>
        ))}
      </nav>
    </header>
  );
}
