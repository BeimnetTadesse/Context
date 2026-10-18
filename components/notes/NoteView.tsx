import type { ReactNode } from "react";
import type { Block, Inline, NoteDoc } from "@/lib/notes/doc";

// A saved note, read-only. Plain React elements (no editor, no HTML strings), so it costs nothing on pages that only show notes.

function inline(n: Inline, key: number): ReactNode {
  if (n.type === "hardBreak") return <br key={key} />;
  let out: ReactNode = n.text;
  for (const m of n.marks ?? []) {
    if (m.type === "bold") out = <strong>{out}</strong>;
    else if (m.type === "italic") out = <em>{out}</em>;
    else
      out = m.attrs.href.startsWith("/") ? (
        <a href={m.attrs.href}>{out}</a>
      ) : (
        <a href={m.attrs.href} target="_blank" rel="noopener noreferrer nofollow">{out}</a>
      );
  }
  return <span key={key}>{out}</span>;
}

function block(b: Block, key: number): ReactNode {
  switch (b.type) {
    case "paragraph":
      return <p key={key}>{b.content?.map(inline)}</p>;
    case "blockquote":
      return <blockquote key={key}>{b.content.map(block)}</blockquote>;
    case "bulletList":
      return <ul key={key}>{b.content.map((li, i) => <li key={i}>{li.content.map(block)}</li>)}</ul>;
    case "orderedList":
      return <ol key={key} start={b.attrs?.start}>{b.content.map((li, i) => <li key={i}>{li.content.map(block)}</li>)}</ol>;
  }
}

export function NoteView({ doc, className = "" }: { doc: NoteDoc; className?: string }) {
  return <div className={`note-prose ${className}`}>{doc.content.map(block)}</div>;
}
