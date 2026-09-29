import Link from "next/link";
import { Dot, LabelPill, Wordmark } from "@/components/ui";
import { sql } from "@/lib/db";
import { LABEL_INFO, type Label } from "@/lib/labels";
import { STEPS } from "@/lib/steps";

async function webVerse(osis: string, chapter: number, verse: number) {
  const [r] = await sql<{ text: string }[]>`
    select t.text from verses v join books b on b.id = v.book_id
    join verse_texts t on t.ord = v.ord and t.translation_code = 'WEB'
    where b.osis = ${osis} and v.chapter = ${chapter} and v.verse = ${verse}`;
  return r?.text ?? "";
}

const SAYS: [string, string][] = [
  ["Paul calls himself a prisoner on behalf of the Gentiles.", "3:1"],
  ["The mystery was hidden for ages and is now revealed.", "3:5, 9"],
  ["He prays they would know a love that surpasses knowledge.", "3:19"],
];
const BRINGS: [string, Label][] = [
  ["He wrote from a Roman prison.", "scholarly"],
  ["The four dimensions picture the cross.", "tradition"],
  ["This is about my own sense of belonging.", "personal"],
];
const EXAMPLES: Record<Label, string> = {
  explicit: "Paul bows his knees to the Father (3:14).",
  inference: "Paul was physically imprisoned (3:1; 4:1; 6:20).",
  historical: "The earliest copies omit “in Ephesus” (1:1).",
  scholarly: "“Powers” includes social and political structures.",
  tradition: "The four dimensions picture the cross.",
  personal: "“I treat some people as outsiders.”",
};

export default async function Landing() {
  const [v6, v4] = await Promise.all([webVerse("Eph", 3, 6), webVerse("Eph", 3, 4)]);
  const [lead, compounds, rest] = splitCompounds(v6);

  return (
    <div className="bg-paper">
      <header className="border-b border-rule">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-10">
          <Wordmark />
          <nav className="hidden gap-10 text-[1.02rem] text-ink-2 md:flex">
            <a href="#method" className="hover:text-ink">Method</a>
            <a href="#provenance" className="hover:text-ink">Provenance</a>
            <a href="#principles" className="hover:text-ink">Principles</a>
          </nav>
          <Link href="/study" className="rounded-xl border border-ink px-5 py-2.5 text-[1.02rem] hover:bg-ink hover:text-paper">
            Open workspace
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-14 sm:px-10 lg:min-h-[calc(100dvh-5rem)] lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:py-10">
        <div>
          <p className="eyebrow text-accent">A study workspace for Scripture</p>
          <h1 className="mt-6 font-serif text-[clamp(2.8rem,min(6.4vw,8.6vh),5.2rem)] leading-[1.02] tracking-tight">
            Slow down.
            <br />
            Read deeply.
            <br />
            <em className="text-accent">Understand the context.</em>
          </h1>
          <p className="mt-7 max-w-xl text-[clamp(1.05rem,1.9vh,1.2rem)] leading-relaxed text-ink-2">
            Context takes you through a passage the way a careful reader would: the text first, then its structure,
            history, language, and the range of credible interpretation. Every claim shows where it comes from.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-8">
            <Link href="/study" className="rounded-xl bg-ink px-7 py-4 text-lg text-paper hover:bg-ink-2">
              Choose a passage &nbsp;→
            </Link>
            <a href="#method" className="text-lg underline underline-offset-4">How the method works</a>
          </div>
        </div>

        <div className="rounded-3xl border border-rule bg-card p-7 shadow-[0_40px_80px_-50px_rgba(60,40,20,0.45)] sm:p-9">
          <div className="eyebrow flex justify-between text-muted">
            <span>Ephesians 3:6</span>
            <span>WEB</span>
          </div>
          <p className="mt-6 font-serif text-[clamp(1.25rem,2.6vh,1.6rem)] leading-[1.75]">
            <sup className="mr-1 font-sans text-xs text-muted">6</sup>
            {lead}
            <span className="underline decoration-[var(--l-explicit)] decoration-2 underline-offset-[6px]">{compounds}</span>
            <sup className="ml-0.5 font-sans text-xs text-accent">c</sup>
            {rest}
          </p>
          <div className="mt-6 space-y-6 border-t border-rule pt-6">
            <div className="flex gap-6">
              <span className="font-mono text-sm text-accent">c</span>
              <div className="space-y-3">
                <LabelPill label="explicit" />
                <p className="font-serif text-lg leading-snug">
                  Three parallel compounds, each beginning with <em>syn-</em>, “together with”.
                </p>
                <LabelPill label="historical" />
                <p className="font-serif text-lg leading-snug">
                  σύσσωμος is glossed “of the same body” in Abbott-Smith’s lexicon.
                </p>
                <div className="flex gap-2 font-mono text-sm">
                  <span className="rounded-md border border-rule px-2.5 py-1">[SBLGNT]</span>
                  <span className="rounded-md border border-rule px-2.5 py-1">[Abbott-Smith]</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Signature question */}
      <section className="bg-night text-night-ink">
        <div className="mx-auto max-w-7xl px-5 py-20 lg:py-24 sm:px-10">
          <p className="eyebrow text-[#d7b8a9]">The signature question</p>
          <h2 className="mt-6 font-serif text-[clamp(2.4rem,5vw,4.2rem)]">Two questions, kept apart.</h2>
          <div className="mt-16 grid gap-14 lg:grid-cols-2">
            <Column title="What does the text actually say?">
              {SAYS.map(([s, ref]) => (
                <Row key={s} text={s}>
                  <Dot label="explicit" /> <span className="font-mono text-sm text-night-ink/70">{ref}</span>
                </Row>
              ))}
            </Column>
            <Column title="What am I bringing into the text?">
              {BRINGS.map(([s, l]) => (
                <Row key={s} text={s}>
                  <Dot label={l} /> <span className="eyebrow text-night-ink/70">{LABEL_INFO[l].short}</span>
                </Row>
              ))}
            </Column>
          </div>
          <p className="mt-16 max-w-2xl text-lg leading-relaxed text-night-ink/70">
            Highlight any phrase in the workspace and ask <span className="text-night-ink">Text or Assumption?</span>{" "}
            Context sorts what is on the page from what readers commonly bring to it, and shows the evidence for each.
          </p>
        </div>
      </section>

      {/* Method */}
      <section id="method" className="mx-auto max-w-7xl scroll-mt-10 px-5 py-20 lg:py-24 sm:px-10">
        <div className="flex flex-wrap items-end justify-between gap-8">
          <div>
            <p className="eyebrow text-accent">Method</p>
            <h2 className="mt-5 font-serif text-[clamp(2.2rem,4.2vw,3.6rem)]">Seven steps, in order.</h2>
          </div>
          <p className="max-w-md text-lg text-ink-2">Interpretation comes sixth. Reflection comes last. The order is the point.</p>
        </div>
        <div className="mt-14 grid grid-cols-2 gap-10 border-t border-ink pt-10 sm:grid-cols-4 lg:grid-cols-7">
          {STEPS.map((s) => (
            <div key={s.key}>
              <p className="font-mono text-sm text-accent">{s.numeral}</p>
              <p className="mt-3 font-serif text-2xl">{s.name}</p>
              <p className="mt-2 text-ink-2">{s.tagline}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Provenance */}
      <section id="provenance" className="scroll-mt-10 bg-paper-2">
        <div className="mx-auto grid max-w-7xl gap-16 px-5 py-20 lg:py-24 sm:px-10 lg:grid-cols-2">
          <div>
            <p className="eyebrow text-accent">Provenance</p>
            <h2 className="mt-5 font-serif text-[clamp(2.2rem,4.2vw,3.6rem)]">Every claim is labelled.</h2>
            <p className="mt-8 max-w-md text-lg leading-relaxed text-ink-2">
              Six categories, used consistently across the workspace. The label tells you how much weight a statement
              can bear before you decide what to do with it.
            </p>
          </div>
          <ul className="divide-y divide-rule border-y border-rule">
            {(Object.keys(EXAMPLES) as Label[]).map((l) => (
              <li key={l} className="flex gap-5 py-6">
                <span className="pt-2.5"><Dot label={l} size={10} /></span>
                <div>
                  <p>
                    <span className="font-serif text-2xl">{LABEL_INFO[l].name}</span>
                    <span className="ml-4 text-ink-2">{LABEL_INFO[l].meaning}</span>
                  </p>
                  <p className="mt-2 font-serif text-lg italic text-muted">e.g. {EXAMPLES[l]}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Principles */}
      <section id="principles" className="mx-auto max-w-7xl scroll-mt-10 px-5 py-20 lg:py-24 sm:px-10">
        <p className="eyebrow text-accent">Principles</p>
        <h2 className="mt-5 font-serif text-[clamp(2.2rem,4.2vw,3.6rem)]">A research assistant, not an authority.</h2>
        <div className="mt-16 grid gap-12 md:grid-cols-3">
          {[
            ["It cites.", "Each explanation links to the text, manuscript, lexicon, or commentary it relies on. “Show me why” opens the chain."],
            ["It shows disagreement.", "Where credible scholars differ, the main views sit side by side, with who holds them and why."],
            ["It doesn’t speak for God.", "Context explains what the text says and how it has been read. What it means for you is left to you."],
          ].map(([t, d]) => (
            <div key={t} className="border-t border-ink pt-8">
              <h3 className="font-serif text-3xl">{t}</h3>
              <p className="mt-4 text-lg leading-relaxed text-ink-2">{d}</p>
            </div>
          ))}
        </div>

        <div className="mt-28 border-t border-rule pt-24 text-center">
          <p className="mx-auto max-w-3xl font-serif text-[clamp(1.8rem,3.4vw,2.8rem)] italic leading-snug">“{trimQuote(v4)}”</p>
          <p className="eyebrow mt-8 text-muted">Ephesians 3:4 · WEB</p>
          <Link href="/study" className="mt-10 inline-block rounded-xl bg-ink px-7 py-4 text-lg text-paper hover:bg-ink-2">
            Open the workspace →
          </Link>
        </div>
      </section>

      <footer className="border-t border-rule">
        <div className="mx-auto max-w-7xl px-5 py-10 text-sm text-muted sm:px-10">
          Texts: World English Bible (public domain) · Amharic Bible © 1962, 2003 United Bible Societies, used with the
          permission terms of the Bible Society of Ethiopia · SBL Greek New Testament (CC BY 4.0) · Greek data and lexicon
          from STEP Bible (www.STEPBible.org, CC BY 4.0) · Cross-references from OpenBible.info (CC BY).{" "}
          <Link href="/sources" className="underline underline-offset-4 hover:text-ink">Source library →</Link> ·{" "}
          <Link href="/audit" className="underline underline-offset-4 hover:text-ink">How references are checked →</Link> ·{" "}
          <Link href="/copyright" className="underline underline-offset-4 hover:text-ink">Copyright</Link> ·{" "}
          <Link href="/privacy" className="underline underline-offset-4 hover:text-ink">Privacy</Link>
        </div>
      </footer>
    </div>
  );
}

function Column({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="border-b border-night-ink/15 pb-5 font-serif text-2xl italic sm:text-3xl">{title}</h3>
      <ul>{children}</ul>
    </div>
  );
}

function Row({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <li className="flex items-center justify-between gap-6 border-b border-night-ink/15 py-6 font-serif text-xl">
      {text}
      <span className="flex shrink-0 items-center gap-2">{children}</span>
    </li>
  );
}

// Underline "fellow heirs … fellow partakers" if present in the WEB text.
function splitCompounds(v: string): [string, string, string] {
  const start = v.indexOf("fellow heirs");
  const endWord = "fellow partakers";
  const end = v.indexOf(endWord);
  if (start < 0 || end < 0) return [v, "", ""];
  return [v.slice(0, start), v.slice(start, end + endWord.length), v.slice(end + endWord.length)];
}

function trimQuote(v: string) {
  const i = v.indexOf("understanding");
  return i > 0 ? v.slice(0, i + "understanding".length) + "…" : v;
}
