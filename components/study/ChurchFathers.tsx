"use client";

import { useEffect, useState } from "react";
import { LabelPill } from "@/components/ui";
import type { FatherQuote, FatherVoice } from "@/lib/data/fathers";
import { useStudy } from "./context";

type FathersData = { fathers: FatherVoice[]; counts: Record<number, number> };

export function useFathers(from: number | null, to: number | null) {
  const { book, chapter } = useStudy();
  const [data, setData] = useState<({ key: string } & FathersData) | null>(null);
  const key = `${book.slug}/${chapter}/${from}-${to}`;

  useEffect(() => {
    if (from === null || to === null) return;
    let live = true;
    fetch(`/api/fathers/${book.slug}/${chapter}?from=${from}&to=${to}`)
      .then((r) => r.json())
      .then((d) => live && setData({ key, fathers: d.fathers ?? [], counts: d.counts ?? {} }))
      .catch(() => live && setData({ key, fathers: [], counts: {} }));
    return () => {
      live = false;
    };
  }, [book.slug, chapter, from, to, key]);

  return data?.key === key ? data : null;
}

function QuoteText({ q, limit }: { q: FatherQuote; limit: number }) {
  const [open, setOpen] = useState(false);
  const long = q.text.length > limit;
  const text = open || !long ? q.text : q.text.slice(0, limit).replace(/\s+\S*$/, "") + "…";
  return (
    <div>
      <p className="whitespace-pre-line font-serif text-[1.02rem] leading-relaxed text-ink-2">{text}</p>
      {long && (
        <button onClick={() => setOpen(!open)} className="mt-1 text-sm text-accent hover:underline">
          {open ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
}

/** One Father: who, when, anything to know about them, then their words (exact quotes) with where each comes from. */
export function FatherCard({ voice, limit = 600, shown = 2 }: { voice: FatherVoice; limit?: number; shown?: number }) {
  const [all, setAll] = useState(false);
  const quotes = all ? voice.quotes : voice.quotes.slice(0, shown);
  return (
    <article className="rounded-2xl border border-rule bg-card p-5">
      <header className="mb-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-serif text-xl">
            {voice.wiki ? (
              <a href={voice.wiki} target="_blank" rel="noreferrer" className="hover:text-accent">{voice.name}</a>
            ) : (
              voice.name
            )}
          </p>
          <p className="font-mono text-xs text-accent" title="Approximate date of death or writing">c. AD {voice.year}</p>
        </div>
        <p className="text-sm text-muted">{voice.category}</p>
        {voice.condemned && (
          <p className="mt-2 rounded-lg bg-[var(--l-tradition-bg)] px-3 py-1.5 text-sm text-ink-2">
            This writer’s teaching was condemned by a church council. Read it as a voice the church rejected.
          </p>
        )}
        {voice.note && <p className="mt-2 text-sm italic text-muted">{voice.note}</p>}
      </header>
      <div className="space-y-5">
        {quotes.map((q) => (
          <div key={q.id}>
            <p className="mb-1 font-mono text-[0.68rem] uppercase tracking-widest text-muted">
              on {q.range}
              {q.work ? ` · ${q.work}` : ""}
            </p>
            {q.via && <p className="mb-1 text-xs italic text-muted">{q.via}</p>}
            <QuoteText q={q} limit={limit} />
            <p className="mt-2 text-[0.7rem] leading-relaxed text-muted">
              {q.translation}
              {q.url && (
                <>
                  {" · "}
                  <a href={q.url} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-ink">Source ↗</a>
                </>
              )}
            </p>
          </div>
        ))}
      </div>
      {voice.quotes.length > shown && (
        <button onClick={() => setAll(!all)} className="mt-4 text-sm text-accent hover:underline">
          {all ? "Show fewer" : `+ ${voice.quotes.length - shown} more from ${voice.name}`}
        </button>
      )}
    </article>
  );
}

function FathersList({ data, limit, first }: { data: FathersData | null; limit: number; first: number }) {
  const [all, setAll] = useState(false);
  if (data === null) return <p className="text-sm text-muted">Opening the Fathers…</p>;
  if (data.fathers.length === 0) return <p className="text-sm text-muted">No Church Father on this verse in Context’s sources.</p>;
  const shown = all ? data.fathers : data.fathers.slice(0, first);
  return (
    <>
      <div className="space-y-4">
        {shown.map((v) => (
          <FatherCard key={v.name} voice={v} limit={limit} />
        ))}
      </div>
      {data.fathers.length > first && (
        <button onClick={() => setAll(!all)} className="mt-4 rounded-xl border border-rule bg-card px-4 py-2 text-sm text-ink-2 hover:border-ink hover:text-ink">
          {all ? "Show fewer" : `Show all ${data.fathers.length} Fathers`}
        </button>
      )}
    </>
  );
}

const ABOUT =
  "Exact quotes from the early church (to AD 750), in old public-domain translations: the Catena Aurea and the Ante-Nicene and Nicene Fathers. Nothing here is written or summarised by AI.";

/** Margin panel tab: the Fathers on one verse. */
export function VerseFathers({ verse }: { verse: number }) {
  const data = useFathers(verse, verse);
  return (
    <div>
      <p className="mb-4 text-sm leading-relaxed text-muted">{ABOUT}</p>
      <FathersList key={verse} data={data} limit={450} first={6} />
    </div>
  );
}

/** Interpretations › The Church Fathers: its own section, apart from the later commentators. */
export function ChurchFathers({ verses, initial }: { verses: number[]; initial: number }) {
  const [verse, setVerse] = useState(initial);
  const data = useFathers(verse, verse);
  const [counts, setCounts] = useState<Record<number, number> | null>(null);
  if (data && counts === null) setCounts(data.counts);

  return (
    <section className="mt-16">
      <p className="eyebrow text-muted">The Church Fathers</p>
      <h2 className="mt-2 font-serif text-3xl">How did the early church read this verse?</h2>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <LabelPill label="tradition" />
        <p className="max-w-2xl text-ink-2">
          The first Christian teachers, from the 2nd to the 8th century. Their reading is tradition: valuable, often
          shared, but not the passage itself. Compare it with what the text says.
        </p>
      </div>
      <p className="mt-3 max-w-2xl text-sm text-muted">{ABOUT}</p>
      <div className="mt-5 flex flex-wrap gap-1.5">
        {verses.map((v) => {
          const n = counts?.[v] ?? 0;
          return (
            <button
              key={v}
              onClick={() => setVerse(v)}
              title={counts ? `${n} ${n === 1 ? "Father" : "Fathers"}` : undefined}
              className={`h-9 min-w-9 rounded-lg border px-2 font-mono text-sm ${
                v === verse ? "border-ink bg-ink text-paper" : counts && n === 0 ? "border-rule text-muted/60 hover:border-ink" : "border-rule bg-card hover:border-ink"
              }`}
            >
              {v}
            </button>
          );
        })}
      </div>
      <div className="mt-8">
        <FathersList key={verse} data={data} limit={700} first={8} />
      </div>
    </section>
  );
}
