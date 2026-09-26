"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useStudy } from "./context";

const STAGES = [
  "Gathering the verses and the Greek text…",
  "Reading the lexicon entries for the key words…",
  "Weighing the strongest cross-references…",
  "Drafting claims — every one must cite its evidence…",
  "Checking each citation against the evidence pack…",
];

/** Shown on steps whose content comes from the chapter study when it hasn't been prepared yet. */
export function PrepareStudy({ what }: { what: string }) {
  const { book, chapter, study } = useStudy();
  const router = useRouter();
  const [state, setState] = useState<"idle" | "working" | "error">(study.status === "pending" ? "working" : "idle");
  const [error, setError] = useState<string | null>(study.status === "failed" ? study.error : null);
  const [stage, setStage] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
  }, []);

  const start = async () => {
    setState("working");
    setError(null);
    setStage(0);
    timer.current = setInterval(() => setStage((s) => Math.min(s + 1, STAGES.length - 1)), 18000);
    try {
      for (;;) {
        const r = await fetch(`/api/study/${book.slug}/${chapter}`, { method: "POST" });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.message ?? "Preparation failed.");
        if (data.status === "ready") break;
        await new Promise((res) => setTimeout(res, 6000)); // someone else is preparing it — wait
      }
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setState("error");
    } finally {
      if (timer.current) clearInterval(timer.current);
    }
  };

  return (
    <div className="mt-8 rounded-2xl border border-dashed border-rule bg-card/60 p-7">
      <p className="eyebrow mb-3 text-accent">Not yet prepared</p>
      <p className="max-w-2xl leading-relaxed text-ink-2">
        The {what} for {book.name} {chapter} hasn’t been prepared yet. Context’s research assistant can draft it from the
        verses, the Greek lexicon and the cross-references — every claim labelled and cited, and marked{" "}
        <em>unverified</em> until a person checks it.
      </p>
      {state === "working" ? (
        <div className="mt-5 flex items-center gap-3 text-ink-2" role="status">
          <span className="h-3 w-3 animate-pulse rounded-full bg-accent" />
          {STAGES[stage]} <span className="text-sm text-muted">(usually 1–3 minutes)</span>
        </div>
      ) : (
        <button onClick={start} className="mt-5 rounded-xl bg-ink px-5 py-3 text-paper hover:bg-ink-2">
          Prepare this chapter’s study
        </button>
      )}
      {error && <p className="mt-4 max-w-2xl text-sm text-accent">{error}</p>}
    </div>
  );
}
