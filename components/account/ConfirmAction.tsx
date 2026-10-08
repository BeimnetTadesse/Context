"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

/** A destructive action behind an "Are you sure?" step. */
export function ConfirmAction({ action, label, question, disabled = false }: { action: () => Promise<void>; label: string; question: string; disabled?: boolean }) {
  const [asking, setAsking] = useState(false);
  if (!asking)
    return (
      <button type="button" disabled={disabled} onClick={() => setAsking(true)}
        className="rounded-xl border border-rule bg-card px-4 py-2 text-sm text-ink-2 hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40">
        {label}
      </button>
    );
  return (
    <form action={async () => { await action(); setAsking(false); }} className="flex flex-wrap items-center gap-2 rounded-xl bg-[var(--l-tradition-bg)] px-3 py-2">
      <span className="text-sm text-ink">{question}</span>
      <Submit>Yes, delete</Submit>
      <button type="button" onClick={() => setAsking(false)} className="rounded-lg px-3 py-1.5 text-sm text-ink-2 hover:bg-paper">Cancel</button>
    </form>
  );
}

function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="rounded-lg bg-accent px-3 py-1.5 text-sm text-paper disabled:opacity-60">
      {pending ? "Deleting…" : children}
    </button>
  );
}
