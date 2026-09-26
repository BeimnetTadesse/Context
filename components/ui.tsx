import Link from "next/link";
import { LABEL_INFO, LABELS, labelBg, labelColor, type Label } from "@/lib/labels";

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`font-serif text-[1.9rem] leading-none tracking-tight text-ink ${className}`}>
      Context<sup className="ml-0.5 align-super font-sans text-[0.6rem] text-accent">1</sup>
    </Link>
  );
}

export function Dot({ label, size = 8 }: { label: Label; size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-block shrink-0 rounded-full"
      style={{ width: size, height: size, background: labelColor(label) }}
    />
  );
}

/** "● EXPLICIT IN THE TEXT" chip. The text label is always present — colour is never the only signal. */
export function LabelPill({ label, short = false }: { label: Label; short?: boolean }) {
  return (
    <span
      className="eyebrow inline-flex items-center gap-2 rounded-full px-3 py-1 !text-[0.66rem]"
      style={{ background: labelBg(label), color: `color-mix(in oklab, ${labelColor(label)} 70%, black)` }}
    >
      <Dot label={label} size={7} />
      {short ? LABEL_INFO[label].short : LABEL_INFO[label].name}
    </span>
  );
}

export function ProvenanceKey() {
  return (
    <div className="rounded-2xl bg-paper-2 p-5">
      <p className="eyebrow mb-3 text-muted">Provenance key</p>
      <ul className="space-y-2 text-[0.95rem] text-ink-2">
        {LABELS.map((l) => (
          <li key={l} className="flex items-center gap-3">
            <Dot label={l} />
            {LABEL_INFO[l].name}
          </li>
        ))}
      </ul>
    </div>
  );
}
