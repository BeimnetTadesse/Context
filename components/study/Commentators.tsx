"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Commentator, CommentaryNote } from "@/lib/data/commentary";
import { useStudy } from "./context";

/** Turn the references we resolved inside a note into links (NT) or labelled spans (OT). */
function Linked({ note }: { note: CommentaryNote }) {
  const parts: React.ReactNode[] = [];
  let rest = note.text;
  let key = 0;
  for (const r of note.refs) {
    const i = rest.indexOf(r.raw);
    if (i < 0) continue;
    parts.push(rest.slice(0, i));
    parts.push(
      r.href ? (
        <Link key={key++} href={r.href} className="text-accent underline decoration-accent/30 underline-offset-2 hover:decoration-accent" title={r.label}>
          {r.raw}
        </Link>
      ) : (
        <span key={key++} className="underline decoration-dotted decoration-muted underline-offset-2" title={`${r.label} (Old Testament)`}>
          {r.raw}
        </span>
      ),
    );
    rest = rest.slice(i + r.raw.length);
  }
  parts.push(rest);
  return <>{parts}</>;
}

function NoteText({ note, limit }: { note: CommentaryNote; limit: number }) {
  const [open, setOpen] = useState(false);
  const long = note.text.length > limit;
  const shown = open || !long ? note : { ...note, text: note.text.slice(0, limit).replace(/\s+\S*$/, "") + "…" };
  return (
    <div>
      <p className="whitespace-pre-line font-serif text-[1.02rem] leading-relaxed text-ink-2">
        <Linked note={shown} />
      </p>
      {long && (
        <button onClick={() => setOpen(!open)} className="mt-1 text-sm text-accent hover:underline">
          {open ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
}

export function CommentatorCard({ c, limit = 650 }: { c: Commentator; limit?: number }) {
  return (
    <article className="rounded-2xl border border-rule bg-card p-5">
      <header className="mb-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-serif text-xl">{c.author}</p>
          <p className="font-mono text-xs text-accent">{c.written}</p>
        </div>
        <p className="text-sm text-muted">
          <span className="italic">{c.title}</span> · {c.tradition}
        </p>
      </header>
      <div className="space-y-4">
        {c.notes.map((n) => (
          <div key={n.id}>
            <p className="mb-1 font-mono text-[0.68rem] uppercase tracking-widest text-muted">on {n.range}</p>
            <NoteText note={n} limit={limit} />
          </div>
        ))}
      </div>
      <p className="mt-4 border-t border-rule pt-2 font-mono text-[0.65rem] text-muted">
        [{c.key}] {c.license}
      </p>
    </article>
  );
}

export function useCommentary(from: number | null, to: number | null) {
  const { book, chapter } = useStudy();
  const [data, setData] = useState<{ key: string; commentators: Commentator[] } | null>(null);
  const key = `${book.slug}/${chapter}/${from}-${to}`;

  useEffect(() => {
    if (from === null || to === null) return;
    let live = true;
    fetch(`/api/commentary/${book.slug}/${chapter}?from=${from}&to=${to}`)
      .then((r) => r.json())
      .then((d) => live && setData({ key, commentators: d.commentators ?? [] }))
      .catch(() => live && setData({ key, commentators: [] }));
    return () => {
      live = false;
    };
  }, [book.slug, chapter, from, to, key]);

  return data?.key === key ? data.commentators : null;
}

/** Margin panel: what every commentator says about one verse. */
export function VerseCommentary({ verse, onClose }: { verse: number; onClose: () => void }) {
  const { chapter } = useStudy();
  const commentators = useCommentary(verse, verse);
  return (
    <div>
      <div className="mb-4 flex items-start justify-between border-b border-rule pb-3">
        <div>
          <p className="eyebrow text-accent">Commentators</p>
          <p className="mt-1 font-serif text-2xl">on {chapter}:{verse}</p>
        </div>
        <button onClick={onClose} className="text-sm text-muted hover:text-ink" aria-label="Close commentary">✕</button>
      </div>
      <p className="mb-4 text-sm leading-relaxed text-muted">
        Oldest first. These are named interpreters from particular traditions — read them as voices, not verdicts.
      </p>
      {commentators === null ? (
        <p className="text-sm text-muted">Opening the commentaries…</p>
      ) : commentators.length === 0 ? (
        <p className="text-sm text-muted">No commentary notes on this verse.</p>
      ) : (
        <div className="space-y-4">
          {commentators.map((c) => (
            <CommentatorCard key={c.key} c={c} limit={500} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Interpretations › Voices across the centuries: one passage, every commentator, on a timeline. */
export function ReceptionTimeline({ verses, initial }: { verses: number[]; initial: number }) {
  const [verse, setVerse] = useState(initial);
  const commentators = useCommentary(verse, verse);
  return (
    <section className="mt-16">
      <p className="eyebrow text-muted">Voices across the centuries</p>
      <h2 className="mt-2 font-serif text-3xl">How has this verse been read?</h2>
      <p className="mt-2 max-w-2xl text-ink-2">
        Five centuries of named commentators on the same words, oldest first. Notice where they agree, where their
        traditions pull them apart, and what each one assumes.
      </p>
      <div className="mt-5 flex flex-wrap gap-1.5">
        {verses.map((v) => (
          <button
            key={v}
            onClick={() => setVerse(v)}
            className={`h-9 min-w-9 rounded-lg border px-2 font-mono text-sm ${v === verse ? "border-ink bg-ink text-paper" : "border-rule bg-card hover:border-ink"}`}
          >
            {v}
          </button>
        ))}
      </div>

      {commentators === null ? (
        <p className="mt-6 text-sm text-muted">Opening the commentaries…</p>
      ) : commentators.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No commentary notes on this verse.</p>
      ) : (
        <ol className="relative mt-8 space-y-6 border-l border-rule pl-6">
          {commentators.map((c) => (
            <li key={c.key} className="relative">
              <span className="absolute -left-[1.93rem] top-5 h-3 w-3 rounded-full border-2 border-paper bg-accent" />
              <CommentatorCard c={c} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
