import type { Metadata } from "next";
import { PublicPage } from "@/components/PublicPage";
import { STEPS, type StepKey } from "@/lib/steps";

export const metadata: Metadata = {
  title: "Method · Context",
  description: "Seven steps, in order: read, observe, context, language, connections, interpretations, reflect.",
};

const DETAIL: Record<StepKey, { what: string; get: string }> = {
  read: {
    what: "Read the whole chapter before anything else, slowly and without commentary.",
    get: "Twelve versions to read and compare, including English and Amharic side by side, and the Greek word by word.",
  },
  observe: {
    what: "Look only at what is on the page: how the chapter is built, what repeats, who speaks, where it turns.",
    get: "The chapter’s sections, observations tied to verses, and repeated words counted from the text itself.",
  },
  context: {
    what: "Ask who wrote it, to whom, when and why, and where this chapter sits in the whole book.",
    get: "An overview of the book, background drawn from encyclopedias and commentaries, each point labelled and sourced.",
  },
  language: {
    what: "Slow down on the few words that carry the chapter.",
    get: "The Greek behind them, their dictionary range, and how often they appear, with a reminder that context decides the sense.",
  },
  connections: {
    what: "See where else Scripture says something similar, and how the connection works.",
    get: "Cross-references grouped by kind, from shared wording to Old Testament background.",
  },
  interpretations: {
    what: "Only now, ask the questions the chapter leaves open.",
    get: "The main credible views side by side, with who holds them and why, and how the early church read each verse.",
  },
  reflect: {
    what: "Last of all: what does this passage raise for you?",
    get: "Questions to reflect on, and a space to separate what the text says from what you bring to it.",
  },
};

export default function Method() {
  return (
    <PublicPage
      current="/method"
      eyebrow="Method"
      title={<>Seven steps, <em className="text-accent">in order.</em></>}
      intro="Most of us open a passage and ask what it means for us. Context asks that too, but last. First you read, look, and learn the setting and the words, so that interpretation rests on the text and not the other way round."
      next={{ href: "/provenance", name: "Provenance" }}
    >
      <ol className="divide-y divide-rule border-y border-ink">
        {STEPS.map((s) => (
          <li key={s.key} className="grid gap-4 py-9 sm:grid-cols-[5rem_14rem_1fr] sm:gap-8">
            <span className="font-mono text-sm text-accent">{s.numeral}</span>
            <div>
              <h2 className="font-serif text-3xl">{s.name}</h2>
              <p className="mt-1 italic text-ink-2">{s.tagline}</p>
            </div>
            <div className="space-y-3 text-lg leading-relaxed">
              <p>{DETAIL[s.key].what}</p>
              <p className="text-ink-2"><span className="eyebrow mr-2 !text-[0.62rem] text-muted">In Context</span>{DETAIL[s.key].get}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-16 grid gap-10 md:grid-cols-2">
        <div>
          <h2 className="font-serif text-3xl">Why the order matters</h2>
          <p className="mt-4 text-lg leading-relaxed text-ink-2">
            When application comes first, it quietly decides what we see in the text. Putting interpretation sixth and
            reflection seventh gives the passage a chance to speak before we answer for it.
          </p>
        </div>
        <div>
          <h2 className="font-serif text-3xl">You can still move freely</h2>
          <p className="mt-4 text-lg leading-relaxed text-ink-2">
            The steps are a path, not a gate. Jump to any step at any time; the order is a recommendation, shown so you
            always know where you are in it.
          </p>
        </div>
      </div>
    </PublicPage>
  );
}
