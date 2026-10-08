import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/ui";
import { AMHARIC_1962_NOTICE } from "@/lib/notices";
import { VERSIONS } from "@/lib/versions";
import { youVersionNotice } from "@/lib/youversion";

export const metadata: Metadata = { title: "Copyright · Context" };

// Official notices come straight from each provider's metadata for each version (cached ≤ 1 day), never retyped.
async function licensedNotices() {
  const key = process.env.API_BIBLE_KEY;
  if (!key) return [];
  return Promise.all(
    VERSIONS.flatMap((v) => (v.source.kind === "apibible" ? [{ code: v.code, name: v.name, bibleId: v.source.bibleId }] : [])).map(async ({ code, name, bibleId }) => {
      const r = await fetch(`https://rest.api.bible/v1/bibles/${bibleId}`, { headers: { "api-key": key }, next: { revalidate: 86400 } }).catch(() => null);
      const d = r?.ok ? ((await r.json()) as { data: { name: string; copyright: string } }).data : null;
      return { code, name: d?.name ?? name, copyright: d?.copyright ?? "" };
    }),
  );
}

async function youVersionNotices() {
  return Promise.all(
    VERSIONS.flatMap((v) => (v.source.kind === "youversion" ? [{ code: v.code, ...v.source }] : [])).map(async ({ code, bibleId, publisher }) => {
      const n = await youVersionNotice(bibleId);
      return n && { code, ...n, publisher };
    }),
  ).then((all) => all.filter((n) => n !== null));
}


export default async function Copyright() {
  const [notices, yv] = await Promise.all([licensedNotices(), youVersionNotices()]);
  return (
    <div className="min-h-dvh">
      <header className="border-b border-rule">
        <div className="mx-auto flex h-20 max-w-4xl items-center justify-between px-5 sm:px-10">
          <Wordmark />
          <Link href="/sources" className="text-ink-2 hover:text-ink">Source library →</Link>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-5 py-14 sm:px-10">
        <p className="eyebrow text-accent">Copyright</p>
        <h1 className="mt-4 font-serif text-[clamp(2.2rem,5vw,3.2rem)]">Scripture texts in Context</h1>

        <h2 className="mt-12 font-serif text-2xl">Licensed translations</h2>
        <p className="mt-2 text-ink-2">
          Provided by <a href="https://api.bible" className="text-accent underline underline-offset-4" target="_blank" rel="noreferrer">API.Bible</a>{" "}
          for non-commercial use. Shown for reading and comparison only: they are fetched when you choose them, not stored by
          Context, cannot be copied, and are never sent to any AI system.
        </p>
        <ul className="mt-4 space-y-4">
          {notices.map((n) => (
            <li key={n.code} className="rounded-xl border border-rule bg-card p-4">
              <p className="font-serif text-lg">{n.name} ({n.code})</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-2">{n.copyright}</p>
              <p className="mt-2 text-sm text-ink-2">
                Scriptures quotations marked ({n.code}) are used by permission. All rights reserved. The {n.code} text may not be
                quoted in any publication made available to the public by a Creative Commons license. The {n.code} may not be
                translated into any other language.
              </p>
            </li>
          ))}
          {notices.length === 0 && <li className="text-sm text-muted">Licensed translations are not enabled on this deployment.</li>}
        </ul>

        <p className="mt-8 text-ink-2">
          Provided through the{" "}
          <a href="https://platform.youversion.com" className="text-accent underline underline-offset-4" target="_blank" rel="noreferrer">YouVersion Platform</a>{" "}
          for non-commercial reading, under each publisher’s licence: not stored by Context, cannot be copied, and never sent to any AI system.
        </p>
        <ul className="mt-4 space-y-4">
          {yv.map((n) => (
            <li key={n.code} className="rounded-xl border border-rule bg-card p-4">
              <p className="font-serif text-lg">{n.title} ({n.code})</p>
              <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-ink-2">{n.copyright}</p>
              {n.trademark && <p className="mt-2 text-sm leading-relaxed text-ink-2">{n.trademark}</p>}
              <p className="mt-2 text-sm text-ink-2">
                Published by{" "}
                <a href={n.publisher.url} className="text-accent underline underline-offset-4" target="_blank" rel="noreferrer">{n.publisher.name}</a>
              </p>
            </li>
          ))}
        </ul>

        <h2 className="mt-12 font-serif text-2xl">Amharic</h2>
        <p className="mt-2 font-serif text-lg">Amharic Bible (1962), New Testament</p>
        <p className="mt-1 text-sm leading-relaxed text-ink-2">{AMHARIC_1962_NOTICE}</p>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">
          The eBible.org e-text is missing some verses. Those (marked ◦ in the reader) were restored from{" "}
          <a href="https://www.wordproject.org/bibles/am/index.htm" className="text-accent underline underline-offset-4" target="_blank" rel="noreferrer">WordProject’s copy</a>{" "}
          of the same 1962 translation, which it makes available for non-profit use.
        </p>

        <h2 className="mt-12 font-serif text-2xl">Public domain</h2>
        <ul className="mt-2 space-y-1 text-ink-2">
          <li>World English Bible (WEB) — eBible.org</li>
          <li>Berean Standard Bible (BSB) — The Holy Bible, Berean Standard Bible, BSB is produced in cooperation with Bible Hub, Discovery Bible, OpenBible.com, and the Berean Bible Translation Committee. Dedicated to the public domain.</li>
          <li>King James Version (KJV) — public domain outside the United Kingdom (Crown letters patent apply within the UK)</li>
          <li>American Standard Version (ASV) and Young’s Literal Translation (YLT) — eBible.org</li>
        </ul>
        <h2 className="mt-12 font-serif text-2xl">Greek, lexicon and commentaries</h2>
        <p className="mt-2 text-ink-2">
          SBL Greek New Testament (CC BY 4.0) · Greek tagging and Abbott-Smith lexicon from STEP Bible, Tyndale House,
          Cambridge (www.STEPBible.org, CC BY 4.0) · Cross-references from OpenBible.info (CC BY) · Tyndale Open Study Notes ©
          Tyndale House Publishers (CC BY-SA 4.0) · Commentaries of Calvin, Henry, Gill, Clarke and Jamieson-Fausset-Brown
          (public domain), via the Free Use Bible API · The International Standard Bible Encyclopedia (1915) and Easton’s Bible Dictionary (1897), public domain, for book introductions and overviews. Details in the <Link href="/sources" className="text-accent underline underline-offset-4">source library</Link>.
        </p>

        <h2 className="mt-12 font-serif text-2xl">Usage reporting</h2>
        <p className="mt-2 text-ink-2">
          When you read a licensed translation, Context loads API.Bible’s Fair Use Management System (FUMS), which reports
          which passages were viewed using anonymous device and session identifiers, so publishers can see how their text is
          used. Nothing is reported when you read the public-domain or Amharic texts.
        </p>
      </main>
    </div>
  );
}
