"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { parseRef, studyPath, suggestRefs, type Suggestion } from "@/lib/bible/refs";
import type { NtBook } from "./workspace/PassageSwitcher";

type Group = { name: string; books: NtBook[] };

export function StudyIndex({ testaments }: { testaments: { name: string; groups: Group[] }[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const input = useRef<HTMLInputElement>(null);
  const all = testaments.flatMap((t) => t.groups.flatMap((g) => g.books));
  const suggestions = q.trim() ? suggestRefs(q) : [];
  const showList = listOpen && suggestions.length > 0;

  const type = (value: string) => {
    setQ(value);
    setError("");
    setActive(-1);
    setListOpen(true);
  };

  // A book completes the name and waits for a chapter (one-chapter books go straight there); a chapter opens it.
  const pick = (s: Suggestion) => {
    if (s.chapter === undefined && s.book.chapters > 1) {
      type(`${s.book.name === "Psalms" ? "Psalm" : s.book.name} `);
      input.current?.focus();
      return;
    }
    setListOpen(false);
    const verse = /:(\d+)$/.exec(s.label)?.[1];
    router.push(studyPath(s.book, s.chapter ?? 1) + (verse ? `#v${verse}` : ""));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!showList) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const n = suggestions.length;
      setActive((a) => (e.key === "ArrowDown" ? (a + 1) % n : (a - 1 + n) % n));
    } else if ((e.key === "Enter" || e.key === "Tab") && active >= 0) {
      e.preventDefault();
      pick(suggestions[active]);
    } else if (e.key === "Tab" && suggestions.length === 1 && !e.shiftKey) {
      e.preventDefault();
      pick(suggestions[0]);
    } else if (e.key === "Escape") {
      setListOpen(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const ref = parseRef(q);
    const book = ref && all.find((b) => b.slug === ref.book.slug);
    if (!ref || !book) return setError("Try a reference like “Genesis 1”, “Ps 23” or “Rom 8:28”.");
    if (ref.chapter > book.chapter_count) return setError(`${book.name} has ${book.chapter_count} chapters.`);
    router.push(studyPath(book, ref.chapter) + (ref.verseStart ? `#v${ref.verseStart}` : ""));
  };

  return (
    <>
      <form onSubmit={submit} className="relative mt-10 max-w-2xl">
        <div className="flex items-center gap-3 border-b-2 border-ink pb-3">
          <input
            ref={input}
            value={q}
            onChange={(e) => type(e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => setListOpen(true)}
            onBlur={() => setListOpen(false)}
            role="combobox"
            aria-expanded={showList}
            aria-controls="ref-suggestions"
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 ? `ref-suggestion-${active}` : undefined}
            autoComplete="off"
            spellCheck={false}
            autoFocus
            placeholder="Genesis 1, Psalm 23, John 1:1–18, Rom 8…"
            className="w-full bg-transparent font-serif text-3xl placeholder:text-muted/50 focus:outline-none"
          />
          <button className="shrink-0 rounded-xl bg-ink px-5 py-2.5 text-paper">Study →</button>
        </div>
        {showList && (
          <ul
            id="ref-suggestions"
            role="listbox"
            className="absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-xl border border-rule bg-card shadow-[0_20px_50px_-25px_rgba(40,30,20,0.45)]"
          >
            {suggestions.map((s, i) => (
              <li
                key={s.label}
                id={`ref-suggestion-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => e.preventDefault()} // keep focus in the input
                onClick={() => pick(s)}
                onMouseEnter={() => setActive(i)}
                className={`flex cursor-pointer items-baseline justify-between px-5 py-2.5 font-serif text-xl ${
                  i === active ? "bg-paper text-accent" : ""
                }`}
              >
                {s.label}
                <span className="font-mono text-xs text-muted">
                  {s.chapter === undefined
                    ? `${s.book.chapters} ${s.book.chapters === 1 ? "chapter" : "chapters"}`
                    : s.book.testament === "OT" ? "Old Testament" : "New Testament"}
                </span>
              </li>
            ))}
          </ul>
        )}
        {error && <p className="mt-3 text-accent">{error}</p>}
      </form>

      <div className="mt-16 space-y-14">
        {testaments.map((t) => (
          <div key={t.name} className="space-y-12">
            <div className="border-b border-ink pb-3">
              <h2 className="font-serif text-3xl">{t.name}</h2>
              <p className="eyebrow mt-1 text-muted">
                {t.groups.reduce((n, g) => n + g.books.length, 0)} books ·{" "}
                {t.groups.reduce((n, g) => n + g.books.reduce((c, b) => c + b.chapter_count, 0), 0).toLocaleString()} chapters
              </p>
            </div>
        {t.groups.map((g) => (
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
        ))}
      </div>
    </>
  );
}
