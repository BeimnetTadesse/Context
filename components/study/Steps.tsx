"use client";

import Link from "next/link";
import { useState } from "react";
import { Dot, LabelPill } from "@/components/ui";
import type { ClaimView } from "@/lib/data/study";
import type { VerseRow } from "@/lib/data/chapter";
import { ClaimCard, StatusMark, WhyDrawer } from "./Claim";
import { useStudy } from "./context";
import { PrepareStudy } from "./PrepareStudy";
import { ReceptionTimeline } from "./Commentators";

const Eyebrow = ({ children }: { children: React.ReactNode }) => <p className="eyebrow mb-4 mt-12 text-muted">{children}</p>;
const SECTION_COLORS = ["var(--accent)", "#cbbfae", "#9d4b3a", "var(--ink)", "#b9a58c", "#6d5b4b"];

const byStep = (claims: ClaimView[], step: string) => claims.filter((c) => c.step === step);

// ── II Observe ──
export function ObserveStep({ verses }: { verses: VerseRow[] }) {
  const { study, trail, setTrail } = useStudy();
  const observations = byStep(study.claims, "observe");
  const trailVerses = trail ? verses.filter((v) => new RegExp(`\\b${trail}`, "i").test(v.web)) : [];

  return (
    <>
      <Eyebrow>Structure</Eyebrow>
      {study.sections.length ? (
        <>
          <div className="flex h-3 gap-1 overflow-hidden rounded-full">
            {study.sections.map((s, i) => (
              <span
                key={i}
                className="rounded-full"
                style={{ flex: s.end - s.start + 1, background: SECTION_COLORS[i % SECTION_COLORS.length] }}
                title={s.title}
              />
            ))}
          </div>
          <ul className="mt-4 divide-y divide-rule border-y border-rule">
            {study.sections.map((s, i) => (
              <li key={i} className="grid grid-cols-[1rem_4.5rem_1fr] gap-4 py-4">
                <span className="mt-2 h-2.5 w-2.5 rounded-sm" style={{ background: SECTION_COLORS[i % SECTION_COLORS.length] }} />
                <span className="font-mono text-sm text-accent">
                  {s.start === s.end ? `${s.start}` : `${s.start}–${s.end}`}
                </span>
                <span>
                  <span className="block font-serif text-xl">{s.title}</span>
                  {s.summary && <span className="text-ink-2">{s.summary}</span>}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-right"><StatusMark status="unverified" origin="ai_draft" /></p>
        </>
      ) : (
        <PrepareStudy what="structure and observations" />
      )}

      {observations.length > 0 && (
        <>
          <Eyebrow>What’s on the page</Eyebrow>
          {observations.map((c) => <ClaimCard key={c.id} claim={c} />)}
        </>
      )}

      <Eyebrow>Repeated words · counted from the text</Eyebrow>
      <div className="flex flex-wrap gap-2">
        {study.repeated.map((w) => (
          <button
            key={w.word}
            onClick={() => setTrail(trail === w.word ? null : w.word)}
            className={`rounded-full border px-4 py-2 font-serif text-lg transition ${
              trail === w.word ? "border-ink bg-ink text-paper" : "border-rule bg-card hover:border-ink"
            }`}
          >
            {w.word} <span className={`ml-1 font-mono text-xs ${trail === w.word ? "text-paper/60" : "text-muted"}`}>×{w.count}</span>
          </button>
        ))}
      </div>
      {trail && (
        <div className="mt-5 divide-y divide-rule border-y border-rule">
          {trailVerses.map((v) => (
            <p key={v.ord} className="grid grid-cols-[3rem_1fr] gap-3 py-3 font-serif text-[1.1rem]">
              <span className="font-mono text-sm text-accent">{v.verse}</span>
              <span>
                {v.web.split(new RegExp(`(\\b${trail}\\w*)`, "i")).map((part, i) =>
                  i % 2 ? <mark key={i} className="rounded bg-[var(--l-explicit-bg)] px-0.5">{part}</mark> : part,
                )}
              </span>
            </p>
          ))}
          <p className="py-3 text-sm text-muted">These words are now marked in Read, too.</p>
        </div>
      )}
    </>
  );
}

// ── III Context ──
const TOPICS: [string, string][] = [
  ["author", "Author"],
  ["audience", "Audience"],
  ["setting", "Setting"],
  ["literary", "Literary context"],
  ["argument", "Argument"],
];

export function ContextStep({ chapterCount }: { chapterCount: number }) {
  const { book, chapter, study } = useStudy();
  const claims = byStep(study.claims, "context");
  return (
    <>
      <BookOverview />
      <Eyebrow>Where this sits in {book.name}</Eyebrow>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {Array.from({ length: chapterCount }, (_, i) => (
          <Link
            key={i}
            href={`/study/${book.slug}/${i + 1}?step=context`}
            className={`grid h-11 min-w-11 flex-1 place-items-center rounded-lg border font-mono text-sm ${
              i + 1 === chapter ? "border-ink bg-ink text-paper" : i + 1 < chapter ? "border-rule bg-paper-2" : "border-rule bg-card"
            }`}
          >
            {i + 1}
          </Link>
        ))}
      </div>

      {claims.length === 0 ? (
        <PrepareStudy what="context" />
      ) : (
        TOPICS.filter(([t]) => claims.some((c) => c.topic === t)).map(([t, name], i) => (
          <section key={t} className="mt-12">
            <h2 className="flex items-baseline gap-3 border-b border-rule pb-3 font-serif text-3xl">
              <span className="font-mono text-xs text-accent">0{i + 1}</span>
              {name}
            </h2>
            {claims.filter((c) => c.topic === t).map((c) => <ClaimCard key={c.id} claim={c} />)}
          </section>
        ))
      )}
      {study.intros.length > 0 && <BookIntros />}

      <p className="mt-8 rounded-xl bg-paper-2 px-4 py-3 text-sm leading-relaxed text-ink-2">
        <span className="eyebrow mr-2 !text-[0.62rem] text-accent">Research note</span>
        Historical questions such as authorship and date depend on scholarship that is not yet in Context’s source library.
        Where the assistant mentions them, they are labelled as views and stay unverified until a scholarly source is attached.
      </p>
    </>
  );
}

const BOOK_TOPICS: Record<string, string> = { author: "Who wrote it", audience: "To whom", purpose: "Why it was written", structure: "How it’s built" };

/** About the whole book: the overview claims, its themes, and a chapter-by-chapter outline. */
function BookOverview() {
  const { book, chapter, study } = useStudy();
  const { summary, overview, themes, outline } = study.book;
  if (!summary && overview.length === 0 && themes.length === 0) return null;
  return (
    <section className="mt-10 rounded-3xl border border-rule bg-card px-5 py-7 sm:px-8">
      <p className="eyebrow text-accent">The whole book</p>
      <h2 className="mt-2 font-serif text-[clamp(2rem,4vw,2.6rem)] leading-tight">About {book.name}</h2>
      {summary && <ClaimCard claim={summary} />}

      {overview.length > 0 && (
        <div className="mt-8">
          <p className="eyebrow text-muted">At a glance</p>
          {overview.map((c) => (
            <div key={c.id} className="mt-3 border-b border-rule last:border-b-0">
              <p className="pt-3 font-mono text-[0.65rem] uppercase tracking-widest text-accent">{BOOK_TOPICS[c.topic ?? ""] ?? c.topic}</p>
              <ClaimCard claim={c} compact />
            </div>
          ))}
        </div>
      )}

      {themes.length > 0 && (
        <div className="mt-8">
          <p className="eyebrow text-muted">Themes that run through it</p>
          {themes.map((t, i) => (
            <div key={t.claim.id} className="mt-4 border-b border-rule last:border-b-0">
              <p className="flex items-baseline gap-3 pt-3 font-serif text-2xl">
                <span className="font-mono text-xs text-accent">{String(i + 1).padStart(2, "0")}</span>
                {t.title}
              </p>
              <ClaimCard claim={t.claim} compact />
            </div>
          ))}
        </div>
      )}

      {outline.length > 0 && (
        <details className="group mt-8 rounded-2xl border border-rule bg-paper/60 px-4 py-3">
          <summary className="flex cursor-pointer list-none items-center justify-between font-serif text-xl">
            Chapter by chapter
            <span className="font-mono text-xs text-muted group-open:hidden">Show ▾</span>
            <span className="hidden font-mono text-xs text-muted group-open:inline">Hide ▴</span>
          </summary>
          <ol className="mt-3 divide-y divide-rule">
            {outline.map((o) => (
              <li key={o.chapter} className={`grid grid-cols-[3rem_1fr] gap-3 py-2.5 ${o.chapter === chapter ? "rounded-lg bg-[var(--l-scholarly-bg)] px-2" : ""}`}>
                <Link href={`/study/${book.slug}/${o.chapter}?step=context`} className="font-mono text-sm text-accent hover:underline">
                  {o.chapter}
                </Link>
                <span className="text-ink-2">{o.sections.map((x) => x.title).join(" · ")}</span>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-xs text-muted">Section titles from each chapter’s study (AI draft, unverified).</p>
        </details>
      )}
    </section>
  );
}

function BookIntros() {
  const { book, study } = useStudy();
  const [open, setOpen] = useState<string | null>(null);
  return (
    <section className="mt-14">
      <h2 className="flex items-baseline gap-3 border-b border-rule pb-3 font-serif text-3xl">
        <span className="font-mono text-xs text-accent">∗</span>Introducing {book.name}
      </h2>
      <p className="mt-3 text-sm text-muted">
        What named commentators and reference works say about the book as a whole. Their views, labelled with their tradition.
      </p>
      <div className="mt-4 space-y-3">
        {study.intros.map((i) => {
          // Long reference articles (ISBE runs to tens of thousands of words) show a generous part, then link out.
          const FULL = 6000;
          const long = i.text.length > 900;
          const cut = (n: number) => i.text.slice(0, n).replace(/\s+\S*$/, "") + "…";
          const shown = !long ? i.text : open === i.key ? (i.text.length > FULL ? cut(FULL) : i.text) : cut(900);
          return (
            <article key={i.key} className="rounded-2xl border border-rule bg-card p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-serif text-xl">{i.author}</p>
                <p className="font-mono text-xs text-accent">{i.written}</p>
              </div>
              <p className="text-sm text-muted"><span className="italic">{i.title}</span> · {i.tradition}</p>
              <p className="mt-3 whitespace-pre-line font-serif text-[1.02rem] leading-relaxed text-ink-2">{shown}</p>
              <div className="mt-1 flex flex-wrap gap-x-5">
                {long && (
                  <button onClick={() => setOpen(open === i.key ? null : i.key)} className="text-sm text-accent hover:underline">
                    {open === i.key ? "Show less" : i.text.length > FULL ? "Read more" : "Read the full introduction"}
                  </button>
                )}
                {i.url && (open === i.key || !long) && (
                  <a href={i.url} target="_blank" rel="noreferrer" className="text-sm text-accent hover:underline">
                    Read the full article at the source ↗
                  </a>
                )}
              </div>
              <p className="mt-3 border-t border-rule pt-2 font-mono text-[0.65rem] text-muted">[{i.key}] {i.license}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

// ── IV Language ──
export function LanguageStep() {
  const { study } = useStudy();
  const claims = byStep(study.claims, "language");
  return (
    <div className="mt-10 space-y-6">
      {study.language.map((t) => (
        <article key={t.strongs} className="rounded-2xl border border-rule bg-card p-6 sm:p-8">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <p className="font-serif text-4xl">{t.lemma}</p>
            <p className="font-mono text-xs text-muted">{t.verses.map((v) => v).join(" · ")}</p>
          </div>
          <p className="mt-1 text-ink-2">
            <span className="font-serif italic">{t.translit}</span>
            <span className="ml-3">{t.gloss}</span>
            <span className="ml-3 font-mono text-xs text-muted">{t.strongs} · {t.ntCount}× in the NT</span>
          </p>
          {t.meaningHere && <p className="mt-5 text-[1.05rem] leading-relaxed">{t.meaningHere}</p>}
          {t.translationNote && <p className="mt-3 leading-relaxed text-ink-2">{t.translationNote}</p>}
          {t.caution && (
            <p className="mt-5 rounded-lg bg-paper-2 px-4 py-3 text-[0.92rem]">
              <span className="eyebrow mr-3 !text-[0.62rem] text-accent">Caution</span>
              {t.caution}
            </p>
          )}
          {t.computed && (
            <p className="mt-4 text-sm text-muted">
              Chosen because it repeats in this chapter but is uncommon in the NT. Switch Read to Greek and tap the word
              for its full lexicon entry.
            </p>
          )}
          {claims.filter((c) => c.strongs === t.strongs).map((c) => (
            <div key={c.id} className="mt-4 border-t border-rule pt-2"><ClaimCard claim={c} compact /></div>
          ))}
        </article>
      ))}
      {study.language.every((t) => t.computed) && <PrepareStudy what="language notes" />}
    </div>
  );
}

// ── V Connections ──
export function ConnectionsStep() {
  const { study } = useStudy();
  const groups = [...new Set(study.connections.map((c) => c.group))];
  const computed = study.connections.every((c) => c.explanation === null);
  return (
    <>
      {groups.map((g) => (
        <section key={g}>
          <Eyebrow>{g}</Eyebrow>
          <ul className="divide-y divide-rule border-t border-rule">
            {study.connections.filter((c) => c.group === g).map((c, i) => (
              <li key={i} className="grid gap-3 py-5 sm:grid-cols-[14rem_1fr] sm:gap-8">
                <div>
                  {c.href ? (
                    <Link href={c.href} className="font-serif text-2xl hover:text-accent">{c.ref}</Link>
                  ) : (
                    <span className="font-serif text-2xl">{c.ref}</span>
                  )}
                  <p className="mt-1 flex items-center gap-2 font-mono text-xs text-[var(--l-inference)]">
                    <Dot label="inference" size={6} /> {c.relation}
                    {c.votes != null && <span className="text-muted">· {c.votes} votes</span>}
                  </p>
                </div>
                <div className="text-[1.02rem] leading-relaxed text-ink-2">
                  {c.explanation && <p className="mb-2 text-ink">{c.explanation}</p>}
                  <p className="font-serif italic">“{c.text}”</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {computed && (
        <>
          <p className="mt-6 text-sm text-muted">
            Ranked by reader votes on OpenBible.info. Their relationships haven’t been explained yet.
          </p>
          <PrepareStudy what="explained connections" />
        </>
      )}
    </>
  );
}

// ── VI Interpretations ──
export function InterpretationsStep({ verses }: { verses: number[] }) {
  const { study } = useStudy();
  const firstRange = study.interpretations[0]?.range.match(/:(\d+)/)?.[1];
  return (
    <>
      <p className="mt-8 rounded-xl border border-dashed border-rule px-5 py-4 text-[0.95rem] leading-relaxed text-ink-2">
        <span className="eyebrow mr-3 !text-[0.62rem] text-accent">Research note</span>
        Context lists the main views and the evidence each uses. It does not choose between them. Each view has to account
        for the same words on the page.
      </p>
      {study.interpretations.length === 0 && <PrepareStudy what="interpretation questions" />}
      {study.interpretations.map((q) => (
        <section key={q.id} className="mt-14">
          <h2 className="flex flex-wrap items-baseline gap-3 font-serif text-3xl">
            <span className="font-mono text-sm text-accent">{q.range}</span>
            {q.question}
          </h2>
          {q.commonGround && (
            <p className="mt-4 flex gap-3 text-ink-2">
              <span className="mt-2"><Dot label="explicit" /></span>
              <span>
                <span className="eyebrow mr-2 !text-[0.62rem] text-[var(--l-explicit)]">Common ground</span>
                {q.commonGround}
              </span>
            </p>
          )}
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {q.views.map((v) => (
              <ViewCard key={v.label} view={v} />
            ))}
          </div>
        </section>
      ))}
      <ReceptionTimeline verses={verses} initial={firstRange ? Number(firstRange) : verses[0]} />
    </>
  );
}

function ViewCard({ view }: { view: { label: string; holders: string | null; title: string; claims: ClaimView[] } }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <article className="rounded-2xl border border-rule bg-card p-6">
      <p className="eyebrow text-muted">
        {view.label}
        {view.holders ? ` · ${view.holders}` : ""}
      </p>
      {(() => {
        const voices = [...new Map(view.claims.flatMap((c) => c.citations).filter((c) => c.quote).map((c) => [c.key, c])).values()];
        return voices.length ? (
          <p className="mt-1 text-xs text-muted">Cited: {voices.map((v) => `${v.key}${v.written ? ` (${v.written.slice(0, 4)})` : ""}`).join(" · ")}</p>
        ) : null;
      })()}
      <h3 className="mt-2 border-b border-rule pb-4 font-serif text-2xl leading-snug">{view.title}</h3>
      {view.claims.map((c) => (
        <div key={c.id} className="mt-4">
          <div className="flex flex-wrap items-center gap-2"><LabelPill label={c.label} /><StatusMark status={c.status} origin={c.origin} /></div>
          <p className="mt-2 font-serif text-[1.1rem] leading-snug">{c.statement}</p>
          <button onClick={() => setOpen(open === c.id ? null : c.id)} className="mt-1 text-sm text-accent hover:underline">
            {open === c.id ? "⌄ Hide why" : "› Show me why"}
          </button>
          {open === c.id && <WhyDrawer claim={c} />}
        </div>
      ))}
    </article>
  );
}
