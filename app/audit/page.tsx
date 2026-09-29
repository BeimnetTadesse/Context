import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/ui";
import { sql } from "@/lib/db";

// Rebuilt at most hourly (served from cache in between), so it never waits on a sleeping database.
export const revalidate = 3600;

export const metadata: Metadata = { title: "How references are checked · Context" };

const fmt = (n: number) => n.toLocaleString("en");
const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(1)}%` : "—");

function Stat({ n, label, sub }: { n: string; label: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-rule bg-card p-5">
      <p className="font-serif text-4xl">{n}</p>
      <p className="mt-1 text-ink-2">{label}</p>
      {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
    </div>
  );
}

export default async function Audit() {
  const [refs] = await sql<{ total: number; resolved: number }[]>`
    select count(*)::int as total, count(*) filter (where resolved)::int as resolved from commentary_refs`;
  const [claims] = await sql<{ total: number; verified: number; supported: number; partial: number; unsupported: number; unreviewed: number; quoted: number }[]>`
    select count(*)::int as total,
           count(*) filter (where status = 'verified')::int as verified,
           count(*) filter (where review = 'supported')::int as supported,
           count(*) filter (where review = 'partial')::int as partial,
           count(*) filter (where review = 'unsupported')::int as unsupported,
           count(*) filter (where review is null)::int as unreviewed,
           (select count(distinct claim_id)::int from citations where quote is not null) as quoted
    from claims`;
  const [dropped] = await sql<{ n: number; runs: number }[]>`
    select coalesce(sum(jsonb_array_length(validation->'issues')), 0)::int as n, count(*)::int as runs
    from ai_runs where kind = 'chapter_study' and validation ? 'issues'`;
  const reasons = await sql<{ reason: string; n: number }[]>`
    select regexp_replace(i->>'problem', ':.*$', '') as reason, count(*)::int as n
    from ai_runs, jsonb_array_elements(validation->'issues') i
    where kind = 'chapter_study' group by 1 order by 2 desc limit 8`;
  const issues = await sql<{ key: string; title: string; kind: string; description: string }[]>`
    select s.key, s.title, i.kind, i.description from source_issues i join sources s on s.id = i.source_id
    order by (i.kind = 'coverage'), s.key`;
  const unresolved = await sql<{ key: string; raw: string; where_: string }[]>`
    select s.key, r.raw, b.name || ' ' || n.chapter as where_
    from commentary_refs r join commentary_notes n on n.id = r.note_id join sources s on s.id = n.source_id
    join books b on b.id = n.book_id where not r.resolved order by s.key, n.start_ord limit 40`;

  return (
    <div className="min-h-dvh">
      <header className="border-b border-rule">
        <div className="mx-auto flex h-20 max-w-5xl items-center justify-between px-5 sm:px-10">
          <Wordmark />
          <Link href="/sources" className="text-ink-2 hover:text-ink">Source library →</Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-14 sm:px-10">
        <p className="eyebrow text-accent">Audit</p>
        <h1 className="mt-4 font-serif text-[clamp(2.4rem,5vw,3.4rem)]">How every reference is checked.</h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-2">
          Context doesn’t ask you to trust it. These are the checks every claim and reference goes through, with live
          numbers — including what failed.
        </p>

        <h2 className="mt-14 font-serif text-3xl">1 · References inside the commentaries</h2>
        <p className="mt-2 max-w-2xl text-ink-2">
          Every Bible reference in Calvin, Henry, Gill, Clarke, JFB and Tyndale is parsed and matched to a real verse
          (including old abbreviations like “Ti2 3:15” and differences in verse numbering).
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Stat n={fmt(refs.total)} label="references found" />
          <Stat n={pct(refs.resolved, refs.total)} label="resolve to a real verse" sub={`${fmt(refs.resolved)} links`} />
          <Stat n={fmt(refs.total - refs.resolved)} label="could not be matched" sub="listed below for review" />
        </div>

        <h2 className="mt-14 font-serif text-3xl">2 · Claims written by the research assistant</h2>
        <p className="mt-2 max-w-2xl text-ink-2">
          Before anything is saved, a validator removes citations to evidence the assistant wasn’t given, commentator
          attributions without their exact words, and historical claims without historical evidence. Then an independent
          second reader checks each claim against what it cites. Claims it finds unsupported are withheld.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Stat n={fmt(claims.total)} label="claims in the database" sub={`${fmt(claims.verified)} verified by a person`} />
          <Stat n={fmt(dropped.n)} label="items removed by the validator" sub={`across ${fmt(dropped.runs)} chapter drafts`} />
          <Stat n={fmt(claims.quoted)} label="claims quoting a commentator" sub="every quote matched word-for-word" />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-4">
          <Stat n={fmt(claims.supported)} label="supported" sub="second reader" />
          <Stat n={fmt(claims.partial)} label="partly supported" sub="shown, flagged in “Show me why”" />
          <Stat n={fmt(claims.unsupported)} label="not supported" sub="withheld from the page" />
          <Stat n={fmt(claims.unreviewed)} label="not yet reviewed" />
        </div>
        {reasons.length > 0 && (
          <div className="mt-6 rounded-2xl border border-rule bg-card p-5">
            <p className="eyebrow mb-3 text-muted">Why the validator removed things</p>
            <ul className="space-y-1 text-ink-2">
              {reasons.map((r) => (
                <li key={r.reason} className="flex justify-between gap-4"><span>{r.reason}</span><span className="font-mono text-sm">{fmt(r.n)}</span></li>
              ))}
            </ul>
          </div>
        )}

        <h2 className="mt-14 font-serif text-3xl">3 · Problems found in the sources themselves</h2>
        <p className="mt-2 max-w-2xl text-ink-2">Recorded, not silently fixed.</p>
        <ul className="mt-6 divide-y divide-rule border-y border-rule">
          {issues.map((i, n) => (
            <li key={n} className="grid gap-2 py-4 sm:grid-cols-[10rem_1fr]">
              <span className="font-mono text-sm text-accent">[{i.key}] {i.kind === "coverage" ? "coverage" : "problem"}</span>
              <span className="text-ink-2">{i.description}</span>
            </li>
          ))}
        </ul>

        {unresolved.length > 0 && (
          <details className="mt-8">
            <summary className="cursor-pointer text-accent">References that could not be matched (first {unresolved.length})</summary>
            <p className="mt-3 text-sm text-muted">
              Mostly errors or typos in the digitised commentaries (e.g. a chapter that doesn’t exist), Hebrew verse
              numbering, or books outside the Protestant canon.
            </p>
            <ul className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              {unresolved.map((u, i) => (
                <li key={i} className="flex justify-between gap-3 border-b border-rule py-1">
                  <span><span className="font-mono text-accent">[{u.key}]</span> “{u.raw}”</span>
                  <span className="text-muted">in {u.where_}</span>
                </li>
              ))}
            </ul>
          </details>
        )}

        <p className="mt-14 rounded-2xl bg-paper-2 p-5 leading-relaxed text-ink-2">
          <span className="eyebrow mr-2 !text-[0.62rem] text-accent">Limits</span>
          The second reader is itself an AI and can be wrong; it checks claims only against the evidence they cite.
          Nothing here replaces reading the sources yourself — which is why every claim links to them.
        </p>
      </main>
    </div>
  );
}
