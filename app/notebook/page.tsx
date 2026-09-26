import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/ui";

export const metadata: Metadata = { title: "Notebook · Context" };

export default function Notebook() {
  return (
    <div className="min-h-dvh">
      <header className="border-b border-rule">
        <div className="mx-auto flex h-20 max-w-4xl items-center px-5 sm:px-10">
          <Wordmark />
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-5 py-16 sm:px-10">
        <p className="eyebrow text-accent">Notebook</p>
        <h1 className="mt-5 font-serif text-5xl">Your reflections, kept apart.</h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-2">
          What you write in Reflect is saved here as personal reflection — never mixed with what the text says or what
          scholars claim. Your notebook is empty for now.
        </p>
        <Link href="/study" className="mt-10 inline-block rounded-xl bg-ink px-6 py-3 text-paper">
          Choose a passage →
        </Link>
      </main>
    </div>
  );
}
