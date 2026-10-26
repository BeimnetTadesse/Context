"use client";

import { useEffect, useRef } from "react";
import { ClaimCard } from "@/components/study/Claim";
import { Dot } from "@/components/ui";
import type { ClaimView } from "@/lib/data/study";
import { LABEL_INFO, LABELS } from "@/lib/labels";

/** One study note, opened like a footnote right below the phrase it's about. Closes on Escape or a click outside. */
export function StudyNotePopover({ claim, letter, top, left, onClose }: {
  claim: ClaimView; letter: string; top: number; left: number; onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!ref.current?.contains(t) && !t.closest("[data-study-letter]")) onClose();
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="dialog"
      aria-label={`Study note ${letter}`}
      style={{ top, left }}
      className="absolute z-30 w-[min(26rem,100%)] rounded-2xl border border-rule bg-card px-5 pb-2 pt-4 shadow-[0_24px_60px_-28px_rgba(40,30,20,0.45)] outline-none"
    >
      <div className="flex items-center justify-between">
        <p className="eyebrow !text-[0.62rem] text-muted">Study note <span className="text-accent">{letter}</span> · {claim.anchors[0]?.verse ? `verse ${claim.anchors[0].verse}` : ""}</p>
        <button onClick={onClose} className="text-sm text-muted hover:text-ink" aria-label="Close study note">✕</button>
      </div>
      <ClaimCard claim={claim} compact />
    </div>
  );
}

/** What the underline colours mean, shown under the Study notes switch while it's on. */
export function StudyNotesKey() {
  return (
    <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.8rem] text-muted">
      <span>Underlines show what kind of note it is:</span>
      {LABELS.map((l) => (
        <span key={l} className="inline-flex items-center gap-1.5"><Dot label={l} size={7} />{LABEL_INFO[l].short}</span>
      ))}
      <span>· click one to read it</span>
    </p>
  );
}
