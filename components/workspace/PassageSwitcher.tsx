"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { parseRef, studyPath } from "@/lib/bible/refs";

export interface NtBook {
  slug: string;
  name: string;
  chapter_count: number;
}

/** ⌘K "Go to passage": type a reference or browse books → chapters. Mounted only while open. */
export function PassageSwitcher({ books, onClose }: { books: NtBook[]; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<NtBook | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const go = (slug: string, chapter: number, verse?: number) => {
    onClose();
    router.push(studyPath({ slug }, chapter) + (verse ? `#v${verse}` : ""));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const ref = parseRef(query);
    if (!ref) return setError("Try a reference like “John 1” or “Rom 8:28”.");
    if (ref.book.testament !== "NT") return setError(`${ref.book.name} is in the Old Testament — Context studies the New Testament.`);
    const book = books.find((b) => b.slug === ref.book.slug);
    if (!book || ref.chapter > book.chapter_count) return setError(`${ref.book.name} has ${book?.chapter_count} chapters.`);
    go(ref.book.slug, ref.chapter, ref.verseStart);
  };

  const filtered = query && !/\d/.test(query)
    ? books.filter((b) => b.name.toLowerCase().includes(query.toLowerCase().trim()))
    : books;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink/25 p-4 pt-[10vh] backdrop-blur-[2px]" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Go to passage"
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-rule bg-card shadow-[0_30px_80px_-30px_rgba(40,30,20,0.45)]"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={submit} className="border-b border-rule px-6 py-5">
          <p className="eyebrow mb-2 text-accent">Go to passage</p>
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setError("");
              setPicked(null);
            }}
            placeholder="John 1, Rom 8:28, Eph 3…"
            className="w-full bg-transparent font-serif text-3xl text-ink placeholder:text-muted/60 focus:outline-none"
          />
          {error && <p className="mt-2 text-sm text-accent">{error}</p>}
        </form>

        <div className="max-h-[55vh] overflow-y-auto px-6 py-5">
          {picked ? (
            <>
              <button onClick={() => setPicked(null)} className="eyebrow mb-4 text-muted hover:text-ink">
                ← All books
              </button>
              <h3 className="mb-4 font-serif text-2xl">{picked.name}</h3>
              <div className="grid grid-cols-6 gap-2 sm:grid-cols-10">
                {Array.from({ length: picked.chapter_count }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => go(picked.slug, i + 1)}
                    className="rounded-lg border border-rule py-2 font-mono text-sm hover:border-ink hover:bg-paper"
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-x-6 sm:grid-cols-3">
              {filtered.map((b) => (
                <button
                  key={b.slug}
                  onClick={() => (b.chapter_count === 1 ? go(b.slug, 1) : setPicked(b))}
                  className="flex items-baseline justify-between border-b border-rule py-2.5 text-left font-serif text-lg hover:text-accent"
                >
                  {b.name}
                  <span className="font-mono text-xs text-muted">{b.chapter_count}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
