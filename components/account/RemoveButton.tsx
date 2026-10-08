"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { postJson } from "@/components/study/context";

type Target = { note: number } | { highlight: { book: string; chapter: number; verse: number } };

/** Remove one note or one highlight from the notebook. */
export function RemoveButton({ target, label = "Remove" }: { target: Target; label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const remove = async () => {
    setBusy(true);
    try {
      if ("note" in target) await postJson("/api/notes", { id: target.note }, "DELETE");
      else await postJson("/api/highlights", { ...target.highlight, verses: [target.highlight.verse], color: null });
      router.refresh();
    } finally {
      setBusy(false);
    }
  };
  return (
    <button type="button" onClick={remove} disabled={busy} className="text-xs text-muted underline-offset-2 hover:text-accent hover:underline disabled:opacity-50">
      {busy ? "Removing…" : label}
    </button>
  );
}
