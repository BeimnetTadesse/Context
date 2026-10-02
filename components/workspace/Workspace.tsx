"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Dot, Wordmark } from "@/components/ui";
import { AccountButton, type ViewerInfo } from "@/components/AccountButton";
import type { ChapterData, GreekWord } from "@/lib/data/chapter";
import type { StudyData } from "@/lib/data/study";
import { LABEL_INFO, LABELS, type Label } from "@/lib/labels";
import { STEPS, type StepKey } from "@/lib/steps";
import { studyPath } from "@/lib/bible/refs";
import { StudyContext } from "@/components/study/context";
import { ConnectionsStep, ContextStep, InterpretationsStep, LanguageStep, ObserveStep } from "@/components/study/Steps";
import { ReflectStep, type SavedNote } from "@/components/study/Reflect";
import type { AskRequest } from "./AskPanel";
import { Margin } from "./Margin";
import { PassageSwitcher, type NtBook } from "./PassageSwitcher";
import { ReadStep, type PhraseMark } from "./ReadStep";
import { VersionToolbar } from "./VersionToolbar";
import { LicensedNotices, useLicensed } from "./Licensed";
import { versionInfo, type ReadPrefs } from "@/lib/versions";
import { SelectionPopover } from "./SelectionPopover";

const STEP_INTRO: Record<StepKey, string> = {
  read: "Read the whole chapter before anything else. Switch to Greek to explore any word.",
  observe: "Structure, repetition, people, and the line of argument. Only what can be seen in the text itself.",
  context: "Author, audience, setting, and where this chapter sits in the book. Evidence and debate are labelled separately.",
  language: "The Greek terms that shape the chapter, with what the lexicons can and cannot tell us.",
  connections: "Cross-references grouped by the kind of connection, from shared wording to proposed background.",
  interpretations: "The questions the chapter leaves open, and the main credible answers to each.",
  reflect: "Reflection comes last on purpose. Separate what the passage says from what you bring to it.",
};


// A cookie (not localStorage) so the server renders the reader's versions on first paint.
function saveReadPrefs(p: ReadPrefs) {
  document.cookie = `readPrefs=${encodeURIComponent(JSON.stringify(p))}; path=/; max-age=31536000; samesite=lax`;
}

export function Workspace({
  data,
  books,
  initialStep,
  initialPrefs,
  study,
  curator,
  noteCount: initialNoteCount,
  guesses,
  notes,
  viewer,
}: {
  data: ChapterData;
  books: NtBook[];
  initialStep: StepKey;
  initialPrefs: ReadPrefs;
  study: StudyData;
  curator: boolean;
  noteCount: number;
  guesses: Record<number, Label>;
  notes: SavedNote[];
  viewer: ViewerInfo;
}) {
  const [step, setStep] = useState<StepKey>(initialStep);
  const [noteCount, setNoteCount] = useState(initialNoteCount);
  const [trail, setTrail] = useState<string | null>(null);
  const [layer, setLayer] = useState(true);
  const [tab, setTab] = useState<"margin" | "ask">("margin");
  const [askRequest, setAskRequest] = useState<AskRequest | null>(null);
  const [commentVerse, setCommentVerse] = useState<number | null>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [prefs, setPrefs] = useState<ReadPrefs>(initialPrefs);
  const shownVersions = prefs.greek ? [] : [prefs.primary, ...prefs.compare];
  const licensed = useLicensed(shownVersions, data.book.slug, data.chapter);
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

  const changePrefs = (p: ReadPrefs) => {
    setPrefs(p);
    setWord(null);
    saveReadPrefs(p);
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

  const openAsk = useCallback((kind: "ask" | "check", text: string) => {
    setTab("ask");
    setAskRequest({ kind, text, nonce: Date.now() });
    if (window.matchMedia("(max-width: 1023px)").matches) setSheet(true);
  }, []);

  // Lettered margin notes: Read-step claims with a verified quote, in text order.
  const letters = useMemo(
    () =>
      study.claims
        .filter((c) => c.step === "read" && c.anchors.some((a) => a.quote))
        .sort((a, b) => a.anchors[0].ord - b.anchors[0].ord)
        .map((c, i) => ({ ...c, letter: String.fromCharCode(97 + i) })),
    [study.claims],
  );
  const marks: PhraseMark[] = layer
    ? letters.flatMap((c) => c.anchors.filter((a) => a.quote).map((a) => ({ ord: a.ord, quote: a.quote!, label: c.label, letter: c.letter })))
    : [];
  const ledgerTotal = LABELS.reduce((n, l) => n + study.ledger[l], 0);

  const ctx = useMemo(
    () => ({ book: data.book, chapter: data.chapter, study, curator, trail, setTrail, ask: (q: string) => openAsk("ask", q), setNoteCount }),
    [data.book, data.chapter, study, curator, trail, openAsk],
  );

  const selectVerse = (v: number) => {
    setCommentVerse(v);
    setWord(null);
    setTab("margin");
    if (window.matchMedia("(max-width: 1023px)").matches) setSheet(true);
  };

  const selectWord = (w: GreekWord) => {
    setCommentVerse(null);
    setWord(w);
    if (window.matchMedia("(max-width: 1023px)").matches) setSheet(true);
  };

  const translationLabel = prefs.greek ? "SBLGNT" : [prefs.primary, ...prefs.compare].join(" · ");

  return (
    <StudyContext.Provider value={ctx}>
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
          <div className="sticky top-24">
            <p className="eyebrow mb-4 text-muted">Method</p>
            <nav className="space-y-1">
              {STEPS.map((s) => {
                const on = s.key === step;
                return (
                  <button
                    key={s.key}
                    onClick={() => changeStep(s.key)}
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
                {data.book.name} {data.chapter}:{first}–{last}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                {data.verses.length} verses ·{" "}
                {prefs.greek ? "Greek · SBLGNT" : [prefs.primary, ...prefs.compare].map((c) => versionInfo(c).short).join(" · ")}
              </p>
              <p className="mt-1.5 font-mono text-[0.68rem] text-muted">⌘K go to · 1–7 steps</p>
            </div>
          </div>
        </aside>

        {/* Step */}
        <main className="min-w-0 px-5 py-10 sm:px-10 lg:py-12">
          <p className="eyebrow text-accent">
            Step {current.numeral} of VII
          </p>
          <h1 className="mt-3 font-serif text-[clamp(2.4rem,4vw,3.2rem)] leading-tight">{current.name}</h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-2">{STEP_INTRO[step]}</p>
          {ledgerTotal > 0 && (
            <div className="mt-6 max-w-2xl" aria-label="Evidence ledger">
              <div className="flex h-1.5 overflow-hidden rounded-full bg-rule">
                {LABELS.filter((l) => study.ledger[l]).map((l) => (
                  <span key={l} style={{ flex: study.ledger[l], background: `var(--l-${l})` }} />
                ))}
              </div>
              <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[0.68rem] uppercase tracking-widest text-muted">
                <span className="text-ink-2">{data.book.name} {data.chapter} ·</span>
                {LABELS.filter((l) => study.ledger[l]).map((l) => (
                  <span key={l} className="flex items-center gap-1.5"><Dot label={l} size={6} />{study.ledger[l]} {LABEL_INFO[l].short}</span>
                ))}
                {study.claims.every((c) => c.status !== "verified") && <span>· all unverified</span>}
                {study.withheld > 0 && <span title="Claims the second reader judged not supported by their evidence">· {study.withheld} withheld after review</span>}
              </p>
            </div>
          )}

          {step === "read" ? (
            <>
              <div className="mt-8 flex flex-wrap items-start justify-between gap-4 border-y border-rule py-3">
                <VersionToolbar prefs={prefs} onChange={changePrefs} />
                {(() => {
                  const layerAvailable = letters.length > 0 && prefs.primary === "WEB" && !prefs.greek;
                  const layerOn = layer && layerAvailable;
                  return (
                <button
                  onClick={() => setLayer(!layer)}
                  disabled={!layerAvailable}
                  role="switch"
                  aria-checked={layerOn}
                  className="flex items-center gap-3 text-sm disabled:cursor-not-allowed disabled:text-muted"
                  title={!letters.length ? "Appears once this chapter's study is prepared" : prefs.primary !== "WEB" ? "Underlines follow the WEB wording — choose WEB as your main version" : "Underline key phrases by provenance label"}
                >
                  <span className={`relative h-6 w-11 rounded-full transition ${layerOn ? "bg-ink" : "bg-rule"}`}>
                    <span className={`absolute top-1 h-4 w-4 rounded-full bg-card transition-all ${layerOn ? "left-6" : "left-1"}`} />
                  </span>
                  Provenance layer
                </button>
                  );
                })()}
              </div>
              {!prefs.greek && (
                <p className="eyebrow mt-4 !text-[0.65rem] text-muted">Tap a verse number for the commentators · Select any phrase to ask</p>
              )}
              <div className="mt-8" ref={textRef}>
                <ReadStep verses={data.verses} prefs={prefs} selected={word} onSelectWord={selectWord} marks={marks} trail={trail} onVerse={selectVerse} activeVerse={commentVerse} licensed={licensed.texts} licensedFailed={licensed.failed} />
                <LicensedNotices codes={shownVersions} texts={licensed.texts} />
              </div>
              <SelectionPopover
                container={textRef}
                onCheck={(t) => openAsk("check", t)}
                onAsk={(t) => openAsk("ask", `What does “${t}” mean in this passage?`)}
                onAskVerse={(ref) => openAsk("ask", `What does ${ref} mean in this passage?`)}
              />
            </>
          ) : step === "observe" ? (
            <ObserveStep verses={data.verses} />
          ) : step === "context" ? (
            <ContextStep chapterCount={data.chapterCount} />
          ) : step === "language" ? (
            <LanguageStep />
          ) : step === "connections" ? (
            <ConnectionsStep />
          ) : step === "interpretations" ? (
            <InterpretationsStep verses={data.verses.map((v) => v.verse)} />
          ) : (
            <ReflectStep guesses={guesses} notes={notes} />
          )}

          {step !== "reflect" && (
            <div className="mt-14 flex justify-end">
              <button onClick={() => changeStep(STEPS[stepIndex + 1].key)} className="rounded-xl border border-ink px-5 py-2.5 hover:bg-ink hover:text-paper">
                Next: {STEPS[stepIndex + 1].name} →
              </button>
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

        {/* Margin: one instance. Desktop = right column; phone = bottom sheet. */}
        <aside
          className={`border-rule lg:block lg:border-l lg:px-8 lg:py-12 ${
            sheet ? "fixed inset-x-0 bottom-0 z-50 block max-h-[80dvh] overflow-y-auto rounded-t-3xl bg-paper px-5 pb-10 pt-4 shadow-2xl lg:static lg:max-h-none lg:rounded-none lg:shadow-none" : "hidden"
          }`}
        >
          <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-rule lg:hidden" />
          <div className="lg:sticky lg:top-28 lg:max-h-[calc(100dvh-8rem)] lg:overflow-y-auto lg:pb-8">
            <Margin step={step} prefs={prefs} word={word} onCloseWord={() => setWord(null)} tab={tab} setTab={setTab} askRequest={askRequest} letters={letters} commentVerse={step === "read" ? commentVerse : null} onCloseVerse={() => setCommentVerse(null)} />
          </div>
        </aside>
      </div>

      {/* Phone: margin button + backdrop for the sheet */}
      <button
        onClick={() => setSheet(true)}
        className="fixed bottom-6 right-5 z-30 flex items-center gap-3 rounded-full bg-ink px-5 py-3 text-paper shadow-lg lg:hidden"
      >
        <span className="font-mono text-xs text-paper/60">{word ? "Word" : letters.length ? `a–${letters[letters.length - 1].letter}` : "Ask"}</span> Margin
      </button>
      {sheet && <div className="fixed inset-0 z-40 bg-ink/30 lg:hidden" onClick={() => setSheet(false)} />}

      {switcher && <PassageSwitcher books={books} onClose={closeSwitcher} />}
    </div>
    </StudyContext.Provider>
  );
}

