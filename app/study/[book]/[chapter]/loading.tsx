"use client";

import { useParams } from "next/navigation";
import { Wordmark } from "@/components/ui";
import { bookBySlug } from "@/lib/bible/books";

// Shown the moment a chapter link is clicked, while the server prepares the chapter. Without it the old page
// stays on screen with no sign anything is happening, and readers click again.
export default function LoadingChapter() {
  const { book, chapter } = useParams<{ book: string; chapter: string }>();
  const name = bookBySlug(book)?.name ?? "";

  return (
    <div className="min-h-dvh" aria-busy="true">
      <header className="sticky top-0 z-30 border-b border-rule bg-paper/95">
        <div className="flex h-16 items-center gap-2 px-4 sm:gap-4 sm:px-8">
          <Wordmark />
          <span className="hidden h-7 w-px bg-rule sm:block" />
          <span className="px-2 font-serif text-lg sm:text-xl">{name} {chapter}</span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-14 sm:px-10">
        <p className="eyebrow text-accent" role="status">Opening {name} {chapter}…</p>
        <div className="mt-8 space-y-4 animate-pulse">
          {[92, 100, 86, 97, 74, 100, 89, 61].map((w, i) => (
            <div key={i} className="h-4 rounded bg-paper-2" style={{ width: `${w}%` }} />
          ))}
        </div>
      </main>
    </div>
  );
}
