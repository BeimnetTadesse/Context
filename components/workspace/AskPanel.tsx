"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { LabelPill } from "@/components/ui";
import type { Label } from "@/lib/labels";
import { postJson, useStudy } from "@/components/study/context";
import { EvidenceList, type EvidenceRef } from "@/components/study/Reflect";
import { SignInToUse } from "@/components/study/SignInToUse";

export type AskRequest = { kind: "ask" | "check"; text: string; nonce: number };

interface Entry {
  id: number;
  kind: "ask" | "check";
  text: string;
  state: "pending" | "done" | "error";
  error?: string;
  result?: AskResult | CheckResult;
}

interface AskResult {
  status: "answered" | "partial" | "insufficient_evidence";
  segments: { label: Label; text: string; evidence: EvidenceRef[] }[];
  unanswered: string | null;
}
interface CheckResult {
  label: Label;
  reasoning: string;
  textSays: string | null;
  evidence: EvidenceRef[];
}

const SUGGESTIONS = ["Why is this passage here?", "What does the key word in this chapter mean?", "What does the text not say?"];

export function AskPanel({ request }: { request: AskRequest | null }) {
  const { book, chapter, aiLocked } = useStudy();
  const [q, setQ] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const handled = useRef<number | null>(null);

  const run = async (kind: "ask" | "check", text: string) => {
    const id = Date.now();
    setEntries((e) => [{ id, kind, text, state: "pending" }, ...e]);
    const update = (patch: Partial<Entry>) => setEntries((e) => e.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    try {
      const result =
        kind === "ask"
          ? await postJson<AskResult>("/api/ask", { book: book.slug, chapter, question: text })
          : await postJson<CheckResult>("/api/assumption", { book: book.slug, chapter, statement: text });
      update({ state: "done", result });
    } catch (e) {
      update({ state: "error", error: (e as Error).message });
    }
  };

  // Requests from the selection popover ("Ask about this", "Text or Assumption?").
  // useEffectEvent: the effect re-runs only for a new request, but always calls the latest run().
  const onRequest = useEffectEvent((r: AskRequest) => void run(r.kind, r.text));
  useEffect(() => {
    if (request && handled.current !== request.nonce && !aiLocked) {
      handled.current = request.nonce;
      onRequest(request);
    }
  }, [request, aiLocked]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim().length < 3) return;
    void run("ask", q.trim());
    setQ("");
  };

  if (aiLocked) return <SignInToUse />;

  return (
    <div>
      <form onSubmit={submit}>
        <textarea
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) submit(e);
          }}
          rows={3}
          placeholder={`Ask about ${book.name} ${chapter}…`}
          className="w-full resize-none rounded-xl border border-rule bg-card px-4 py-3 font-serif text-[1.05rem] placeholder:text-muted/60 focus:border-ink focus:outline-none"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-xs text-muted">Answers use only Context’s evidence.</p>
          <button className="rounded-lg bg-ink px-4 py-1.5 text-sm text-paper">Ask</button>
        </div>
      </form>
      {entries.length === 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => void run("ask", s)} className="rounded-full border border-rule px-3 py-1 text-left text-sm text-ink-2 hover:border-ink">
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="mt-6 space-y-6">
        {entries.map((e) => (
          <div key={e.id} className="border-t border-rule pt-4">
            <p className="eyebrow !text-[0.62rem] text-muted">{e.kind === "ask" ? "You asked" : "Text or Assumption?"}</p>
            <p className="mt-1 font-serif text-[1.08rem] italic">“{e.text}”</p>
            {e.state === "pending" && <p className="mt-3 animate-pulse text-sm text-muted">Reading the evidence…</p>}
            {e.state === "error" && <p className="mt-3 text-sm text-accent">{e.error}</p>}
            {e.state === "done" && e.kind === "ask" && <AskAnswer r={e.result as AskResult} />}
            {e.state === "done" && e.kind === "check" && (() => {
              const r = e.result as CheckResult;
              return (
              <div className="mt-3">
                <LabelPill label={r.label} />
                <p className="mt-2 text-[0.95rem]">{r.reasoning}</p>
                {r.textSays && <p className="mt-2 text-sm text-ink-2"><b className="font-medium">The text says:</b> {r.textSays}</p>}
                <EvidenceList items={r.evidence} />
              </div>
              );
            })()}
          </div>
        ))}
      </div>
    </div>
  );
}

function AskAnswer({ r }: { r: AskResult }) {
  const all = r.segments.flatMap((s) => s.evidence);
  const index = new Map<string, number>();
  for (const e of all) if (!index.has(e.id)) index.set(e.id, index.size + 1);
  return (
    <div className="mt-3">
      <p className="font-mono text-[0.62rem] uppercase tracking-widest text-muted">AI synthesis · unverified</p>
      {r.segments.map((s, i) => (
        <div key={i} className="mt-3 border-l-2 pl-3" style={{ borderColor: `var(--l-${s.label})` }}>
          <LabelPill label={s.label} short />
          <p className="mt-1.5 text-[0.95rem] leading-relaxed">
            {s.text}
            {s.evidence.map((e) => (
              <sup key={e.id} className="ml-0.5 font-mono text-[0.62rem] text-accent">{index.get(e.id)}</sup>
            ))}
          </p>
        </div>
      ))}
      {r.unanswered && (
        <p className="mt-4 rounded-lg bg-paper-2 px-3 py-2 text-sm text-ink-2">
          <span className="eyebrow mr-2 !text-[0.6rem] text-accent">{r.status === "insufficient_evidence" ? "Not enough evidence" : "Still open"}</span>
          {r.unanswered}
        </p>
      )}
      {all.length > 0 && (
        <ol className="mt-4 space-y-1 border-t border-rule pt-3 text-xs text-ink-2">
          {[...index].map(([id, n]) => (
            <li key={id} className="flex gap-2">
              <span className="font-mono text-accent">{n}</span>
              <span>{all.find((e) => e.id === id)!.text}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
