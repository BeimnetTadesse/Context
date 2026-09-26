"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { parseRef, studyPath } from "@/lib/bible/refs";
import type { NtBook } from "./workspace/PassageSwitcher";

export function StudyIndex({ groups }: { groups: { name: string; books: NtBook[] }[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const all = groups.flatMap((g) => g.books);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const ref = parseRef(q);
    const book = ref && all.find((b) => b.slug === ref.book.slug);
    if (!ref || !book) return setError("Try a New Testament reference like “John 1” or “Rom 8:28”.");
    if (ref.chapter > book.chapter_count) return setError(`${book.name} has ${book.chapter_count} chapters.`);
    router.push(studyPath(book, ref.chapter) + (ref.verseStart ? `#v${ref.verseStart}` : ""));
  };

  return (
    <>
      <form onSubmit={submit} className="mt-10 max-w-2xl">
        <div className="flex items-center gap-3 border-b-2 border-ink pb-3">
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setError("");
            }}
            autoFocus
            placeholder="Ephesians 3, John 1:1–18, Rom 8…"
            className="w-full bg-transparent font-serif text-3xl placeholder:text-muted/50 focus:outline-none"
          />
          <button className="shrink-0 rounded-xl bg-ink px-5 py-2.5 text-paper">Study →</button>
        </div>
        {error && <p className="mt-3 text-accent">{error}</p>}
      </form>

      <div className="mt-16 space-y-14">
        {groups.map((g) => (
          <section key={g.name}>
            <p className="eyebrow mb-4 text-muted">{g.name}</p>
            <div className="grid grid-cols-2 gap-x-8 sm:grid-cols-3 lg:grid-cols-4">
              {g.books.map((b) => (
                <div key={b.slug} className="border-b border-rule">
                  <button
                    onClick={() => setOpen(open === b.slug ? null : b.slug)}
                    className="flex w-full items-baseline justify-between py-3 text-left font-serif text-xl hover:text-accent"
                  >
                    {b.name}
                    <span className="font-mono text-xs text-muted">{b.chapter_count}</span>
                  </button>
                  {open === b.slug && (
                    <div className="grid grid-cols-6 gap-1.5 pb-4">
                      {Array.from({ length: b.chapter_count }, (_, i) => (
                        <Link
                          key={i}
                          href={studyPath(b, i + 1)}
                          className="rounded-md border border-rule py-1.5 text-center font-mono text-sm hover:border-ink hover:bg-card"
                        >
                          {i + 1}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
