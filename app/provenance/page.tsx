import type { Metadata } from "next";
import Link from "next/link";
import { Dot } from "@/components/ui";
import { PublicPage } from "@/components/PublicPage";
import { LABEL_INFO, LABELS, type Label } from "@/lib/labels";

export const metadata: Metadata = {
  title: "Provenance · Context",
  description: "Every claim in Context is labelled by where it comes from, and every label shows its evidence.",
};

const RULE: Record<Label, string> = {
  explicit: "Must point to the verse that says it.",
  inference: "Shown as a step beyond the words, never as the words themselves.",
  historical: "Must cite a dictionary, manuscript evidence or an academic source.",
  scholarly: "Phrased as a view, and attributed to who holds it.",
  tradition: "Presented as the church’s reading, not as the text.",
  personal: "Kept for reflection, and never presented as fact.",
};
const EXAMPLE: Record<Label, string> = {
  explicit: "Paul bows his knees to the Father (Ephesians 3:14).",
  inference: "Paul was physically imprisoned (3:1; 4:1; 6:20).",
  historical: "The earliest copies omit “in Ephesus” (1:1).",
  scholarly: "“Powers” includes social and political structures.",
  tradition: "The four dimensions picture the cross.",
  personal: "“I treat some people as outsiders.”",
};

export default function Provenance() {
  return (
    <PublicPage
      current="/provenance"
      eyebrow="Provenance"
      title={<>Every claim is <em className="text-accent">labelled.</em></>}
      intro="Not every statement about a passage carries the same weight. Context marks each one with where it comes from, so you can tell what the text says from what someone says about it."
      next={{ href: "/principles", name: "Principles" }}
    >
      <ul className="divide-y divide-rule border-y border-rule">
        {LABELS.map((l) => (
          <li key={l} className="grid gap-3 py-8 sm:grid-cols-[2rem_15rem_1fr] sm:gap-6">
            <span className="pt-2.5"><Dot label={l} size={12} /></span>
            <div>
              <h2 className="font-serif text-2xl">{LABEL_INFO[l].name}</h2>
              <p className="mt-1 text-ink-2">{LABEL_INFO[l].meaning}</p>
            </div>
            <div className="text-lg leading-relaxed">
              <p>{RULE[l]}</p>
              <p className="mt-2 font-serif italic text-muted">e.g. {EXAMPLE[l]}</p>
            </div>
          </li>
        ))}
      </ul>

      <h2 className="mt-20 font-serif text-[clamp(2rem,3.6vw,3rem)]">Show me why</h2>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-2">Under every claim is a link that opens its chain of evidence:</p>
      <ol className="mt-8 grid gap-4 sm:grid-cols-4">
        {[
          ["The claim", "and its label"],
          ["The evidence", "the exact verse, word or quote it rests on"],
          ["The source", "with its tier and licence"],
          ["How it was made", "who or what drafted it, and how it was checked"],
        ].map(([t, d], i) => (
          <li key={t} className="rounded-2xl border border-rule bg-card p-5">
            <p className="font-mono text-sm text-accent">{i + 1}</p>
            <p className="mt-2 font-serif text-xl">{t}</p>
            <p className="mt-1 text-ink-2">{d}</p>
          </li>
        ))}
      </ol>

      <h2 className="mt-20 font-serif text-[clamp(2rem,3.6vw,3rem)]">Unverified until a person checks</h2>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-2">
        Claims drafted with the help of AI start as <em>unverified</em>. They have already been checked by code and by a
        second reviewer, but they stay marked that way until a person reads the sources and confirms them. Sources are
        ranked in tiers, from the Bible text itself to general reference works, and listed in the{" "}
        <Link href="/sources" className="underline underline-offset-4 hover:text-accent">source library</Link>.
      </p>
    </PublicPage>
  );
}
