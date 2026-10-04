"use client";

import { useState } from "react";
import { Dot, LabelPill } from "@/components/ui";
import { LABEL_INFO, LABELS, labelBg, labelColor, type Label } from "@/lib/labels";
import { WhyDrawer } from "./Claim";
import { postJson, useStudy } from "./context";
import { PrepareStudy } from "./PrepareStudy";
import { SignInToUse } from "@/components/study/SignInToUse";

export interface SavedNote {
  id: number;
  kind: string;
  itemId: number | null;
  body: string;
}

export interface EvidenceRef {
  id: string;
  kind: string;
  text: string;
}

export function EvidenceList({ items }: { items: EvidenceRef[] }) {
  if (!items.length) return null;
  return (
    <ul className="mt-2 space-y-1.5">
      {items.map((e) => (
        <li key={e.id} className="flex gap-3 text-[0.9rem]">
          <span className="shrink-0 rounded border border-rule bg-card px-1.5 font-mono text-[0.68rem] leading-5">
            {e.kind === "verse" ? "WEB" : e.kind === "lexicon" ? "Abbott-Smith" : e.kind === "xref" ? "OpenBible" : "Claim"}
          </span>
          <span className="text-ink-2">{e.text}</span>
        </li>
      ))}
    </ul>
  );
}

function LabelChoices({ picked, expected, onPick }: { picked: Label | null; expected: Label | null; onPick: (l: Label) => void }) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {LABELS.map((l) => {
        const on = picked === l;
        const dim = picked !== null && !on && l !== expected;
        return (
          <button
            key={l}
            onClick={() => onPick(l)}
            disabled={picked !== null}
            className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[0.95rem] transition ${dim ? "opacity-35" : ""}`}
            style={on || l === expected ? { background: labelBg(l), borderColor: labelColor(l) } : { borderColor: "var(--rule)", background: "var(--card)" }}
          >
            <Dot label={l} /> {LABEL_INFO[l].short}
          </button>
        );
      })}
    </div>
  );
}

export function ReflectStep({ guesses, notes }: { guesses: Record<number, Label>; notes: SavedNote[] }) {
  const { book, chapter, study, setNoteCount } = useStudy();
  const [picked, setPicked] = useState<Record<number, Label>>(guesses);
  const [open, setOpen] = useState<number | null>(null);
  const answered = study.statements.filter((s) => picked[s.id]);
  const matches = answered.filter((s) => picked[s.id] === s.expected).length;

  const guess = async (id: number, l: Label) => {
    setPicked((p) => ({ ...p, [id]: l }));
    await postJson("/api/guess", { itemId: id, guess: l }).catch(() => {});
  };
  const reset = async () => {
    const ids = study.statements.map((s) => s.id);
    setPicked({});
    await postJson("/api/guess", { itemIds: ids }, "DELETE").catch(() => {});
  };

  return (
    <>
      {/* Part 1 */}
      <div className="mt-12 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow text-muted">Part 1 · Check yourself</p>
          <h2 className="mt-2 font-serif text-4xl">Text or Assumption?</h2>
        </div>
        {answered.length > 0 && (
          <p className="font-mono text-xs tracking-widest text-ink-2">
            {matches} OF {answered.length} MATCH
            <button onClick={reset} className="ml-3 text-accent underline underline-offset-4">Reset</button>
          </p>
        )}
      </div>
      <p className="mt-2 text-ink-2">Label each statement before you see how Context classifies it.</p>

      {study.statements.length === 0 && <PrepareStudy what="reflection exercise" />}
      <ol className="mt-6 divide-y divide-rule border-t border-rule">
        {study.statements.map((s, i) => {
          const mine = picked[s.id] ?? null;
          return (
            <li key={s.id} className="grid grid-cols-[1.5rem_1fr] gap-3 py-7">
              <span className="pt-1 font-mono text-sm text-accent">{i + 1}</span>
              <div>
                <p className="font-serif text-[1.3rem] leading-snug">{s.text}</p>
                <LabelChoices picked={mine} expected={mine ? s.expected : null} onPick={(l) => guess(s.id, l)} />
                {mine && (
                  <div className="mt-4">
                    <p className="eyebrow border-b border-rule pb-2 !text-[0.65rem]" style={{ color: labelColor(s.expected) }}>
                      {mine === s.expected ? "Matches" : `You said ${LABEL_INFO[mine].short}`} · {LABEL_INFO[s.expected].name}
                    </p>
                    <div className="mt-3"><LabelPill label={s.expected} /></div>
                    {s.explanation && <p className="mt-3 font-serif text-[1.1rem]">{s.explanation}</p>}
                    {s.claim && (
                      <>
                        <button onClick={() => setOpen(open === s.id ? null : s.id)} className="mt-2 text-sm text-accent hover:underline">
                          {open === s.id ? "⌄ Hide reasoning" : "› Show reasoning"}
                        </button>
                        {open === s.id && <WhyDrawer claim={s.claim} />}
                      </>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <CheckYourOwn />

      {/* Part 2 */}
      <p className="eyebrow mt-16 text-muted">Part 2 · Two questions, kept apart</p>
      <TwoColumns notes={notes} onSaved={setNoteCount} bookSlug={book.slug} chapter={chapter} />

      {/* Part 3 */}
      <p className="eyebrow mt-16 text-muted">Part 3 · Questions to sit with</p>
      <h2 className="mt-2 font-serif text-4xl">Yours to answer.</h2>
      <p className="mt-2 text-ink-2">These are prompts, not conclusions. Anything written here is saved as personal reflection.</p>
      {study.prompts.length === 0 && <PrepareStudy what="reflection prompts" />}
      <ol className="mt-6 divide-y divide-rule border-t border-rule">
        {study.prompts.map((p, i) => (
          <li key={p.id} className="grid grid-cols-[1.5rem_1fr] gap-3 py-7">
            <span className="pt-6 font-mono text-sm text-accent">{i + 1}</span>
            <div>
              {p.range && <p className="font-mono text-xs text-muted">{p.range}</p>}
              <p className="mt-1 font-serif text-[1.3rem] leading-snug">{p.text}</p>
              <NoteBox
                initial={notes.find((n) => n.itemId === p.id)?.body ?? ""}
                save={(body) => postJson<{ count: number }>("/api/notes", { book: book.slug, chapter, kind: "reflection", itemId: p.id, body })}
                onSaved={setNoteCount}
              />
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}

function CheckYourOwn() {
  const { book, chapter, aiLocked } = useStudy();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ label: Label; reasoning: string; textSays: string | null; evidence: EvidenceRef[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const check = async (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim().length < 3) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await postJson("/api/assumption", { book: book.slug, chapter, statement: text }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (aiLocked)
    return (
      <div className="mt-8">
        <SignInToUse what="Text or Assumption? on your own statements" />
      </div>
    );

  return (
    <form onSubmit={check} className="mt-8 rounded-2xl border border-rule bg-card p-6">
      <p className="eyebrow text-muted">Check a statement of your own</p>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. Paul wrote this from a Roman prison."
          className="flex-1 rounded-xl border border-rule bg-paper px-4 py-3 font-serif text-lg focus:border-ink focus:outline-none"
        />
        <button disabled={busy} className="rounded-xl bg-ink px-5 py-3 text-paper disabled:opacity-50">
          {busy ? "Checking…" : "Text or Assumption?"}
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-accent">{error}</p>}
      {result && (
        <div className="mt-5">
          <div className="flex flex-wrap items-center gap-3">
            <LabelPill label={result.label} />
            <span className="font-mono text-[0.65rem] uppercase tracking-widest text-muted">AI synthesis · unverified</span>
          </div>
          <p className="mt-3 font-serif text-[1.15rem]">{result.reasoning}</p>
          {result.textSays && <p className="mt-2 text-ink-2"><span className="eyebrow mr-2 !text-[0.62rem] text-[var(--l-explicit)]">The text says</span>{result.textSays}</p>}
          <EvidenceList items={result.evidence} />
        </div>
      )}
    </form>
  );
}

function TwoColumns({ notes, onSaved, bookSlug, chapter }: { notes: SavedNote[]; onSaved: (n: number) => void; bookSlug: string; chapter: number }) {
  const [says, setSays] = useState(notes.find((n) => n.kind === "text_says")?.body ?? "");
  const [bring, setBring] = useState(notes.find((n) => n.kind === "i_bring")?.body ?? "");
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const save = async () => {
    setState("saving");
    let count = 0;
    for (const [kind, body] of [["text_says", says], ["i_bring", bring]] as const) {
      if (body.trim()) count = (await postJson<{ count: number }>("/api/notes", { book: bookSlug, chapter, kind, body })).count;
    }
    if (count) onSaved(count);
    setState("saved");
  };
  return (
    <>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {([["What the text says", says, setSays, "explicit", "Paul asks that they be strengthened with power (3:16)…"],
           ["What I’m bringing", bring, setBring, "personal", "I assumed ‘mystery’ meant something no one can understand…"]] as const).map(
          ([title, value, set, l, ph]) => (
            <label key={title} className="block rounded-2xl border border-rule bg-card p-5">
              <span className="eyebrow flex items-center gap-2 !text-[0.65rem] text-muted"><Dot label={l} /> {title}</span>
              <textarea
                value={value}
                onChange={(e) => { set(e.target.value); setState("idle"); }}
                rows={6}
                placeholder={ph}
                className="mt-3 w-full resize-y bg-transparent font-serif text-[1.1rem] leading-relaxed placeholder:text-muted/60 focus:outline-none"
              />
            </label>
          ),
        )}
      </div>
      <button onClick={save} disabled={state === "saving" || (!says.trim() && !bring.trim())} className="mt-4 rounded-xl bg-ink px-5 py-3 text-paper disabled:opacity-40">
        {state === "saving" ? "Saving…" : state === "saved" ? "Saved to notebook ✓" : "Save to notebook"}
      </button>
    </>
  );
}

function NoteBox({ initial, save, onSaved }: { initial: string; save: (body: string) => Promise<{ count: number }>; onSaved: (n: number) => void }) {
  const [body, setBody] = useState(initial);
  const [state, setState] = useState<"idle" | "saving" | "saved">(initial ? "saved" : "idle");
  return (
    <div className="mt-4">
      <textarea
        value={body}
        onChange={(e) => { setBody(e.target.value); setState("idle"); }}
        rows={3}
        placeholder="Write slowly…"
        className="w-full resize-y rounded-xl border border-rule bg-card px-4 py-3 font-serif text-[1.1rem] leading-relaxed placeholder:text-muted/60 focus:border-ink focus:outline-none"
      />
      {body.trim() && state !== "saved" && (
        <button
          onClick={async () => {
            setState("saving");
            onSaved((await save(body)).count);
            setState("saved");
          }}
          className="mt-2 text-sm text-accent underline underline-offset-4"
        >
          {state === "saving" ? "Saving…" : "Save"}
        </button>
      )}
      {state === "saved" && body && <p className="mt-2 text-xs text-muted">Saved to your notebook.</p>}
    </div>
  );
}
