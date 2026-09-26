"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/ui";
import type { ChapterData, GreekWord } from "@/lib/data/chapter";
import { STEPS, type StepKey } from "@/lib/steps";
import { studyPath } from "@/lib/bible/refs";
import { Margin } from "./Margin";
import { PassageSwitcher, type NtBook } from "./PassageSwitcher";
import { READ_MODES, ReadStep, type ReadMode } from "./ReadStep";

const STEP_INTRO: Record<StepKey, string> = {
  read: "Read the whole chapter before anything else. Switch to Greek to explore any word.",
  observe: "Structure, repetition, people, and the line of argument. Only what can be seen in the text itself.",
  context: "Author, audience, setting, and where this chapter sits in the book. Evidence and debate are labelled separately.",
  language: "The Greek terms that shape the chapter, with what the lexicons can and cannot tell us.",
  connections: "Cross-references grouped by the kind of connection, from shared wording to proposed background.",
  interpretations: "The questions the chapter leaves open, and the main credible answers to each.",
  reflect: "Reflection comes last on purpose. Separate what the passage says from what you bring to it.",
};


// A cookie (not localStorage) so the server renders the reader's mode on first paint.
function saveReadMode(m: ReadMode) {
  document.cookie = `readMode=${m}; path=/; max-age=31536000; samesite=lax`;
}

export function Workspace({
  data,
  books,
  initialStep,
  initialMode,
}: {
  data: ChapterData;
  books: NtBook[];
  initialStep: StepKey;
  initialMode: ReadMode;
}) {
  const [step, setStep] = useState<StepKey>(initialStep);
  const [mode, setMode] = useState<ReadMode>(initialMode);
  const [word, setWord] = useState<GreekWord | null>(null);
  const [switcher, setSwitcher] = useState(false);
  const [sheet, setSheet] = useState(false);
  const stepIndex = STEPS.findIndex((s) => s.key === step);
  const current = STEPS[stepIndex];
  const first = data.verses[0].verse;
  const last = data.verses[data.verses.length - 1].verse;

  const changeStep = useCallback((s: StepKey) => {
    setStep(s);
    const url = new URL(window.location.href);
    url.searchParams.set("step", s);
    window.history.replaceState(null, "", url);
    window.scrollTo({ top: 0 });
  }, []);

  const changeMode = (m: ReadMode) => {
    setMode(m);
    setWord(null);
    saveReadMode(m);
  };

  // Keyboard: ⌘K / Ctrl-K passage switcher · 1–7 jump between steps
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSwitcher(true);
        return;
      }
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, [contenteditable]") || e.metaKey || e.ctrlKey || e.altKey) return;
      const n = Number(e.key);
      if (n >= 1 && n <= 7) changeStep(STEPS[n - 1].key);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [changeStep]);

  const closeSwitcher = useCallback(() => setSwitcher(false), []);

  const selectWord = (w: GreekWord) => {
    setWord(w);
    if (window.matchMedia("(max-width: 1023px)").matches) setSheet(true);
  };

  const translationLabel = { web: "WEB", amh: "AMH", parallel: "WEB · AMH", greek: "SBLGNT" }[mode];

  return (
    <div className="min-h-dvh">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-rule bg-paper/95 backdrop-blur">
        <div className="flex h-16 items-center gap-2 px-4 sm:gap-4 sm:px-8">
          <Wordmark />
          <span className="hidden h-7 w-px bg-rule sm:block" />
          <button
            onClick={() => setSwitcher(true)}
            className="group flex items-baseline gap-2 whitespace-nowrap rounded-lg px-2 py-1 hover:bg-paper-2"
            title="Go to passage (⌘K)"
          >
            <span className="font-serif text-lg sm:text-xl">
              {data.book.name} {data.chapter}
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
                0
              </span>
            </Link>
          </div>
        </div>

        {/* Mobile step pills */}
        <nav className="flex gap-2 overflow-x-auto border-t border-rule px-4 py-3 lg:hidden">
          {STEPS.map((s) => (
            <button
              key={s.key}
              onClick={() => changeStep(s.key)}
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

      <div className="mx-auto grid max-w-[1500px] lg:grid-cols-[280px_minmax(0,1fr)_340px]">
        {/* Method nav (desktop) */}
        <aside className="hidden px-6 py-12 lg:block">
          <div className="sticky top-28">
            <p className="eyebrow mb-4 text-muted">Method</p>
            <nav className="space-y-1">
              {STEPS.map((s) => {
                const on = s.key === step;
                return (
                  <button
                    key={s.key}
                    onClick={() => changeStep(s.key)}
                    className={`flex w-full items-start gap-4 rounded-xl px-4 py-3 text-left transition ${
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

            <div className="mt-8 border-t border-rule pt-6">
              <p className="eyebrow mb-2 text-muted">Passage</p>
              <p className="font-serif text-xl">
                {data.book.name} {data.chapter}:{first}–{last}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                {data.verses.length} verses · World English Bible
                <br />
                Amharic 1962 · Greek text: SBLGNT
              </p>
              <p className="mt-4 font-mono text-[0.68rem] text-muted">⌘K go to · 1–7 steps</p>
            </div>
          </div>
        </aside>

        {/* Step */}
        <main className="min-w-0 px-5 py-10 sm:px-10 lg:py-12">
          <p className="eyebrow text-accent">
            Step {current.numeral} of VII
          </p>
          <h1 className="mt-3 font-serif text-5xl">{current.name}</h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-2">{STEP_INTRO[step]}</p>

          {step === "read" ? (
            <>
              <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-y border-rule py-3">
                <div className="-mx-1 flex max-w-full gap-1 overflow-x-auto rounded-full bg-paper-2 p-1" role="tablist" aria-label="Translation">
                  {READ_MODES.map((m) => (
                    <button
                      key={m.key}
                      role="tab"
                      aria-selected={mode === m.key}
                      onClick={() => changeMode(m.key)}
                      className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm sm:px-4 ${
                        mode === m.key ? "bg-card text-ink shadow-sm" : "text-muted hover:text-ink"
                      } ${m.key === "amh" ? "font-ethiopic" : ""}`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
                <label
                  className="flex cursor-not-allowed items-center gap-3 text-sm text-muted"
                  title="Appears once this chapter's claims are prepared"
                >
                  <span className="relative h-6 w-11 rounded-full bg-rule">
                    <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-card" />
                  </span>
                  Provenance layer
                </label>
              </div>
              <div className="mt-10">
                <ReadStep verses={data.verses} mode={mode} selected={word} onSelectWord={selectWord} />
              </div>
            </>
          ) : (
            <div className="mt-10 rounded-2xl border border-dashed border-rule p-8 text-ink-2">
              <p className="eyebrow mb-2 text-accent">Being prepared</p>
              <p className="max-w-xl leading-relaxed">
                The {current.name.toLowerCase()} study for {data.book.name} {data.chapter} hasn’t been prepared yet. Every
                claim here will carry its label and its sources.
              </p>
            </div>
          )}

          {/* Chapter navigation */}
          <div className="mt-16 flex justify-between border-t border-rule pt-6 text-sm">
            {data.prev ? (
              <Link href={studyPath(data.prev, data.prev.chapter)} className="text-muted hover:text-ink">
                ← {data.prev.label}
              </Link>
            ) : <span />}
            {data.next && (
              <Link href={studyPath(data.next, data.next.chapter)} className="text-muted hover:text-ink">
                {data.next.label} →
              </Link>
            )}
          </div>
        </main>

        {/* Margin (desktop) */}
        <aside className="hidden border-l border-rule px-8 py-12 lg:block">
          <div className="sticky top-28 max-h-[calc(100dvh-8rem)] overflow-y-auto pb-8">
            <Margin mode={mode} word={word} onCloseWord={() => setWord(null)} />
          </div>
        </aside>
      </div>

      {/* Mobile margin button + sheet */}
      <button
        onClick={() => setSheet(true)}
        className="fixed bottom-6 right-5 z-30 flex items-center gap-3 rounded-full bg-ink px-5 py-3 text-paper shadow-lg lg:hidden"
      >
        <span className="font-mono text-xs text-paper/60">{word ? "Word" : "a–g"}</span> Margin
      </button>
      {sheet && (
        <div className="fixed inset-0 z-40 bg-ink/30 lg:hidden" onClick={() => setSheet(false)}>
          <div
            className="absolute inset-x-0 bottom-0 max-h-[80dvh] overflow-y-auto rounded-t-3xl bg-paper px-5 pb-10 pt-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-rule" />
            <Margin mode={mode} word={word} onCloseWord={() => setWord(null)} />
          </div>
        </div>
      )}

      {switcher && <PassageSwitcher books={books} onClose={closeSwitcher} />}
    </div>
  );
}

