import type { Metadata } from "next";
import Link from "next/link";
import { Dot, Wordmark } from "@/components/ui";
import { sql } from "@/lib/db";
import { LABEL_INFO, type Label } from "@/lib/labels";
import { currentUserId } from "@/lib/user";

export const metadata: Metadata = { title: "Notebook · Context" };

const KIND: Record<string, string> = {
  note: "Note",
  reflection: "Reflection",
  text_says: "What the text says",
  i_bring: "What I’m bringing",
};

export default async function Notebook() {
  const userId = await currentUserId();
  type NoteRow = { id: number; kind: string; body: string; created_at: Date; name: string; slug: string; chapter: number; verse: number | null; prompt: string | null };
  const notes: NoteRow[] = userId
    ? await sql<NoteRow[]>`
        select n.id, n.kind, n.body, n.created_at, b.name, b.slug, n.chapter, v.verse, r.text as prompt
        from notes n join books b on b.id = n.book_id
        left join verses v on v.ord = n.start_ord
        left join reflection_items r on r.id = n.item_id
        where n.user_id = ${userId} and n.kind <> 'text_issue'
        order by n.created_at desc`
    : [];
  const guesses = userId
    ? await sql<{ guess: Label; expected: Label; correct: boolean }[]>`
        select g.guess, r.expected_label as expected, g.correct
        from assumption_guesses g join reflection_items r on r.id = g.item_id where g.user_id = ${userId}`
    : [];

  // Assumption score: how often your label matched, and which confusion is most common.
  const right = guesses.filter((g) => g.correct).length;
  const confusions = new Map<string, number>();
  for (const g of guesses.filter((g) => !g.correct)) {
    const k = `${g.expected}→${g.guess}`;
    confusions.set(k, (confusions.get(k) ?? 0) + 1);
  }
  const top = [...confusions].sort((a, b) => b[1] - a[1])[0];

  const groups = new Map<string, NoteRow[]>();
  for (const n of notes) {
    const k = `${n.name} ${n.chapter}|/study/${n.slug}/${n.chapter}`;
    groups.set(k, [...(groups.get(k) ?? []), n]);
  }

  return (
    <div className="min-h-dvh">
      <header className="border-b border-rule">
        <div className="mx-auto flex h-20 max-w-4xl items-center justify-between px-5 sm:px-10">
          <Wordmark />
          <Link href="/study" className="text-ink-2 hover:text-ink">Choose a passage →</Link>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-5 py-14 sm:px-10">
        <p className="eyebrow text-accent">Notebook</p>
        <h1 className="mt-4 font-serif text-[clamp(2.4rem,5vw,3.4rem)]">Your reflections, kept apart.</h1>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-ink-2">
          Everything here is personal reflection — saved privately on this device and never mixed with what the text says
          or what scholars claim.
        </p>

        {guesses.length > 0 && (
          <section className="mt-12 rounded-2xl border border-rule bg-card p-6">
            <p className="eyebrow text-muted">Text or Assumption? · your score</p>
            <p className="mt-3 font-serif text-3xl">
              {right} of {guesses.length} labelled as Context does ({Math.round((right / guesses.length) * 100)}%)
            </p>
            {top && (
              <p className="mt-3 flex flex-wrap items-center gap-2 text-ink-2">
                Most common slip: you read
                <span className="inline-flex items-center gap-1.5"><Dot label={top[0].split("→")[0] as Label} />{LABEL_INFO[top[0].split("→")[0] as Label].short}</span>
                as
                <span className="inline-flex items-center gap-1.5"><Dot label={top[0].split("→")[1] as Label} />{LABEL_INFO[top[0].split("→")[1] as Label].short}</span>
                ({top[1]}×).
              </p>
            )}
          </section>
        )}

        {notes.length === 0 ? (
          <p className="mt-12 rounded-2xl border border-dashed border-rule p-8 text-ink-2">
            Nothing yet. Select a phrase in Read and choose “Add note”, or write in Reflect.
          </p>
        ) : (
          [...groups].map(([key, items]) => {
            const [title, href] = key.split("|");
            return (
              <section key={key} className="mt-12">
                <Link href={href} className="font-serif text-3xl hover:text-accent">{title}</Link>
                <ul className="mt-4 divide-y divide-rule border-y border-rule">
                  {items.map((n) => (
                    <li key={n.id} className="py-5">
                      <p className="eyebrow flex items-center gap-2 !text-[0.64rem] text-muted">
                        <Dot label={n.kind === "text_says" ? "explicit" : "personal"} size={6} />
                        {KIND[n.kind]}
                        {n.verse ? ` · ${n.chapter}:${n.verse}` : ""} · {n.created_at.toLocaleDateString("en", { month: "short", day: "numeric" })}
                      </p>
                      {n.prompt && <p className="mt-2 text-sm italic text-muted">{n.prompt}</p>}
                      <p className="mt-2 whitespace-pre-wrap font-serif text-[1.15rem] leading-relaxed">{n.body}</p>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })
        )}
      </main>
    </div>
  );
}
