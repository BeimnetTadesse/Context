"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { postJson } from "@/components/study/context";
import { isEmptyDoc, textToDoc, type NoteDoc } from "@/lib/notes/doc";
import { NoteView } from "./NoteView";

const NoteEditor = dynamic(() => import("./NoteEditor"), {
  ssr: false,
  loading: () => <div className="h-[8.5rem] rounded-xl border border-rule bg-card" />,
});

/**
 * A saved note with Edit to change it in place (the notebook, and the notes beside the text). Old plain-text notes open
 * as one paragraph per line. onSaved lets a page update its own copy; without it the page's data is refreshed.
 */
export function EditableNote({
  id,
  doc,
  body,
  onSaved,
  textClass = "text-[1.15rem]",
  extraActions,
}: {
  id: number;
  doc: NoteDoc | null;
  body: string;
  onSaved?: (doc: NoteDoc) => void;
  textClass?: string;
  /** More links beside Edit (e.g. Delete). */
  extraActions?: React.ReactNode;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<NoteDoc | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const shown = doc ?? textToDoc(body);

  if (!editing)
    return (
      <div className="mt-2">
        {doc ? (
          <NoteView doc={doc} className={`font-serif leading-relaxed ${textClass}`} />
        ) : (
          <p className={`whitespace-pre-wrap font-serif leading-relaxed ${textClass}`}>{body}</p>
        )}
        <div className="mt-1 flex gap-4">
          <button type="button" onClick={() => { setDraft(shown); setEditing(true); }} className="text-xs text-muted underline-offset-2 hover:text-accent hover:underline">
          Edit
        </button>
          {extraActions}
        </div>
      </div>
    );

  const save = async () => {
    if (!draft || isEmptyDoc(draft)) return;
    setBusy(true);
    setError(false);
    try {
      await postJson("/api/notes", { id, doc: draft }, "PATCH");
      setEditing(false);
      if (onSaved) onSaved(draft);
      else router.refresh();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2 space-y-2">
      <NoteEditor
        initial={shown}
        onChange={setDraft}
        onSubmit={save}
        onCancel={() => setEditing(false)}
        autoFocus
        actions={
          <>
            <button type="button" onClick={() => setEditing(false)} className="px-1 text-sm text-muted hover:text-ink">Cancel</button>
            <button type="button" onClick={save} disabled={busy || !draft || isEmptyDoc(draft)} className="rounded-lg bg-ink px-3 py-1 text-sm text-paper disabled:opacity-40">
              {busy ? "Saving…" : "Save"}
            </button>
          </>
        }
      />
      <p className="text-xs text-muted">
        {error ? <span className="text-accent">Couldn’t save. Please try again.</span> : !draft ? <span className="text-accent">This note is too long to save.</span> : "⌘↵ to save · Esc to cancel"}
      </p>
    </div>
  );
}
