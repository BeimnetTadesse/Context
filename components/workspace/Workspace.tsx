"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { ViewerInfo } from "@/components/AccountButton";
import type { ChapterData, GreekWord } from "@/lib/data/chapter";
import type { StudyData } from "@/lib/data/study";
import type { Label } from "@/lib/labels";
import { STEPS, type StepKey } from "@/lib/steps";
import { studyPath } from "@/lib/bible/refs";
import { LAST_STUDY_COOKIE, lastStudyValue } from "@/lib/lastStudy";
import { postJson, StudyContext } from "@/components/study/context";
import { CrossRefArcsPanel } from "@/components/study/CrossRefArcs";
import { BookPanel, ConnectionsStep, ContextStep, InterpretationsStep, LanguageStep, ObserveStep } from "@/components/study/Steps";
import { ReflectStep, type SavedNote } from "@/components/study/Reflect";
import type { AskRequest } from "./AskPanel";
import { LexiconCard, Margin } from "./Margin";
import { notedPhrases, notedVerses, type VerseNote } from "@/components/notes/VerseNotes";
import { ChapterNotes } from "@/components/notes/ChapterNotes";
import { VerseCommentary } from "@/components/study/Commentators";
import { NotesRail } from "@/components/notes/NotesRail";
import { quotedPhrase } from "@/lib/notes/doc";

/**
 * The right-hand column (Margin: commentators, lexicon, cited sources; and Ask). Switched off for now while the
 * notes take the left column; everything that opens it (verse numbers, Ask, Text or Assumption?) is hidden with it.
 */
const SHOW_MARGIN = false;
// Study notes (the underlined phrases in Read) are hidden until they're regenerated to say something worth reading:
// the current ones mostly restate their verse. The switch, underlines and footnote card all return when this is true.
const SHOW_STUDY_NOTES = false;
import { PassageSwitcher, type NtBook } from "./PassageSwitcher";
import { ReadStep, type PhraseMark } from "./ReadStep";
import { VersionToolbar } from "./VersionToolbar";
import { LicensedNotices, useLicensed } from "./Licensed";
import { AMHARIC_1962_NOTICE } from "@/lib/notices";
import type { ReadPrefs } from "@/lib/versions";
import type { ChapterHighlights, HighlightColor } from "@/lib/highlights";
import { SelectionPopover } from "./SelectionPopover";
import { StudyNotePopover, StudyNotesKey } from "./read/StudyNote";
import { TopBar } from "./TopBar";
import { MethodNav } from "./MethodNav";
import { EvidenceLedger } from "./EvidenceLedger";
import { ProvenanceToggle } from "./ProvenanceToggle";
import { chapterLabel } from "@/lib/bible/books";

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
  aiLocked,
  initialHighlights,
  verseNotes: initialVerseNotes,
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
  aiLocked: boolean;
  initialHighlights: ChapterHighlights;
  verseNotes: VerseNote[];
}) {
  const [step, setStep] = useState<StepKey>(initialStep);
  const [noteCount, setNoteCount] = useState(initialNoteCount);
  const [trail, setTrail] = useState<string | null>(null);
  const [layer, setLayer] = useState(true);
  // The study note opened from an underlined phrase, and where to show it (relative to the text).
  // `text` records which chapter and version it was opened on, so it disappears when either changes.
  const [studyNote, setStudyNote] = useState<{ letter: string; top: number; left: number; text: string } | null>(null);
  const closeStudyNote = useCallback(() => setStudyNote(null), []);
  const [tab, setTab] = useState<"margin" | "ask">("margin");
  const [askRequest, setAskRequest] = useState<AskRequest | null>(null);
  const [commentVerse, setCommentVerse] = useState<number | null>(null);
  // Right column of the Read step: the reader's notes, or the commentary on the verse they tapped.
  const [side, setSide] = useState<SideTab>("notes");
  const textRef = useRef<HTMLDivElement>(null);
  const [chosenPrefs, setPrefs] = useState<ReadPrefs>(initialPrefs);
  // The original-language interlinear: Greek for the New Testament, Hebrew (and Aramaic) for the Old. The reader's
  // setting is one switch; it's only ignored for a chapter that has no tagged words at all.
  const ot = data.book.testament === "OT";
  const greekAvailable = data.verses.some((v) => v.greek.length > 0);
  const language = ot ? "Hebrew" : "Greek";
  const prefs = useMemo(() => (greekAvailable || !chosenPrefs.greek ? chosenPrefs : { ...chosenPrefs, greek: false }), [chosenPrefs, greekAvailable]);
  const [highlights, setHighlights] = useState<ChapterHighlights>(initialHighlights);
  const [verseNotes, setVerseNotes] = useState<VerseNote[]>(initialVerseNotes);
  const noted = useMemo(() => notedVerses(verseNotes), [verseNotes]);
  const notedText = useMemo(() => notedPhrases(verseNotes), [verseNotes]);
  const [notesFocus, setNotesFocus] = useState<{ verse: number; at: number } | null>(null);
  const [activeNote, setActiveNote] = useState<number | null>(null);
  // Optimistic: colour the verses now, then save; if saving fails, put back what was there.
  const highlight = (verses: number[], color: HighlightColor | null) => {
    const before = highlights;
    const next = { ...highlights };
    for (const v of verses) {
      if (color) next[v] = color;
      else delete next[v];
    }
    setHighlights(next);
    postJson<{ highlights: ChapterHighlights }>("/api/highlights", { book: data.book.slug, chapter: data.chapter, verses, color })
      .then((r) => setHighlights(r.highlights))
      .catch(() => setHighlights(before));
  };
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

  // Remember where the reader is, so the notebook and profile can offer "← Back to Luke 2".
  useEffect(() => {
    document.cookie = `${LAST_STUDY_COOKIE}=${lastStudyValue(data.book.slug, data.chapter, step)}; path=/; max-age=${60 * 60 * 24 * 180}; samesite=lax`;
  }, [data.book.slug, data.chapter, step]);

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
      // Typing in a field isn't a shortcut. (The target can be the document itself, which has no closest().)
      const typing = e.target instanceof Element && e.target.closest("input, textarea, [contenteditable]");
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
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
  const marks: PhraseMark[] = SHOW_STUDY_NOTES && layer
    ? letters.flatMap((c) => c.anchors.filter((a) => a.quote).map((a) => ({ ord: a.ord, quote: a.quote!, label: c.label, letter: c.letter })))
    : [];

  const ctx = useMemo(
    () => ({ book: data.book, chapter: data.chapter, study, curator, aiLocked, trail, setTrail, ask: (q: string) => openAsk("ask", q), setNoteCount }),
    [data.book, data.chapter, study, curator, aiLocked, trail, openAsk],
  );

  const selectVerse = (v: number) => {
    setCommentVerse(v);
    setWord(null);
    setTab("margin");
    setSide("commentary");
    if (window.matchMedia("(max-width: 1023px)").matches) setSheet(true);
  };

  /** A Note chip in the text: open that verse's notes in the notes list (phone: in the sheet). */
  const openNotes = (verse: number) => {
    setSide("notes");
    setNotesFocus({ verse, at: Date.now() });
    setActiveNote(verseNotes.find((n) => n.verse === verse)?.id ?? null);
    if (window.matchMedia("(max-width: 1023px)").matches) setSheet(true);
  };

  const selectWord = (w: GreekWord) => {
    setCommentVerse(null);
    setWord(w);
    setSide("word");
    if (window.matchMedia("(max-width: 1023px)").matches) setSheet(true);
  };

  const shownSide: SideTab = side === "word" && !prefs.greek ? "notes" : side;

  const studyText = `${data.book.slug}/${data.chapter}/${prefs.primary}/${prefs.greek}`;

  const translationLabel = prefs.greek ? (ot ? "WLC" : "SBLGNT") : [prefs.primary, ...prefs.compare].join(" · ");

  return (
    <StudyContext.Provider value={ctx}>
    <div className="min-h-dvh">
      <TopBar
        bookName={data.book.name}
        chapter={data.chapter}
        first={first}
        last={last}
        translationLabel={translationLabel}
        step={step}
        onStep={changeStep}
        onOpenSwitcher={() => setSwitcher(true)}
        noteCount={noteCount}
        viewer={viewer}
      />

      {/* Full width: the method sits against the left edge and the notes against the right, the text between. */}
      <div className={`grid ${SHOW_MARGIN ? "mx-auto max-w-[1500px] lg:grid-cols-[280px_minmax(0,1fr)_340px]" : "lg:grid-cols-[240px_minmax(0,1fr)_300px] xl:grid-cols-[264px_minmax(0,1fr)_360px]"}`}>
        <MethodNav
          step={step}
          onStep={changeStep}
          bookName={data.book.name}
          chapter={data.chapter}
          first={first}
          last={last}
          verseCount={data.verses.length}
          prefs={prefs}
          originalLabel={ot ? "Hebrew · WLC" : "Greek · SBLGNT"}
        />

        {/* Step */}
        <main className="min-w-0 px-5 py-10 sm:px-10 lg:py-12">
          <p className="eyebrow text-accent">
            Step {current.numeral} of VII
          </p>
          <h1 className="mt-3 font-serif text-[clamp(2.4rem,4vw,3.2rem)] leading-tight">{current.name}</h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-2">{step === "read" ? `Read the whole chapter before anything else. Switch to ${language} to explore any word.` : step === "language" ? `The ${language} terms that shape the chapter, with what the lexicons can and cannot tell us.` : STEP_INTRO[step]}</p>
          <EvidenceLedger study={study} bookName={data.book.name} chapter={data.chapter} />

          {step === "read" ? (
            <>
              <div className="mt-8 flex flex-wrap items-start justify-between gap-4 border-y border-rule py-3">
                <VersionToolbar prefs={prefs} onChange={changePrefs} greekAvailable={greekAvailable} language={language} />
                {SHOW_STUDY_NOTES && <ProvenanceToggle on={layer} onToggle={() => { setLayer(!layer); setStudyNote(null); }} hasLetters={letters.length > 0} primary={prefs.primary} greek={prefs.greek} />}
              </div>
              {SHOW_STUDY_NOTES && layer && letters.length > 0 && prefs.primary === "WEB" && !prefs.greek && <StudyNotesKey />}
              <p className="eyebrow mt-4 !text-[0.65rem] text-muted">
                {prefs.greek
                  ? `Tap any ${language} word for its dictionary entry`
                  : SHOW_MARGIN ? "Tap a verse number for commentators and Church Fathers · Select any phrase to ask" : "Tap a verse number for commentary · Select any words to highlight them or add a note"}
              </p>
              {/* Clicking the words of a note opens it beside the text. */}
              <div
                className="relative mt-8"
                ref={textRef}
                onKeyDown={(e) => {
                  const el = (e.target as HTMLElement).closest<HTMLElement>("[data-study-letter]");
                  if (el && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); el.click(); }
                }}
                onClick={(e) => {
                  // A study note: open it just below the phrase, kept inside the text column.
                  const study = (e.target as HTMLElement).closest<HTMLElement>("[data-study-letter]");
                  if (study && textRef.current) {
                    const box = textRef.current.getBoundingClientRect();
                    const at = study.getBoundingClientRect();
                    const width = Math.min(416, box.width);
                    setStudyNote({
                      text: studyText,
                      letter: study.dataset.studyLetter!,
                      top: at.bottom - box.top + 8,
                      left: Math.max(0, Math.min(at.left - box.left, box.width - width)),
                    });
                    return;
                  }
                  const words = (e.target as HTMLElement).closest<HTMLElement>("[data-noted]");
                  const verse = Number(words?.closest("[id^='v']")?.id.slice(1));
                  const note = words && verseNotes.find((n) => n.verse === verse && quotedPhrase(n.doc, n.body) === words.dataset.noted);
                  if (note) setActiveNote(note.id);
                }}
              >
                {/* An OT chapter whose Amharic was left out (numbered differently from the English): say so up front. */}
                {!prefs.greek && (prefs.primary === "AMH" || prefs.compare.includes("AMH")) && data.book.testament === "OT" && data.verses.every((v) => !v.amh) && (
                  <p className="mb-5 rounded-xl bg-paper-2 px-4 py-3 text-sm text-ink-2">
                    The Amharic for {chapterLabel(data.book.name, data.chapter)} isn’t shown yet: in the copy Context uses, its verses
                    don’t line up with the English ones here, and they are being checked rather than guessed.
                  </p>
                )}
                {/* A Psalm title belongs to the text: it sits above verse 1 (in the Hebrew it is verse 1). */}
                {data.title && !prefs.greek && (
                  <p className="mb-5 font-serif text-[1.15rem] italic text-ink-2">{data.title}</p>
                )}
                <ReadStep verses={data.verses} prefs={prefs} selected={word} onSelectWord={selectWord} marks={marks} trail={trail} onVerse={selectVerse} onOpenNotes={openNotes} activeVerse={commentVerse} licensed={licensed.texts} licensedFailed={licensed.failed} highlights={highlights} noted={noted} notedText={notedText} />
                <LicensedNotices codes={shownVersions} texts={licensed.texts} />
                {/* The 1962 Amharic Bible's statement must be shown in full wherever its text is (the margin that
                    used to carry it is hidden). */}
                {!prefs.greek && (prefs.primary === "AMH" || prefs.compare.includes("AMH")) && (
                  <div className="mt-6 space-y-2 border-t border-rule pt-4 text-[0.75rem] leading-relaxed text-muted">
                    <p><span className="font-mono text-accent">አማርኛ 1962</span> — {AMHARIC_1962_NOTICE}</p>
                    <p>
                      {data.book.testament === "OT"
                        ? "The Old Testament text is WordProject’s copy of the same 1962 translation (wordproject.org)."
                        : "Verses marked ◦ were missing from the eBible.org e-text and are restored from WordProject’s copy of the same translation (wordproject.org)."}
                    </p>
                  </div>
                )}
                {studyNote?.text === studyText && (() => {
                  const claim = letters.find((c) => c.letter === studyNote.letter);
                  return claim ? <StudyNotePopover claim={claim} letter={studyNote.letter} top={studyNote.top} left={studyNote.left} onClose={closeStudyNote} /> : null;
                })()}
              </div>
              <SelectionPopover
                container={textRef}
                onCheck={(t) => openAsk("check", t)}
                onAsk={(t) => openAsk("ask", `What does “${t}” mean in this passage?`)}
                onAskVerse={(ref) => openAsk("ask", `What does ${ref} mean in this passage?`)}
                highlights={highlights}
                onHighlight={highlight}
                onNoteSaved={(n) => {
                  setVerseNotes((all) => [...all, n]);
                  setActiveNote(n.id);
                }}
                askEnabled={SHOW_MARGIN}
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
        {SHOW_MARGIN ? (
          <aside
            className={`border-rule lg:block lg:border-l lg:px-8 lg:py-12 ${
              sheet ? "fixed inset-x-0 bottom-0 z-50 block max-h-[80dvh] overflow-y-auto rounded-t-3xl bg-paper px-5 pb-10 pt-4 shadow-2xl lg:static lg:max-h-none lg:rounded-none lg:shadow-none" : "hidden"
            }`}
          >
            <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-rule lg:hidden" />
            <div className="lg:sticky lg:top-28 lg:max-h-[calc(100dvh-8rem)] lg:overflow-y-auto lg:pb-8">
              <Margin step={step} prefs={prefs} word={word} onCloseWord={() => setWord(null)} tab={tab} setTab={setTab} askRequest={askRequest} letters={letters} commentVerse={step === "read" ? commentVerse : null} onCloseVerse={() => setCommentVerse(null)} verseNotes={verseNotes} />
            </div>
          </aside>
        ) : (
          <>
            {/* Desktop, Read step: notes beside the text, level with the words they're about. */}
            {step === "read" && (
              <aside className="hidden border-l border-rule lg:flex lg:flex-col">
                <SideTabs count={verseNotes.length} side={shownSide} onSide={setSide} greek={prefs.greek} />
                {/* flex-1: fills the column, so the commentary below can stay in view (sticky) all the way down. */}
                <div className="flex-1 px-4 pb-12 pt-6 xl:px-5">
                  {shownSide === "word" ? (
                    <div className="sticky top-36 max-h-[calc(100dvh-10rem)] overflow-y-auto pr-1">
                      <WordPanel word={word} onClose={() => setWord(null)} language={language} />
                    </div>
                  ) : shownSide === "commentary" ? (
                    // Stays in view while you scroll the chapter, scrolling on its own if long.
                    <div className="sticky top-36 max-h-[calc(100dvh-10rem)] overflow-y-auto pr-1">
                      <CommentaryPanel verse={commentVerse} onClose={() => setCommentVerse(null)} />
                    </div>
                  ) : verseNotes.length ? (
                    <NotesRail
                      notes={verseNotes}
                      passage={chapterLabel(data.book.name, data.chapter)}
                      textRef={textRef}
                      active={activeNote}
                      onActivate={setActiveNote}
                      onChange={(note) => setVerseNotes((all) => all.map((n) => (n.id === note.id ? note : n)))}
                      onDeleted={(id) => {
                        setVerseNotes((all) => all.filter((n) => n.id !== id));
                        setActiveNote(null);
                        setNoteCount((c) => Math.max(0, c - 1));
                      }}
                    />
                  ) : (
                    <p className="text-sm leading-relaxed text-muted">Select any words in the text and choose “Add note”. Your notes appear here, beside the words.</p>
                  )}
                </div>
              </aside>
            )}
            {/* Context: the whole book beside the chapter, so the middle column is about this chapter only. */}
            {step === "context" && (
              <aside className="hidden border-l border-rule lg:block">
                <div className="sticky top-16 max-h-[calc(100dvh-4rem)] overflow-y-auto px-4 pb-12 pt-10 xl:px-5">
                  <BookPanel />
                </div>
              </aside>
            )}
            {/* Connections: the chapter's cross-references across the whole Bible, as arcs (click for the full view). */}
            {step === "connections" && (
              <aside className="hidden border-l border-rule lg:block">
                <div className="sticky top-16 max-h-[calc(100dvh-4rem)] overflow-y-auto px-4 pb-12 pt-10 xl:px-5">
                  <CrossRefArcsPanel />
                </div>
              </aside>
            )}
            {/* Other steps: keep the right column, so every step has the same three-column page. Empty for now. */}
            {step !== "read" && step !== "context" && step !== "connections" && <aside className="hidden border-l border-rule lg:block" aria-hidden="true" />}
            {/* Phone: the notes list as a bottom sheet. */}
            {sheet && (
            <div className="fixed inset-x-0 bottom-0 z-50 flex max-h-[80dvh] flex-col rounded-t-3xl bg-paper px-5 pb-10 pt-4 shadow-2xl lg:hidden">
              <div className="mx-auto mb-5 h-1 w-10 shrink-0 rounded-full bg-rule" />
              {shownSide === "word" && word ? (
                <div className="overflow-y-auto">
                  <LexiconCard key={`${word.strongs}-${word.surface}`} word={word} onClose={() => { setWord(null); setSheet(false); }} />
                </div>
              ) : shownSide === "commentary" && commentVerse !== null ? (
                <div className="overflow-y-auto">
                  <CommentaryPanel verse={commentVerse} onClose={() => { setCommentVerse(null); setSheet(false); }} />
                </div>
              ) : (
                <ChapterNotes notes={verseNotes} chapter={data.chapter} focus={notesFocus} onGo={() => { setSheet(false); if (step !== "read") changeStep("read"); }} />
              )}
            </div>
            )}
          </>
        )}
      </div>

      {/* Phone: margin button + backdrop for the sheet */}
      <button
        onClick={() => { if (!SHOW_MARGIN) setSide("notes"); setSheet(true); }}
        className="fixed bottom-6 right-5 z-30 flex items-center gap-3 rounded-full bg-ink px-5 py-3 text-paper shadow-lg lg:hidden"
      >
        {SHOW_MARGIN ? (
          <><span className="font-mono text-xs text-paper/60">{word ? "Word" : letters.length ? `a–${letters[letters.length - 1].letter}` : "Ask"}</span> Margin</>
        ) : (
          <><span className="font-mono text-xs text-paper/60">{verseNotes.length}</span> Notes</>
        )}
      </button>
      {sheet && <div className="fixed inset-0 z-40 bg-ink/30 lg:hidden" onClick={() => setSheet(false)} />}

      {switcher && <PassageSwitcher books={books} onClose={closeSwitcher} />}
    </div>
    </StudyContext.Provider>
  );
}


/**
 * The top of the right column: Notes now; Ask and Margin (commentators, lexicon, sources) are on their way back here.
 * Sticks under the top bar so it stays in reach while the notes scroll with the text.
 */
type SideTab = "notes" | "commentary" | "word";

function SideTabs({ count, side, onSide, greek }: { count: number; side: SideTab; onSide: (t: SideTab) => void; greek: boolean }) {
  const tab = (t: SideTab, label: React.ReactNode) => (
    <button type="button" role="tab" aria-selected={side === t} onClick={() => onSide(t)}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-sm ${side === t ? "bg-card shadow-sm" : "text-muted hover:text-ink"}`}>
      {label}
    </button>
  );
  return (
    <div className="sticky top-16 z-20 border-b border-rule bg-paper/95 px-4 py-3 backdrop-blur xl:px-5">
      <div className="flex gap-1 rounded-full bg-paper-2 p-1" role="tablist" aria-label="Side panel">
        {tab("notes", <>Notes{count > 0 && <span className="font-mono text-[0.68rem] text-muted">{count}</span>}</>)}
        {tab("commentary", "Commentary")}
        {/* In the interlinear (Greek or Hebrew), the third tab is the dictionary entry for the word you tap. */}
        {greek ? tab("word", "Word") : (
        <button type="button" role="tab" aria-selected={false} aria-disabled title="Ask is coming soon"
          className="flex flex-1 cursor-not-allowed items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-muted/70">
          Ask
          <span className="rounded-full bg-paper px-1.5 py-px font-mono text-[0.55rem] uppercase tracking-wider text-muted">Soon</span>
        </button>
        )}
      </div>
    </div>
  );
}

/** The dictionary entry for the Greek or Hebrew word the reader tapped in the interlinear. */
function WordPanel({ word, onClose, language }: { word: GreekWord | null; onClose: () => void; language: string }) {
  if (!word) {
    return (
      <p className="text-sm leading-relaxed text-muted">
        Tap any {language} word in the text to see its dictionary entry: its dictionary form, its range of meaning, and how
        often it appears in the {language === "Hebrew" ? "Old" : "New"} Testament.
      </p>
    );
  }
  return <LexiconCard key={`${word.strongs}-${word.surface}`} word={word} onClose={onClose} />;
}

/** What commentators and Church Fathers say about the verse the reader tapped. */
function CommentaryPanel({ verse, onClose }: { verse: number | null; onClose: () => void }) {
  if (verse === null) {
    return (
      <div className="text-sm leading-relaxed text-muted">
        <p>Tap a verse number in the text to see what commentators and the Church Fathers say about that verse.</p>
        <p className="mt-3">Six commentators from Calvin to today, and the early church up to AD 750, in their own words.</p>
      </div>
    );
  }
  return <VerseCommentary key={verse} verse={verse} onClose={onClose} />;
}
