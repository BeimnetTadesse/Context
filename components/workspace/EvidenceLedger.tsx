import { Dot } from "@/components/ui";
import type { StudyData } from "@/lib/data/study";
import { LABEL_INFO, LABELS } from "@/lib/labels";

/** The chapter's claims by label as one bar, plus whether any are verified and how many were withheld. */
export function EvidenceLedger({ study, bookName, chapter }: { study: StudyData; bookName: string; chapter: number }) {
  if (LABELS.reduce((n, l) => n + study.ledger[l], 0) === 0) return null;
  return (
    <div className="mt-6 max-w-2xl" aria-label="Evidence ledger">
      <div className="flex h-1.5 overflow-hidden rounded-full bg-rule">
        {LABELS.filter((l) => study.ledger[l]).map((l) => (
          <span key={l} style={{ flex: study.ledger[l], background: `var(--l-${l})` }} />
        ))}
      </div>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[0.68rem] uppercase tracking-widest text-muted">
        <span className="text-ink-2">{bookName} {chapter} ·</span>
        {LABELS.filter((l) => study.ledger[l]).map((l) => (
          <span key={l} className="flex items-center gap-1.5"><Dot label={l} size={6} />{study.ledger[l]} {LABEL_INFO[l].short}</span>
        ))}
        {study.claims.every((c) => c.status !== "verified") && <span>· all unverified</span>}
        {study.withheld > 0 && <span title="Claims the second reader judged not supported by their evidence">· {study.withheld} withheld after review</span>}
      </p>
    </div>
  );
}
