"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LabelPill } from "@/components/ui";
import type { ClaimView } from "@/lib/data/study";
import { LABEL_INFO } from "@/lib/labels";
import { postJson, useStudy } from "./context";

const TIER_NAME: Record<number, string> = {
  1: "Primary text",
  2: "Ancient witness",
  3: "Academic",
  4: "Translation / study data",
  5: "Theological",
  6: "Educational",
};

export function StatusMark({ status, origin }: { status: ClaimView["status"]; origin: ClaimView["origin"] }) {
  if (status === "verified")
    return <span className="font-mono text-[0.65rem] uppercase tracking-widest text-[var(--l-explicit)]">✓ Verified</span>;
  return (
    <span className="font-mono text-[0.65rem] uppercase tracking-widest text-muted" title="Drafted by the research assistant from cited evidence; not yet checked by a person">
      {origin === "ai_draft" ? "Unverified draft" : "Unverified"}
    </span>
  );
}

function highlight(text: string, quote: string | null) {
  if (!quote) return text;
  const i = text.toLowerCase().indexOf(quote.toLowerCase());
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded-sm bg-[var(--l-explicit-bg)] text-ink">{text.slice(i, i + quote.length)}</mark>
      {text.slice(i + quote.length)}
    </>
  );
}

/** "Show me why": claim → evidence → source → what kind of statement → how it was produced. */
export function WhyDrawer({ claim }: { claim: ClaimView }) {
  const { book, chapter, curator } = useStudy();
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);

  const verify = async () => {
    setMsg(null);
    try {
      await postJson(`/api/claims/${claim.id}/verify`, {});
      router.refresh();
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  return (
    <div className="mt-3 space-y-4 rounded-xl bg-paper-2 p-5 text-[0.92rem]">
      <div>
        <p className="eyebrow mb-1 !text-[0.62rem] text-muted">Claim</p>
        <p className="text-ink-2">
          {LABEL_INFO[claim.label].name} — {LABEL_INFO[claim.label].meaning}
        </p>
      </div>

      {claim.anchors.length > 0 && (
        <div>
          <p className="eyebrow mb-2 !text-[0.62rem] text-muted">Evidence</p>
          <ul className="space-y-2">
            {claim.anchors.map((a) => (
              <li key={a.ord} className="flex gap-4">
                <span className="w-10 shrink-0 font-mono text-xs text-accent">
                  {chapter}:{a.verse}
                </span>
                <span className="font-serif text-[1.02rem] italic leading-snug">“{highlight(a.text, a.quote)}”</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <p className="eyebrow mb-2 !text-[0.62rem] text-muted">Sources</p>
        <ul className="space-y-2">
          {claim.citations.map((c, i) => (
            <li key={i} className="flex flex-wrap items-baseline gap-x-3">
              <span className="rounded border border-rule bg-card px-1.5 font-mono text-xs">[{c.key}]</span>
              <span className="font-serif">{c.title}</span>
              <span className="text-xs text-muted">
                {TIER_NAME[c.tier]}
                {c.orientation ? ` · ${c.orientation}` : ""}
                {c.locator ? ` · ${c.locator}` : ""}
              </span>
              {c.url && (
                <a href={c.url} target="_blank" rel="noreferrer" className="text-xs text-accent underline underline-offset-2">
                  open
                </a>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="border-t border-rule pt-3 text-[0.85rem] text-ink-2">
        <p className="eyebrow mb-1 !text-[0.62rem] text-muted">How this was produced</p>
        {claim.status === "verified"
          ? "Checked by a person against the sources above."
          : claim.origin === "ai_draft"
            ? `Drafted by Context’s research assistant from the evidence above for ${book.name} ${chapter}. Every citation was checked to exist in that evidence, but no person has verified the reasoning yet.`
            : "Computed directly from the source data."}
      </div>

      {curator && claim.status !== "verified" && (
        <div>
          <button onClick={verify} className="rounded-lg border border-ink px-3 py-1.5 text-sm hover:bg-ink hover:text-paper">
            I checked the sources — verify
          </button>
          {msg && <p className="mt-2 text-sm text-accent">{msg.replace(/^.*?claim \d+ /, "Can’t verify: ")}</p>}
        </div>
      )}
    </div>
  );
}

export function ClaimCard({ claim, compact = false }: { claim: ClaimView; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={compact ? "py-3" : "border-b border-rule py-6"}>
      <div className="flex flex-wrap items-center gap-3">
        <LabelPill label={claim.label} />
        <StatusMark status={claim.status} origin={claim.origin} />
      </div>
      <p className={`mt-3 font-serif leading-snug ${compact ? "text-[1.08rem]" : "text-[1.25rem]"}`}>{claim.statement}</p>
      <button onClick={() => setOpen(!open)} className="mt-2 text-sm text-accent hover:underline" aria-expanded={open}>
        {open ? "⌄ Hide why" : "› Show me why"}
      </button>
      {open && <WhyDrawer claim={claim} />}
    </div>
  );
}
