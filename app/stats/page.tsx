import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Wordmark } from "@/components/ui";
import { AI_DAILY_LIMIT_SITE } from "@/lib/api";
import { studyPath } from "@/lib/bible/refs";
import { getStats } from "@/lib/data/stats";
import { currentViewer, isOwner } from "@/lib/user";

export const metadata: Metadata = { title: "Stats · Context", robots: { index: false, follow: false } };

// Owner only (OWNER_EMAILS). Anyone else gets a plain 404, so the page doesn't reveal that it exists.
export default async function Stats() {
  if (!isOwner(await currentViewer())) notFound();
  const { people, active, daily, totals, chapters } = await getStats();
  const maxDay = Math.max(1, ...daily.map((d) => Math.max(d.people, d.questions)));
  const inPeriod = (days: number) => active.find((a) => a.days === days) ?? { accounts: 0, devices: 0 };

  return (
    <div className="min-h-dvh">
      <header className="border-b border-rule">
        <div className="mx-auto flex h-20 max-w-5xl items-center justify-between px-5 sm:px-10">
          <Wordmark />
          <span className="font-mono text-xs uppercase tracking-widest text-muted">Owner only</span>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-12 sm:px-10">
        <p className="eyebrow text-accent">Stats</p>
        <h1 className="mt-3 font-serif text-4xl">Who’s using Context</h1>
        <p className="mt-3 max-w-2xl text-ink-2">
          From Context’s own database: counts only, never what anyone wrote. <b className="font-medium text-ink">Active</b> means
          asked, saved a note or answered a quiz. People who only read appear in{" "}
          <a href="https://vercel.com/dashboard" target="_blank" rel="noreferrer" className="text-accent underline underline-offset-4">Vercel Analytics</a>{" "}
          (your project → Analytics).
        </p>

        <section className="mt-10 grid gap-4 sm:grid-cols-3">
          <Card label="Accounts" value={people.accounts} note={`+${people.accounts_7d} this week`} />
          <Card label="Anonymous devices" value={people.devices} note="did something without signing in" />
          <Card label="Questions to the assistant" value={totals.questions} note={`${totals.ai_24h} of ${AI_DAILY_LIMIT_SITE} AI calls used in the last 24h`} />
        </section>

        <h2 className="mt-12 font-serif text-2xl">Active people</h2>
        <table className="mt-4 w-full max-w-xl text-left">
          <thead className="font-mono text-[0.68rem] uppercase tracking-widest text-muted">
            <tr><th className="py-2 font-normal">Period</th><th className="font-normal">Accounts</th><th className="font-normal">Devices</th><th className="font-normal">Total</th></tr>
          </thead>
          <tbody className="divide-y divide-rule border-t border-rule">
            {[[1, "Today (24h)"], [7, "Last 7 days"], [30, "Last 30 days"]].map(([d, label]) => {
              const w = inPeriod(d as number);
              return (
                <tr key={d}>
                  <td className="py-2.5 text-ink-2">{label}</td>
                  <td>{w.accounts}</td>
                  <td>{w.devices}</td>
                  <td className="font-medium">{w.accounts + w.devices}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <h2 className="mt-12 font-serif text-2xl">Last 14 days</h2>
        <p className="mt-1 text-sm text-muted">
          <span className="mr-1 inline-block h-2 w-3 rounded-sm bg-ink align-middle" /> active people ·{" "}
          <span className="mr-1 inline-block h-2 w-3 rounded-sm bg-accent align-middle" /> questions
        </p>
        <div className="mt-4 space-y-1.5">
          {daily.map((d) => (
            <div key={d.day} className="grid grid-cols-[4.5rem_1fr] items-center gap-3 text-sm">
              <span className="font-mono text-xs text-muted">{d.day}</span>
              <div className="space-y-0.5">
                <Bar value={d.people} max={maxDay} className="bg-ink" />
                <Bar value={d.questions} max={maxDay} className="bg-accent" />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 grid gap-10 sm:grid-cols-2">
          <section>
            <h2 className="font-serif text-2xl">Most-asked chapters (30 days)</h2>
            {chapters.length ? (
              <ol className="mt-4 space-y-2">
                {chapters.map((c) => (
                  <li key={`${c.slug}-${c.chapter}`} className="flex justify-between border-b border-rule pb-2">
                    <Link href={studyPath(c, c.chapter)} className="hover:text-accent">{c.name} {c.chapter}</Link>
                    <span className="font-mono text-sm text-muted">{c.questions}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-4 text-muted">No questions yet.</p>
            )}
          </section>
          <section>
            <h2 className="font-serif text-2xl">Everything else</h2>
            <dl className="mt-4 space-y-2">
              <Row label="Notes saved" value={totals.notes} />
              <Row label="Quiz answers" value={totals.guesses} />
              <Row label="Questions in the last 24h" value={totals.questions_24h} />
            </dl>
          </section>
        </div>
      </main>
    </div>
  );
}

function Card({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <div className="rounded-xl border border-rule bg-card p-5">
      <p className="eyebrow text-muted">{label}</p>
      <p className="mt-2 font-serif text-4xl">{value}</p>
      <p className="mt-1 text-sm text-muted">{note}</p>
    </div>
  );
}

function Bar({ value, max, className }: { value: number; max: number; className: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-2 rounded-sm ${className}`} style={{ width: `${Math.max(value ? 2 : 0, (value / max) * 100)}%` }} />
      <span className="font-mono text-[0.68rem] text-muted">{value || ""}</span>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between border-b border-rule pb-2">
      <dt className="text-ink-2">{label}</dt>
      <dd className="font-mono">{value}</dd>
    </div>
  );
}
