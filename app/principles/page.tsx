import type { Metadata } from "next";
import Link from "next/link";
import { PublicPage } from "@/components/PublicPage";

export const metadata: Metadata = {
  title: "Principles · Context",
  description: "Context is a research assistant, not an authority: it cites, it shows disagreement, and it doesn’t speak for God.",
};

const PRINCIPLES: [string, React.ReactNode][] = [
  ["It cites.", "Every explanation links to the text, lexicon, manuscript note or commentary it relies on. If there is nothing to cite, it isn’t said."],
  ["It shows disagreement.", "Where careful readers differ, the main views sit side by side, with who holds them and why. Context doesn’t pick a winner."],
  ["It doesn’t speak for God.", "Context explains what the text says and how it has been read. What it means for your life is left to you, your church and the Spirit."],
  ["The AI never writes Scripture.", "Every verse comes from a published translation. The AI only arranges real sources, every quote is checked word for word, and nothing it drafts counts as verified until a person checks it."],
  ["Licensed text is protected.", "Translations such as the NIV or the New Amharic Standard Version are shown as their publishers allow: displayed, never stored, never copied, and never given to the AI."],
  ["Your study is yours.", <>Notes, highlights and reflections are private and kept apart from the study itself. You can download or delete them at any time. <Link href="/privacy" className="underline underline-offset-4 hover:text-accent">Privacy</Link></>],
  ["It is honest about its limits.", <>Where a source is old, partial or one-sided, Context says so. How references are checked is public. <Link href="/audit" className="underline underline-offset-4 hover:text-accent">The audit</Link></>],
];

export default function Principles() {
  return (
    <PublicPage
      current="/principles"
      eyebrow="Principles"
      title={<>A research assistant, <em className="text-accent">not an authority.</em></>}
      intro="Context is built to help you read more carefully, not to read for you. These are the rules it keeps."
      next={{ href: "/method", name: "Method" }}
    >
      <div className="grid gap-x-12 gap-y-14 md:grid-cols-2">
        {PRINCIPLES.map(([t, d]) => (
          <div key={t} className="border-t border-ink pt-7">
            <h2 className="font-serif text-3xl">{t}</h2>
            <p className="mt-4 text-lg leading-relaxed text-ink-2">{d}</p>
          </div>
        ))}
      </div>
    </PublicPage>
  );
}
