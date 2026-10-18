"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { postJson } from "@/components/study/context";
import { docToText, isEmptyDoc, quotedPhrase, textToDoc, type NoteDoc } from "@/lib/notes/doc";
import { isVersion, versionInfo } from "@/lib/versions";
import { NoteView } from "./NoteView";
import type { NoteReply, VerseNote } from "./VerseNotes";

const NoteEditor = dynamic(() => import("./NoteEditor"), {
  ssr: false,
  loading: () => <div className="h-[2.6rem] rounded-xl border border-rule bg-paper/60" />,
});

const GAP = 12;

/** Where a note belongs in the text: its marked words (in the version it was written on, if that's open), else its verse. */
function anchorOf(text: HTMLElement, n: VerseNote): HTMLElement | null {
  const verse = text.querySelector<HTMLElement>(`#v${n.verse}`);
  const phrase = quotedPhrase(n.doc, n.body);
  const marked = phrase ? [...(verse?.querySelectorAll<HTMLElement>("[data-noted]") ?? [])].filter((el) => el.dataset.noted === phrase) : [];
  const own = n.version ? marked.find((el) => el.closest<HTMLElement>("[data-version]")?.dataset.version === n.version) : undefined;
  return own ?? marked[0] ?? verse;
}

/** "KJV", "አማርኛ"…: a version's short name, for the card. */
export const versionLabel = (code: string | null) => (code && isVersion(code) ? versionInfo(code).short : null);

/** "just now", "5m", "3h", "2d", then a date. */
export function ago(iso: string, now = Date.now()) {
  const s = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d`;
  return new Date(iso).toLocaleDateString("en", { month: "short", day: "numeric" });
}

// The card shows the quoted words once, above the thread, so the note's own text leaves them out; saving puts them back.
function withoutQuote(doc: NoteDoc): NoteDoc {
  const [first, ...rest] = doc.content;
  return first?.type === "blockquote" && rest.length ? { type: "doc", content: rest } : doc;
}
function restoreQuote(original: NoteDoc | null, edited: NoteDoc): NoteDoc {
  const first = original?.content[0];
  return first?.type === "blockquote" && original!.content.length > 1 ? { type: "doc", content: [first, ...edited.content] } : edited;
}
/** What an old plain note says after its “quote” — prefix. */
const plainText = (n: { body: string }) => n.body.replace(/^“[\s\S]+?” — /, "");

/**
 * Notes beside the text, like comments in a document. Each card sits level with the words it's about; cards that
 * would overlap are pushed apart, and the open card lines up exactly while the others make room. An open card shows
 * the whole thread: the note, the reader's replies, and a box to reply.
 */
export function NotesRail({
  notes,
  passage,
  textRef,
  active,
  onActivate,
  onChange,
  onDeleted,
}: {
  notes: VerseNote[];
  /** "Matthew 2": each card names its verse. */
  passage: string;
  textRef: React.RefObject<HTMLElement | null>;
  active: number | null;
  onActivate: (id: number | null) => void;
  /** A note or its replies changed (edit, reply, deleted reply). */
  onChange: (note: VerseNote) => void;
  onDeleted: (id: number) => void;
}) {
  const rail = useRef<HTMLDivElement>(null);
  const cards = useRef(new Map<number, HTMLDivElement>());
  const [tops, setTops] = useState<Record<number, number>>({});
  const [height, setHeight] = useState(0);
  // Cards appear once the fonts have loaded (they change where every line falls); after that, moves are animated.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    (document.fonts?.ready ?? Promise.resolve()).then(() => requestAnimationFrame(() => requestAnimationFrame(() => live && setReady(true))));
    return () => {
      live = false;
    };
  }, []);

  const layout = useCallback(() => {
    const text = textRef.current;
    const box = rail.current?.getBoundingClientRect();
    if (!text || !box) return;
    const items = notes
      .map((n) => {
        const a = anchorOf(text, n);
        return { id: n.id, want: a ? a.getBoundingClientRect().top - box.top - 6 : 0, h: cards.current.get(n.id)?.offsetHeight ?? 0 };
      })
      .sort((a, b) => a.want - b.want || a.id - b.id);
    const pos = items.map((i) => i.want);
    const at = items.findIndex((i) => i.id === active);
    const start = Math.max(at, 0);
    if (at < 0 && items.length) pos[0] = Math.max(0, items[0].want);
    // Below the open card (or from the top): push down past the card above.
    for (let i = start + 1; i < items.length; i++) pos[i] = Math.max(items[i].want, pos[i - 1] + items[i - 1].h + GAP);
    // Above the open card: move up out of its way.
    for (let i = start - 1; i >= 0; i--) pos[i] = Math.min(items[i].want, pos[i + 1] - items[i].h - GAP);
    const next: Record<number, number> = {};
    items.forEach((it, i) => (next[it.id] = pos[i]));
    setTops(next);
    setHeight(items.length ? Math.max(...items.map((it, i) => pos[i] + it.h)) : 0);
  }, [notes, active, textRef]);

  // Re-place cards whenever anything moves the text (versions, toolbars wrapping, fonts, window size) or a card
  // changes size (opening, editing). Batched to one layout per frame.
  useLayoutEffect(() => {
    layout();
    let frame = 0;
    const soon = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(layout);
    };
    const ro = new ResizeObserver(soon);
    ro.observe(document.documentElement);
    if (textRef.current) ro.observe(textRef.current);
    for (const el of cards.current.values()) ro.observe(el);
    document.fonts?.ready.then(soon);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, [layout, textRef]);

  // Emphasise the open note's words in the text, in every version that shows them.
  useEffect(() => {
    const n = notes.find((x) => x.id === active);
    const phrase = n && quotedPhrase(n.doc, n.body);
    const verse = n && textRef.current?.querySelector(`#v${n.verse}`);
    if (!phrase || !verse) return;
    const els = [...verse.querySelectorAll<HTMLElement>("[data-noted]")].filter((el) => el.dataset.noted === phrase);
    els.forEach((el) => el.classList.add("note-active"));
    return () => els.forEach((el) => el.classList.remove("note-active"));
  }, [active, notes, textRef]);

  // Escape closes the open card (unless an editor inside it handles Escape first).
  useEffect(() => {
    if (active === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !(e.target as HTMLElement).closest?.(".ProseMirror")) onActivate(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [active, onActivate]);

  return (
    <div ref={rail} className="relative" style={{ minHeight: height }}>
      {notes.map((n) => (
        <div
          key={n.id}
          ref={(el) => {
            if (el) cards.current.set(n.id, el);
            else cards.current.delete(n.id);
          }}
          className={`absolute inset-x-0 ${ready ? "transition-[top,opacity] duration-200 ease-out" : ""}`}
          style={{ top: tops[n.id] ?? 0, opacity: ready && n.id in tops ? 1 : 0 }}
        >
          <Thread note={n} reference={`${passage}:${n.verse}`} version={versionLabel(n.version)} open={n.id === active} onOpen={() => onActivate(n.id)} onClose={() => onActivate(null)} onChange={onChange} onDeleted={() => onDeleted(n.id)} />
        </div>
      ))}
    </div>
  );
}

function Thread({
  note,
  reference,
  version,
  open,
  onOpen,
  onClose,
  onChange,
  onDeleted,
}: {
  note: VerseNote;
  reference: string;
  version: string | null;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onChange: (note: VerseNote) => void;
  onDeleted: () => void;
}) {
  const phrase = quotedPhrase(note.doc, note.body);
  const replies = note.replies;

  if (!open)
    return (
      <button
        type="button"
        onClick={onOpen}
        className="block w-full rounded-xl border border-transparent px-3.5 py-3 text-left transition hover:border-rule hover:bg-card"
      >
        <ThreadHead reference={reference} version={version} count={1 + replies.length} at={note.createdAt} />
        <div className="relative mt-1 max-h-[4.75rem] overflow-hidden">
          {note.doc ? (
            <NoteView doc={withoutQuote(note.doc)} className="font-serif text-[0.97rem] leading-relaxed text-ink-2" />
          ) : (
            <p className="whitespace-pre-wrap font-serif text-[0.97rem] leading-relaxed text-ink-2">{plainText(note)}</p>
          )}
        </div>
      </button>
    );

  return (
    <div className="rounded-xl border border-rule bg-card shadow-[0_16px_40px_-20px_rgb(31_27_23/0.45)]">
      <div className="px-3.5 pt-3">
        <ThreadHead reference={reference} version={version} count={1 + replies.length}>
          <button type="button" onClick={onClose} aria-label="Close" title="Close (Esc)" className="-mr-1 grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted hover:bg-paper-2 hover:text-ink">
            <svg viewBox="0 0 12 12" width="11" height="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden><path d="M2.5 2.5l7 7M9.5 2.5l-7 7" /></svg>
          </button>
        </ThreadHead>
        {phrase && (
          <p className="mt-2 line-clamp-2 border-l-2 border-[var(--l-personal)]/60 pl-2.5 font-serif text-[0.9rem] italic leading-snug text-muted">{phrase}</p>
        )}
      </div>

      <div className="divide-y divide-rule/70">
        <Entry
          id={note.id}
          doc={note.doc ? withoutQuote(note.doc) : null}
          body={note.doc ? note.body : plainText(note)}
          at={note.createdAt}
         
          deleteLabel={replies.length ? "Delete this note and its replies?" : "Delete this note?"}
          onSaved={(doc) => onChange({ ...note, doc: restoreQuote(note.doc, doc), body: docToText(restoreQuote(note.doc, doc)) })}
          onDeleted={onDeleted}
        />
        {replies.map((r) => (
          <Entry
            key={r.id}
            id={r.id}
            doc={r.doc}
            body={r.body}
            at={r.createdAt}
           
            deleteLabel="Delete this reply?"
            onSaved={(doc) => onChange({ ...note, replies: replies.map((x) => (x.id === r.id ? { ...x, doc, body: docToText(doc) } : x)) })}
            onDeleted={() => onChange({ ...note, replies: replies.filter((x) => x.id !== r.id) })}
          />
        ))}
      </div>

      <ReplyBox noteId={note.id} onReplied={(r) => onChange({ ...note, replies: [...replies, r] })} />
    </div>
  );
}

/** A thread's verse (e.g. "Matthew 2:5") and how many notes it holds; closed cards also say when it was started. */
function ThreadHead({ reference, version, count, at, children }: { reference: string; version: string | null; count: number; at?: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-[0.7rem] font-medium uppercase tracking-wider text-accent">{reference}</span>
      {version && (
        <span title="The version this note was written on" className="rounded border border-rule px-1 font-mono text-[0.6rem] uppercase leading-4 tracking-wider text-ink-2">
          {version}
        </span>
      )}
      {at && (
        <time dateTime={at} title={new Date(at).toLocaleString()} className="font-mono text-[0.68rem] uppercase tracking-wider text-muted" suppressHydrationWarning>
          · {ago(at)}
        </time>
      )}
      <span
        className="ml-auto inline-flex items-center gap-1 rounded-full bg-paper-2 px-2 py-0.5 font-mono text-[0.68rem] text-ink-2"
        title={count === 1 ? "1 note" : `${count} notes in this thread`}
        aria-label={count === 1 ? "1 note" : `${count} notes`}
      >
        <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" aria-hidden>
          <path d="M2 2.5h8v5.5H5.5L3 10V8H2z" />
        </svg>
        {count}
      </span>
      {children}
    </div>
  );
}

/** When it was written (and, on hover, its actions). Notes are private, so there's no author to show. */
function Byline({ at, children }: { at: string; children?: React.ReactNode }) {
  return (
    <div className="flex h-6 items-center gap-2">
      <time dateTime={at} title={new Date(at).toLocaleString()} className="font-mono text-[0.68rem] uppercase tracking-wider text-muted" suppressHydrationWarning>
        {ago(at)}
      </time>
      {children}
    </div>
  );
}

/** One message in a thread (the note, or a reply): its text, with Edit and Delete on hover. */
function Entry({
  id,
  doc,
  body,
  at,
  deleteLabel,
  onSaved,
  onDeleted,
}: {
  id: number;
  doc: NoteDoc | null;
  body: string;
  at: string;
  deleteLabel: string;
  onSaved: (doc: NoteDoc) => void;
  onDeleted: () => void;
}) {
  const [mode, setMode] = useState<"view" | "edit" | "delete">("view");
  const [draft, setDraft] = useState<NoteDoc | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const current = doc ?? textToDoc(body);

  const save = async () => {
    if (!draft || isEmptyDoc(draft) || busy) return;
    setBusy(true);
    setError(false);
    try {
      await postJson("/api/notes", { id, doc: draft }, "PATCH");
      onSaved(draft);
      setMode("view");
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    setBusy(true);
    try {
      await postJson("/api/notes", { id }, "DELETE");
      onDeleted();
    } catch {
      setError(true);
      setBusy(false);
    }
  };

  return (
    <div className="group/entry px-3.5 py-3">
      <Byline at={at}>
        {mode === "view" && (
          <span className="ml-auto flex gap-0.5 opacity-0 transition group-hover/entry:opacity-100 group-focus-within/entry:opacity-100">
            <IconButton title="Edit" onClick={() => { setDraft(current); setMode("edit"); }}>
              <path d="M8.2 1.6 10.4 3.8 4.3 9.9 1.6 10.4 2.1 7.7z" />
            </IconButton>
            <IconButton title="Delete" onClick={() => setMode("delete")}>
              <path d="M2 3.5h8M4.5 3.5V2.2h3v1.3M3.2 3.5l.5 6.3h4.6l.5-6.3" />
            </IconButton>
          </span>
        )}
      </Byline>

      <div className="mt-0.5">
        {mode === "edit" ? (
          <>
            <NoteEditor
              initial={current}
              compact
              autoFocus
              onChange={setDraft}
              onSubmit={save}
              onCancel={() => setMode("view")}
              actions={
                <>
                  <button type="button" onClick={() => setMode("view")} className="px-1 text-xs text-muted hover:text-ink">Cancel</button>
                  <button type="button" onClick={save} disabled={busy || !draft || isEmptyDoc(draft)} className="rounded-md bg-ink px-2.5 py-1 text-xs text-paper disabled:opacity-40">
                    {busy ? "Saving…" : "Save"}
                  </button>
                </>
              }
            />
            {error && <p className="mt-1 text-xs text-accent">Couldn’t save. Please try again.</p>}
          </>
        ) : (
          <>
            {doc ? <NoteView doc={doc} className="font-serif text-[0.97rem] leading-relaxed text-ink" /> : <p className="whitespace-pre-wrap font-serif text-[0.97rem] leading-relaxed text-ink">{body}</p>}
            {mode === "delete" && (
              <div className="mt-2 flex items-center gap-3 rounded-lg bg-paper-2 px-2.5 py-1.5 text-xs">
                <span className="text-ink-2">{deleteLabel}</span>
                <button type="button" onClick={remove} disabled={busy} className="ml-auto font-medium text-accent hover:underline">{busy ? "Deleting…" : "Delete"}</button>
                <button type="button" onClick={() => setMode("view")} className="text-muted hover:text-ink">Cancel</button>
              </div>
            )}
            {error && mode !== "delete" && <p className="mt-1 text-xs text-accent">Something went wrong. Please try again.</p>}
          </>
        )}
      </div>
    </div>
  );
}

function IconButton({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" title={title} aria-label={title} onClick={onClick} className="grid h-6 w-6 place-items-center rounded-md text-muted hover:bg-paper-2 hover:text-ink">
      <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" aria-hidden>
        {children}
      </svg>
    </button>
  );
}

/** "Reply…": a one-line box that grows while typing; ⌘↵ or the arrow sends. */
function ReplyBox({ noteId, onReplied }: { noteId: number; onReplied: (r: NoteReply) => void }) {
  const [draft, setDraft] = useState<NoteDoc | null>(null);
  const [round, setRound] = useState(0); // a fresh, empty box after each reply
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const ready = !!draft && !isEmptyDoc(draft) && !busy;

  const send = async () => {
    if (!ready) return;
    setBusy(true);
    setError(false);
    try {
      const r = await postJson<{ id: number; createdAt: string }>("/api/notes", { parentId: noteId, doc: draft });
      onReplied({ id: r.id, doc: draft, body: docToText(draft), createdAt: r.createdAt });
      setDraft(null);
      setRound((n) => n + 1);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-t border-rule/70 px-3.5 py-3">
      <div>
        <div className="min-w-0">
          <NoteEditor
            key={round}
            compact
            placeholder="Reply…"
            onChange={(d) => { setDraft(d); setError(false); }}
            onSubmit={send}
            actions={
              <button type="button" onClick={send} disabled={!ready} aria-label="Send reply" title="Send (⌘↵)"
                className="grid h-6 w-6 place-items-center rounded-full bg-ink text-paper transition disabled:bg-rule disabled:text-muted">
                <svg viewBox="0 0 12 12" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M6 10V2.5M2.8 5.5 6 2.3l3.2 3.2" />
                </svg>
              </button>
            }
          />
          {error && <p className="mt-1 text-xs text-accent">Couldn’t send. Please try again.</p>}
        </div>
      </div>
    </div>
  );
}
