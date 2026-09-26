import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/ui";
import { sql } from "@/lib/db";

export const metadata: Metadata = { title: "Sources · Context" };

const TIERS: Record<number, string> = {
  1: "Primary text",
  2: "Ancient witness",
  3: "Academic",
  4: "Translation / study data",
  5: "Theological",
  6: "Educational",
};

export default async function Sources() {
  const sources = await sql<{ key: string; title: string; author: string | null; publisher: string | null; year: string | null; url: string | null; tier: number; source_type: string; orientation: string | null; license: string; can_display: boolean; claims: number; verified: number }[]>`
    select s.*, count(distinct c.claim_id)::int as claims,
           count(distinct c.claim_id) filter (where cl.status = 'verified')::int as verified
    from sources s left join citations c on c.source_id = s.id left join claims cl on cl.id = c.claim_id
    group by s.id order by s.tier, s.id`;

  return (
    <div className="min-h-dvh">
      <header className="border-b border-rule">
        <div className="mx-auto flex h-20 max-w-5xl items-center justify-between px-5 sm:px-10">
          <Wordmark />
          <Link href="/study" className="text-ink-2 hover:text-ink">Choose a passage →</Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-14 sm:px-10">
        <p className="eyebrow text-accent">Source library</p>
        <h1 className="mt-4 font-serif text-[clamp(2.4rem,5vw,3.4rem)]">Where every claim comes from.</h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-2">
          Context only shows words it is licensed to show, and only cites what is in this library. Each source carries its
          tier and orientation so that bias is visible, not hidden.
        </p>
        <ul className="mt-12 divide-y divide-rule border-y border-rule">
          {sources.map((s) => (
            <li key={s.key} className="grid gap-4 py-7 md:grid-cols-[1fr_16rem]">
              <div>
                <p className="font-mono text-xs text-accent">[{s.key}]</p>
                <p className="mt-1 font-serif text-2xl leading-snug">
                  {s.url ? <a href={s.url} target="_blank" rel="noreferrer" className="hover:text-accent">{s.title}</a> : s.title}
                </p>
                <p className="mt-1 text-ink-2">{[s.author, s.publisher, s.year].filter(Boolean).join(" · ")}</p>
                <p className="mt-3 text-sm text-muted">
                  {s.license}
                  {s.can_display ? " · text shown in Context" : " · cited only, never quoted at length"}
                </p>
              </div>
              <dl className="grid grid-cols-[6rem_1fr] gap-y-1 text-sm">
                <dt className="text-muted">Tier</dt><dd>{s.tier} · {TIERS[s.tier]}</dd>
                <dt className="text-muted">Type</dt><dd>{s.source_type}</dd>
                <dt className="text-muted">Orientation</dt><dd>{s.orientation ?? "—"}</dd>
                <dt className="text-muted">Cited by</dt><dd>{s.claims} claims · {s.verified} verified</dd>
              </dl>
            </li>
          ))}
        </ul>
        <p className="mt-8 text-sm leading-relaxed text-muted">
          Not yet in the library: academic commentaries (e.g. Lincoln, Hoehner, Arnold) and lexicons such as BDAG and
          Louw-Nida are copyrighted. They will be added as cited-only sources once each reference has been checked by hand.
        </p>
      </main>
    </div>
  );
}
