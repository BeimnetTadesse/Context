import type { Metadata } from "next";
import Link from "next/link";
import { Dot } from "@/components/ui";
import { PageHeader } from "@/components/PageHeader";
import { RemoveButton } from "@/components/account/RemoveButton";
import { getNotebook, REFLECTION_KINDS, type GuessItem, type HighlightItem, type NoteItem } from "@/lib/data/account";
import { HIGHLIGHTS } from "@/lib/highlights";
import { LABEL_INFO, type Label } from "@/lib/labels";
import { currentViewer } from "@/lib/user";

export const metadata: Metadata = { title: "Notebook · Context", robots: { index: false } };

const TABS = [
  { key: "notes", name: "Notes" },
  { key: "reflections", name: "Reflections" },
  { key: "highlights", name: "Highlights" },
  { key: "quiz", name: "Quiz" },
] as const;
type Tab = (typeof TABS)[number]["key"];

const KIND: Record<string, string> = { note: "Note", reflection: "Reflection", text_says: "What the text says", i_bring: "What I’m bringing" };
const date = (d: Date) => d.toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" });

/** Group items by book, then chapter, keeping their order. */
function byPassage<T extends { book: string; slug: string; chapter: number }>(items: T[]) {
  const groups: { book: string; slug: string; chapter: number; items: T[] }[] = [];
  for (const it of items) {
    const g = groups[groups.length - 1];
    if (g && g.slug === it.slug && g.chapter === it.chapter) g.items.push(it);
    else groups.push({ book: it.book, slug: it.slug, chapter: it.chapter, items: [it] });
  }
  return groups;
}

export default async function Notebook(props: PageProps<"/notebook">) {
  const sp = await props.searchParams;
  const tab: Tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as Tab) : "notes";
  const bookFilter = typeof sp.book === "string" ? sp.book : null;

  const viewer = await currentViewer();
  const all = viewer.id ? await getNotebook(viewer.id) : { notes: [], highlights: [], guesses: [] };
  const lists = {
    notes: all.notes.filter((n) => n.kind === "note"),
    reflections: all.notes.filter((n) => REFLECTION_KINDS.includes(n.kind)),
    highlights: all.highlights,
    quiz: all.guesses,
  };
  const current: { book: string; slug: string }[] = lists[tab];
  const books = [...new Map(current.map((i) => [i.slug, i.book])).entries()];
  const shown = bookFilter ? current.filter((i) => i.slug === bookFilter) : current;
  const href = (t: Tab, book: string | null = null) => `/notebook?tab=${t}${book ? `&book=${book}` : ""}`;

  return (
    <div className="min-h-dvh">
      <PageHeader viewer={viewer} />
      <main className="mx-auto max-w-4xl px-5 py-14 sm:px-10">
        <p className="eyebrow text-accent">Notebook</p>
        <h1 className="mt-4 font-serif text-[clamp(2.4rem,5vw,3.4rem)] leading-tight">Your study, kept apart.</h1>
        <p className="mt-3 max-w-xl text-lg leading-relaxed text-ink-2">
          What you write and mark is personal. It stays here, never mixed with what the text says or what scholars claim.
        </p>

        {!viewer.signedIn && (
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--l-scholarly)] bg-[var(--l-scholarly-bg)] px-5 py-4">
            <p className="text-ink-2">This notebook lives only in this browser. Sign in to keep it safe and see it on every device.</p>
            <Link href="/signin?next=/notebook" className="rounded-xl bg-ink px-4 py-2 text-paper">Sign in</Link>
          </div>
        )}

        {/* Tabs */}
        <nav className="mt-10 flex gap-1 overflow-x-auto border-b border-rule" aria-label="Notebook sections">
          {TABS.map((t) => (
            <Link key={t.key} href={href(t.key)} aria-current={t.key === tab ? "page" : undefined}
              className={`-mb-px whitespace-nowrap border-b-2 px-4 py-3 text-[0.98rem] ${t.key === tab ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"}`}>
              {t.name} <span className="ml-1 font-mono text-xs text-muted">{lists[t.key].length}</span>
            </Link>
          ))}
        </nav>

        {/* Book filter */}
        {books.length > 1 && (
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href={href(tab)} className={`rounded-full border px-3 py-1 text-sm ${!bookFilter ? "border-ink bg-ink text-paper" : "border-rule bg-card text-ink-2 hover:border-ink"}`}>All books</Link>
            {books.map(([slug, name]) => (
              <Link key={slug} href={href(tab, slug)} className={`rounded-full border px-3 py-1 text-sm ${bookFilter === slug ? "border-ink bg-ink text-paper" : "border-rule bg-card text-ink-2 hover:border-ink"}`}>{name}</Link>
            ))}
          </div>
        )}

        {tab === "quiz" && lists.quiz.length > 0 && <QuizScore guesses={bookFilter ? lists.quiz.filter((g) => g.slug === bookFilter) : lists.quiz} />}

        {shown.length === 0 ? (
          <p className="mt-10 rounded-2xl border border-dashed border-rule p-8 text-ink-2">{EMPTY[tab]}</p>
        ) : (
          byPassage(shown as (NoteItem | HighlightItem | GuessItem)[]).map((g) => (
            <section key={`${g.slug}-${g.chapter}`} className="mt-10">
              <Link href={`/study/${g.slug}/${g.chapter}`} className="font-serif text-2xl hover:text-accent">{g.book} {g.chapter}</Link>
              <ul className="mt-3 divide-y divide-rule border-y border-rule">
                {g.items.map((it) =>
                  tab === "highlights" ? <HighlightRow key={(it as HighlightItem).ord} h={it as HighlightItem} />
                  : tab === "quiz" ? <QuizRow key={(it as GuessItem).item_id} q={it as GuessItem} />
                  : <NoteRow key={(it as NoteItem).id} n={it as NoteItem} />,
                )}
              </ul>
            </section>
          ))
        )}
      </main>
    </div>
  );
}

const EMPTY: Record<Tab, string> = {
  notes: "No notes yet. Select a phrase in Read and choose “Add note”.",
  reflections: "No reflections yet. Answer a reflection question in the Reflect step.",
  highlights: "No highlights yet. Select a verse in Read and pick a colour.",
  quiz: "No quiz answers yet. Try “Text or Assumption?” in the Reflect step.",
};

function NoteRow({ n }: { n: NoteItem }) {
  return (
    <li className="py-5">
      <div className="flex items-center justify-between gap-3">
        <p className="eyebrow flex items-center gap-2 !text-[0.64rem] text-muted">
          <Dot label={n.kind === "text_says" ? "explicit" : "personal"} size={6} />
          {KIND[n.kind] ?? "Note"}
          {n.verse ? (
            <Link href={`/study/${n.slug}/${n.chapter}#v${n.verse}`} className="hover:text-accent">· {n.chapter}:{n.verse}</Link>
          ) : null}
          · {date(n.created_at)}
        </p>
        <RemoveButton target={{ note: n.id }} />
      </div>
      {n.prompt && <p className="mt-2 text-sm italic text-muted">{n.prompt}</p>}
      <p className="mt-2 whitespace-pre-wrap font-serif text-[1.15rem] leading-relaxed">{n.body}</p>
    </li>
  );
}

function HighlightRow({ h }: { h: HighlightItem }) {
  return (
    <li className="flex items-start gap-4 py-4">
      <Link href={`/study/${h.slug}/${h.chapter}#v${h.verse}`} className="w-12 shrink-0 pt-1 font-mono text-sm text-accent hover:underline">{h.chapter}:{h.verse}</Link>
      <p className="flex-1 font-serif text-[1.1rem] leading-relaxed">
        <span className="rounded-sm px-0.5 [box-decoration-break:clone]" style={{ backgroundColor: HIGHLIGHTS[h.color].fill }}>{h.text}</span>
      </p>
      <RemoveButton target={{ highlight: { book: h.slug, chapter: h.chapter, verse: h.verse } }} />
    </li>
  );
}

function QuizRow({ q }: { q: GuessItem }) {
  return (
    <li className="py-4">
      <p className="font-serif text-[1.1rem]">“{q.statement}”</p>
      <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-2">
        <span className="inline-flex items-center gap-1.5">You: <Dot label={q.guess} size={7} />{LABEL_INFO[q.guess].short}</span>
        <span className="inline-flex items-center gap-1.5">Context: <Dot label={q.expected} size={7} />{LABEL_INFO[q.expected].short}</span>
        <span className={q.correct ? "text-[var(--l-explicit)]" : "text-accent"}>{q.correct ? "✓ matched" : "✗ different"}</span>
      </p>
    </li>
  );
}

function QuizScore({ guesses }: { guesses: GuessItem[] }) {
  const right = guesses.filter((g) => g.correct).length;
  const slips = new Map<string, number>();
  for (const g of guesses.filter((g) => !g.correct)) slips.set(`${g.expected}→${g.guess}`, (slips.get(`${g.expected}→${g.guess}`) ?? 0) + 1);
  const top = [...slips].sort((a, b) => b[1] - a[1])[0];
  const [was, read] = (top?.[0].split("→") ?? []) as Label[];
  return (
    <section className="mt-8 rounded-2xl border border-rule bg-card p-6">
      <p className="eyebrow text-muted">Your score</p>
      <p className="mt-2 font-serif text-3xl">{right} of {guesses.length} labelled as Context does ({Math.round((right / guesses.length) * 100)}%)</p>
      {top && (
        <p className="mt-3 flex flex-wrap items-center gap-2 text-ink-2">
          Most common slip: you read <span className="inline-flex items-center gap-1.5"><Dot label={was} />{LABEL_INFO[was].short}</span>
          as <span className="inline-flex items-center gap-1.5"><Dot label={read} />{LABEL_INFO[read].short}</span> ({top[1]}×).
        </p>
      )}
    </section>
  );
}
