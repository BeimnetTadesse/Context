"use client";

import { useEffect, useState } from "react";
import { Dot, ProvenanceKey } from "@/components/ui";
import { ClaimCard } from "@/components/study/Claim";
import { VerseCommentary } from "@/components/study/Commentators";
import { postJson, useStudy } from "@/components/study/context";
import type { GreekWord } from "@/lib/data/chapter";
import type { ClaimView } from "@/lib/data/study";
import type { StepKey } from "@/lib/steps";
import { AskPanel, type AskRequest } from "./AskPanel";
import type { ReadMode } from "./ReadStep";

interface Lexicon {
  strongs: string;
  lemma: string;
  translit: string | null;
  gloss: string | null;
  definition: string[];
  occurrences: number;
}

interface Cited {
  key: string;
  title: string;
  kind: string;
}

const TRANSLATION_SOURCES: Record<ReadMode, Cited[]> = {
  web: [{ key: "WEB", title: "World English Bible", kind: "Primary text · translation" }],
  amh: [{ key: "AMH1962", title: "Amharic Bible (1962)", kind: "Primary text · translation" }],
  parallel: [
    { key: "WEB", title: "World English Bible", kind: "Primary text · translation" },
    { key: "AMH1962", title: "Amharic Bible (1962)", kind: "Primary text · translation" },
  ],
  greek: [
    { key: "SBLGNT", title: "SBL Greek New Testament", kind: "Primary text · critical Greek text" },
    { key: "STEP", title: "Translators Amalgamated Greek NT", kind: "Tagged text · Tyndale House" },
  ],
};

const AMHARIC_NOTICE =
  "copyright © 1962, 2003 United Bible Societies. Revised Amharic Bible in XML (2003). Printed version by United Bible Societies (C)1962. E-Text in transliterated ASCII format by Lapsley/Brooks Foundation 1994. Unicode UTF-8 transformation and XML-tagging by Dirk Röckmann 2003 (www.nt-text.net). With kind permission of the Bible Society of Ethiopia. Every non-commercial work using this data in any form must fully include this copyright statement! Every commercial use of parts or the complete data in any form needs written permission of the Bible Society of Ethiopia!";

function LexiconCard({ word, onClose }: { word: GreekWord; onClose: () => void }) {
  // The parent keys this component by word, so state starts fresh for each word.
  const [entry, setEntry] = useState<Lexicon | null>(null);
  const [failed, setFailed] = useState(false);
  const missing = !word.strongs || failed;

  useEffect(() => {
    if (!word.strongs) return;
    let live = true;
    fetch(`/api/lexicon/${word.strongs}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((e) => live && setEntry(e))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [word.strongs]);

  return (
    <div className="rounded-2xl border border-rule bg-card p-5">
      <div className="mb-3 flex items-start justify-between">
        <p className="eyebrow text-accent">Word</p>
        <button onClick={onClose} className="text-sm text-muted hover:text-ink" aria-label="Close word">✕</button>
      </div>
      <p className="font-serif text-3xl">{word.surface}</p>
      <p className="mt-1 text-sm text-muted">
        <span className="font-serif italic">{word.translit}</span> · here: “{word.gloss}”
        {word.morph && <span className="ml-1 font-mono text-[0.7rem]">{word.morph}</span>}
      </p>
      {missing && <p className="mt-4 text-sm text-muted">No lexicon entry is linked to this word.</p>}
      {!missing && !entry && <p className="mt-4 text-sm text-muted">Opening the lexicon…</p>}
      {entry && (
        <div className="mt-4 border-t border-rule pt-4">
          <p className="font-serif text-xl">
            {entry.lemma} <span className="text-base italic text-muted">{entry.translit}</span>
          </p>
          <p className="mt-1 text-sm text-ink-2">
            {entry.gloss} · <span className="font-mono text-xs">{entry.strongs}</span> · {entry.occurrences}× in the SBL text
          </p>
          <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1 text-[0.9rem] leading-relaxed text-ink-2">
            {entry.definition.map((p, i) => <p key={i}>{p}</p>)}
          </div>
          <p className="mt-4 rounded-lg bg-paper-2 px-3 py-2 text-[0.8rem] text-ink-2">
            <span className="eyebrow mr-2 !text-[0.62rem] text-accent">Caution</span>A lexicon gives a word’s range of meaning.
            Which sense applies here is decided by context, not by the dictionary.
          </p>
          <p className="mt-3 font-mono text-[0.68rem] text-muted">[Abbott-Smith] via STEP Bible · public domain</p>
        </div>
      )}
    </div>
  );
}

function MarginNotes({ notes }: { notes: (ClaimView & { letter: string })[] }) {
  const { chapter } = useStudy();
  const [open, setOpen] = useState<number | null>(null);
  if (!notes.length) return null;
  return (
    <ul className="divide-y divide-rule border-t border-rule">
      {notes.map((n) => (
        <li key={n.id} className="py-4">
          <button onClick={() => setOpen(open === n.id ? null : n.id)} className="grid w-full grid-cols-[1.25rem_1fr] gap-2 text-left">
            <span className="font-mono text-sm text-accent">{n.letter}</span>
            <span>
              <span className="block font-serif text-[1.08rem] italic leading-snug">“{n.anchors.find((a) => a.quote)?.quote}”</span>
              <span className="mt-1 flex items-center gap-2 font-mono text-[0.68rem] uppercase tracking-widest text-muted">
                <Dot label={n.label} size={6} /> {chapter}:{n.anchors[0]?.verse} · {n.status === "verified" ? "verified" : "unverified"}
              </span>
            </span>
          </button>
          {open === n.id && <div className="pl-7"><ClaimCard claim={n} compact /></div>}
        </li>
      ))}
    </ul>
  );
}

function ReportProblem({ mode }: { mode: ReadMode }) {
  const { book, chapter } = useStudy();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [done, setDone] = useState(false);
  const translation = mode === "amh" || mode === "parallel" ? "Amharic" : mode === "greek" ? "Greek" : "English";
  if (done) return <p className="text-xs text-muted">Thanks — the problem is recorded.</p>;
  return open ? (
    <form
      className="space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!text.trim()) return;
        await postJson("/api/notes", { book: book.slug, chapter, kind: "text_issue", body: `[${translation}] ${text.trim()}` });
        setDone(true);
      }}
    >
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} autoFocus
        placeholder={`What looks wrong in the ${translation} text? e.g. “3:5–6 seem to be missing.”`}
        className="w-full rounded-lg border border-rule bg-card px-3 py-2 text-sm focus:border-ink focus:outline-none" />
      <button className="rounded-lg bg-ink px-3 py-1 text-sm text-paper">Report</button>
    </form>
  ) : (
    <button onClick={() => setOpen(true)} className="text-xs text-muted underline underline-offset-4 hover:text-ink">
      Report a problem in this text
    </button>
  );
}

export function Margin({
  step,
  mode,
  word,
  onCloseWord,
  tab,
  setTab,
  askRequest,
  letters,
  commentVerse = null,
  onCloseVerse,
}: {
  step: StepKey;
  mode: ReadMode;
  word: GreekWord | null;
  onCloseWord: () => void;
  tab: "margin" | "ask";
  setTab: (t: "margin" | "ask") => void;
  askRequest: AskRequest | null;
  letters: (ClaimView & { letter: string })[];
  commentVerse?: number | null;
  onCloseVerse?: () => void;
}) {
  const { study } = useStudy();

  // "Cited in this step": the translation(s) on screen, plus every source behind the claims this step shows.
  const stepClaims = step === "read" ? letters : study.claims.filter((c) => c.step === step);
  const cited = new Map<string, Cited>();
  if (step === "read") for (const s of TRANSLATION_SOURCES[mode]) cited.set(s.key, s);
  for (const c of stepClaims) for (const s of c.citations) if (!cited.has(s.key)) cited.set(s.key, { key: s.key, title: s.title, kind: s.source_type });
  if (word) cited.set("Abbott-Smith", { key: "Abbott-Smith", title: "A Manual Greek Lexicon of the New Testament (1922)", kind: "Lexicon" });

  return (
    <div>
      <div className="mb-6 flex gap-1 rounded-full bg-paper-2 p-1" role="tablist">
        {(["margin", "ask"] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={`flex-1 rounded-full px-4 py-1.5 text-sm ${tab === t ? "bg-card shadow-sm" : "text-muted hover:text-ink"}`}>
            {t === "margin" ? "Margin" : "Ask"}
          </button>
        ))}
      </div>

      <div hidden={tab !== "ask"}>
        <AskPanel request={askRequest} />
      </div>

      <div hidden={tab !== "margin"} className="space-y-8">
        {commentVerse !== null && <VerseCommentary key={commentVerse} verse={commentVerse} onClose={() => onCloseVerse?.()} />}
        {word && <LexiconCard key={`${word.strongs}-${word.surface}`} word={word} onClose={onCloseWord} />}
        {step === "read" && !word && commentVerse === null && (
          <div>
            <p className="eyebrow border-b border-rule pb-4 text-muted">Margin notes</p>
            {letters.length ? (
              <MarginNotes notes={letters} />
            ) : (
              <p className="mt-4 text-[0.95rem] leading-relaxed text-ink-2">
                {mode === "greek"
                  ? "Tap any Greek word to see its dictionary form, its range of meaning, and how often it appears."
                  : "Lettered notes on key phrases appear here once this chapter’s study is prepared. Switch to Greek to explore any word."}
              </p>
            )}
            <p className="mt-4 text-sm leading-relaxed text-muted">
              Select any words in the text. Context separates what the passage says from what readers commonly bring to it.
            </p>
          </div>
        )}

        <div>
          <p className="eyebrow mb-3 text-muted">Cited in this step</p>
          <ul className="divide-y divide-rule border-y border-rule">
            {[...cited.values()].map((s) => (
              <li key={s.key} className="py-3">
                <p className="font-mono text-xs text-accent">[{s.key}]</p>
                <p className="font-serif text-[1.05rem] leading-snug">{s.title}</p>
                <p className="text-xs text-muted">{s.kind}</p>
              </li>
            ))}
            {cited.size === 0 && <li className="py-3 text-sm text-muted">Nothing cited yet.</li>}
          </ul>
          <a href="/sources" className="mt-2 inline-block text-xs text-muted underline underline-offset-4 hover:text-ink">All sources →</a>
          {step === "read" && (mode === "amh" || mode === "parallel") && (
            <p className="mt-3 text-[0.7rem] leading-relaxed text-muted">{AMHARIC_NOTICE}</p>
          )}
          {step === "read" && <div className="mt-4"><ReportProblem mode={mode} /></div>}
        </div>

        <ProvenanceKey />
      </div>
    </div>
  );
}
