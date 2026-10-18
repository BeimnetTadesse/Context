"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { EditorContent, Extension, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";
import { Fragment, Slice } from "@tiptap/pm/model";
import { parseDoc, safeHref, type NoteDoc } from "@/lib/notes/doc";

// The note editor. Only the nodes and marks lib/notes/doc.ts accepts are switched on, so what it saves always passes the server's check.
// Loaded with next/dynamic where it's used: readers who never write a note never download it.

export interface NoteEditorProps {
  initial?: NoteDoc;
  /** Called on every change with the checked document, or null if it can't be saved (e.g. too long). */
  onChange: (doc: NoteDoc | null) => void;
  /** ⌘/Ctrl+Enter. */
  onSubmit?: () => void;
  /** Escape. */
  onCancel?: () => void;
  /** Buttons shown on the right of the formatting bar (Cancel, Save). */
  actions?: ReactNode;
  placeholder?: string;
  autoFocus?: boolean;
  /** "dark" inside the reading popover, "light" on paper (the notebook). */
  tone?: "dark" | "light";
  /** A one-line box (replies): smaller, and the formatting bar only shows while typing. */
  compact?: boolean;
}

const icon = (path: ReactNode) => (
  <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>{path}</svg>
);
const TOOLS = [
  { key: "bold", title: "Bold (⌘B)", body: <span className="font-sans font-bold">B</span>, run: (c: Chain) => c.toggleBold() },
  { key: "italic", title: "Italic (⌘I)", body: <span className="font-serif text-[1.05rem] italic">I</span>, run: (c: Chain) => c.toggleItalic() },
  {
    key: "bulletList", title: "Bulleted list", run: (c: Chain) => c.toggleBulletList(),
    body: icon(<><circle cx="3" cy="4" r=".9" fill="currentColor" /><circle cx="3" cy="8" r=".9" fill="currentColor" /><circle cx="3" cy="12" r=".9" fill="currentColor" /><path d="M6.5 4h7M6.5 8h7M6.5 12h7" /></>),
  },
  {
    key: "orderedList", title: "Numbered list", run: (c: Chain) => c.toggleOrderedList(),
    body: icon(<><path d="M2.5 2.8 3.4 2.3v3.4M2.3 9.2c.3-.6 1.8-.7 1.8.3 0 .8-1.8 1.4-1.8 2.3h1.9" strokeWidth="1.1" /><path d="M6.5 4h7M6.5 8h7M6.5 12h7" /></>),
  },
  { key: "blockquote", title: "Quote", run: (c: Chain) => c.toggleBlockquote(), body: icon(<><path d="M3 3v10" strokeWidth="2" /><path d="M6.5 5h7M6.5 8h7M6.5 11h4.5" /></>) },
] as const;
type Chain = ReturnType<NonNullable<ReturnType<typeof useEditor>>["chain"]>;

export default function NoteEditor({
  initial,
  onChange,
  onSubmit,
  onCancel,
  actions,
  placeholder = "Your note…",
  autoFocus = false,
  tone = "light",
  compact = false,
}: NoteEditorProps) {
  // The keyboard shortcuts are registered once; refs keep them calling the latest handlers.
  const submit = useRef(onSubmit);
  const cancel = useRef(onCancel);
  useEffect(() => {
    submit.current = onSubmit;
    cancel.current = onCancel;
  });

  const editor = useEditor({
    immediatelyRender: false,
    autofocus: autoFocus ? "end" : false,
    content: initial,
    extensions: [
      StarterKit.configure({
        heading: false,
        code: false,
        codeBlock: false,
        strike: false,
        underline: false,
        horizontalRule: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: "https", isAllowedUri: (url) => safeHref(url) !== null },
      }),
      Placeholder.configure({ placeholder }),
      Extension.create({
        name: "noteKeys",
        addKeyboardShortcuts: () => ({
          "Mod-Enter": () => (submit.current?.(), true),
          Escape: () => (cancel.current?.(), !!cancel.current),
        }),
      }),
    ],
    editorProps: {
      attributes: {
        class: compact
          ? "max-h-48 min-h-[2.4rem] overflow-y-auto px-3 py-2 font-serif text-[0.98rem] leading-relaxed"
          : "max-h-64 min-h-[5.5rem] overflow-y-auto px-3.5 py-3 font-serif text-[1.08rem] leading-relaxed",
        "aria-label": placeholder,
      },
      // Paste as plain text: no outside formatting, and nothing the schema would have to reject. One paragraph per line.
      handlePaste: (view, event) => {
        const text = event.clipboardData?.getData("text/plain");
        if (!text) return false;
        const { schema } = view.state;
        const paragraphs = text.split(/\r?\n/).map((line) => schema.nodes.paragraph.create(null, line ? schema.text(line) : null));
        view.dispatch(view.state.tr.replaceSelection(new Slice(Fragment.from(paragraphs), 1, 1)).scrollIntoView());
        return true;
      },
    },
    onUpdate: ({ editor }) => onChange(parseDoc(editor.getJSON())),
  });

  const active = useEditorState({
    editor,
    selector: ({ editor }) => Object.fromEntries(TOOLS.map((t) => [t.key, editor?.isActive(t.key) ?? false])) as Record<string, boolean>,
  });

  const dark = tone === "dark";
  return (
    <div className={`group note-prose overflow-hidden rounded-xl ${dark ? "bg-paper/[0.07] text-paper ring-1 ring-paper/10 focus-within:ring-paper/30" : "border border-rule bg-paper/60 text-ink focus-within:border-ink-2"}`}>
      <EditorContent editor={editor} />
      <div className={`items-center gap-2 border-t px-1.5 py-1.5 ${compact ? "hidden group-focus-within:flex" : "flex"} ${dark ? "border-paper/10" : "border-rule"}`}>
        <div className="flex items-center gap-0.5" role="toolbar" aria-label="Formatting">
          {/* The compact box keeps only B and I; lists and quotes still come from typing "- ", "1. " or "> ". */}
          {TOOLS.filter((t) => !compact || t.key === "bold" || t.key === "italic").map((t) => (
            <button
              key={t.key}
              type="button"
              title={t.title}
              aria-label={t.title}
              aria-pressed={active?.[t.key] ?? false}
              disabled={!editor}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor && t.run(editor.chain().focus()).run()}
              className={`grid h-7 w-7 place-items-center rounded-md text-sm transition ${
                active?.[t.key]
                  ? dark ? "bg-paper/20 text-paper" : "bg-paper-2 text-ink"
                  : dark ? "text-paper/60 hover:bg-paper/10 hover:text-paper" : "text-muted hover:bg-paper-2 hover:text-ink"
              }`}
            >
              {t.body}
            </button>
          ))}
        </div>
        {actions && (
          // Keep the editor focused while pressing these, so a compact box doesn't fold away mid-click.
          <div className="ml-auto flex items-center gap-2" onMouseDown={(e) => e.preventDefault()}>{actions}</div>
        )}
      </div>
    </div>
  );
}
