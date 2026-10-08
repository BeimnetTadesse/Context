import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/ui";

export const metadata: Metadata = { title: "Account deleted · Context", robots: { index: false } };

export default function Deleted() {
  return (
    <div className="min-h-dvh">
      <header className="border-b border-rule">
        <div className="mx-auto flex h-20 max-w-3xl items-center px-5 sm:px-10"><Wordmark /></div>
      </header>
      <main className="mx-auto max-w-xl px-5 py-24 text-center">
        <p className="eyebrow text-accent">Done</p>
        <h1 className="mt-4 font-serif text-4xl">Your data has been deleted.</h1>
        <p className="mt-4 leading-relaxed text-ink-2">
          Your notes, reflections, highlights and quiz answers are gone. You can keep reading Context without an account
          anytime.
        </p>
        <Link href="/study" className="mt-8 inline-block rounded-xl bg-ink px-5 py-3 text-paper">Back to reading</Link>
      </main>
    </div>
  );
}
