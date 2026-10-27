import type { Metadata } from "next";
import { Wordmark } from "@/components/ui";
import { StudyIndex } from "@/components/StudyIndex";
import { getBooks } from "@/lib/data/chapter";

export const metadata: Metadata = { title: "Choose a passage · Context" };

// Book groupings for the picker, in Bible order: [name, number of books].
const GROUPS: { testament: string; groups: [string, number][] }[] = [
  {
    testament: "The Old Testament",
    groups: [["The Law", 5], ["History", 12], ["Poetry & Wisdom", 5], ["The Major Prophets", 5], ["The Minor Prophets", 12]],
  },
  {
    testament: "The New Testament",
    groups: [["Gospels & Acts", 5], ["Paul’s letters", 13], ["Hebrews, the general letters & Revelation", 9]],
  },
];

export default async function StudyHome() {
  const books = await getBooks();
  // Each group's first book: the number of books in all the groups before it.
  const sizes = GROUPS.flatMap((t) => t.groups.map(([, n]) => n));
  const starts = sizes.map((_, i) => sizes.slice(0, i).reduce((a, b) => a + b, 0));
  let g = 0;
  const testaments = GROUPS.map((t) => ({
    name: t.testament,
    groups: t.groups.map(([name, n]) => ({ name, books: books.slice(starts[g], starts[g++] + n) })),
  }));

  return (
    <div className="min-h-dvh">
      <header className="border-b border-rule">
        <div className="mx-auto flex h-20 max-w-6xl items-center px-5 sm:px-10">
          <Wordmark />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-16 sm:px-10">
        <p className="eyebrow text-accent">The Bible · 66 books · 1,189 chapters</p>
        <h1 className="mt-5 font-serif text-5xl sm:text-6xl">What do you want to study?</h1>
        <StudyIndex testaments={testaments} />
      </main>
    </div>
  );
}
