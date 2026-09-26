import type { Metadata } from "next";
import { Wordmark } from "@/components/ui";
import { StudyIndex } from "@/components/StudyIndex";
import { getNtBooks } from "@/lib/data/chapter";

export const metadata: Metadata = { title: "Choose a passage · Context" };

// NT book groupings for the picker.
const GROUPS: [string, number][] = [
  ["Gospels & Acts", 5],
  ["Paul’s letters", 13],
  ["Hebrews, the general letters & Revelation", 9],
];

export default async function StudyHome() {
  const books = await getNtBooks();
  const starts = GROUPS.map((_, g) => GROUPS.slice(0, g).reduce((sum, [, n]) => sum + n, 0));
  const groups = GROUPS.map(([name, n], g) => ({ name, books: books.slice(starts[g], starts[g] + n) }));

  return (
    <div className="min-h-dvh">
      <header className="border-b border-rule">
        <div className="mx-auto flex h-20 max-w-6xl items-center px-5 sm:px-10">
          <Wordmark />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-16 sm:px-10">
        <p className="eyebrow text-accent">The New Testament · 27 books · 260 chapters</p>
        <h1 className="mt-5 font-serif text-5xl sm:text-6xl">What do you want to study?</h1>
        <StudyIndex groups={groups} />
      </main>
    </div>
  );
}
