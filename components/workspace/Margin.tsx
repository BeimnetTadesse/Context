"use client";

import { useEffect, useState } from "react";
import { ProvenanceKey } from "@/components/ui";
import type { GreekWord } from "@/lib/data/chapter";
import type { ReadMode } from "./ReadStep";

interface Lexicon {
  strongs: string;
  lemma: string;
  translit: string | null;
  gloss: string | null;
  definition: string[];
  occurrences: number;
}

export interface CitedSource {
  key: string;
  title: string;
  kind: string;
}

// What the Read step actually relies on, per mode. Shown as "Cited in this step".
export function sourcesFor(mode: ReadMode, word: GreekWord | null): CitedSource[] {
  const web = { key: "WEB", title: "World English Bible", kind: "Primary text · translation" };
  const amh = { key: "AMH1962", title: "Amharic Bible (1962)", kind: "Primary text · translation" };
  const sbl = { key: "SBLGNT", title: "SBL Greek New Testament", kind: "Primary text · critical Greek text" };
  const tagnt = { key: "STEP", title: "Translators Amalgamated Greek NT", kind: "Tagged text · Tyndale House" };
  const as = { key: "Abbott-Smith", title: "A Manual Greek Lexicon of the New Testament (1922)", kind: "Lexicon" };
  const list = { web: [web], amh: [amh], parallel: [web, amh], greek: [sbl, tagnt] }[mode];
  return word ? [...list, as] : list;
}

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
        <button onClick={onClose} className="text-sm text-muted hover:text-ink" aria-label="Close word">
          ✕
        </button>
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
            {entry.gloss} · <span className="font-mono text-xs">{entry.strongs}</span> ·{" "}
            {entry.occurrences}× in the SBL text
          </p>
          <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1 text-[0.9rem] leading-relaxed text-ink-2">
            {entry.definition.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          <p className="mt-4 rounded-lg bg-paper-2 px-3 py-2 text-[0.8rem] text-ink-2">
            <span className="eyebrow mr-2 !text-[0.62rem] text-accent">Caution</span>A lexicon gives a word’s range of
            meaning. Which sense applies here is decided by context, not by the dictionary.
          </p>
          <p className="mt-3 font-mono text-[0.68rem] text-muted">[Abbott-Smith] via STEP Bible · public domain</p>
        </div>
      )}
    </div>
  );
}

export function Margin({
  mode,
  word,
  onCloseWord,
}: {
  mode: ReadMode;
  word: GreekWord | null;
  onCloseWord: () => void;
}) {
  const cited = sourcesFor(mode, word);
  return (
    <div className="space-y-8">
      {word ? (
        <LexiconCard key={`${word.strongs}-${word.surface}`} word={word} onClose={onCloseWord} />
      ) : (
        <div>
          <p className="eyebrow border-b border-rule pb-4 text-muted">Margin notes</p>
          <p className="mt-4 text-[0.95rem] leading-relaxed text-ink-2">
            {mode === "greek"
              ? "Tap any Greek word to see its dictionary form, its range of meaning, and how often it appears."
              : "Lettered notes on key phrases will appear here as this chapter’s study is prepared. Switch to Greek to explore any word."}
          </p>
        </div>
      )}

      <div>
        <p className="eyebrow mb-3 text-muted">Cited in this step</p>
        <ul className="divide-y divide-rule border-y border-rule">
          {cited.map((s) => (
            <li key={s.key} className="py-3">
              <p className="font-mono text-xs text-accent">[{s.key}]</p>
              <p className="font-serif text-[1.05rem] leading-snug">{s.title}</p>
              <p className="text-xs text-muted">{s.kind}</p>
            </li>
          ))}
        </ul>
        {(mode === "amh" || mode === "parallel") && (
          <p className="mt-3 text-[0.7rem] leading-relaxed text-muted">{AMHARIC_NOTICE}</p>
        )}
      </div>

      <ProvenanceKey />
    </div>
  );
}
