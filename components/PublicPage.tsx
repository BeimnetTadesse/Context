import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";

type Href = "/method" | "/provenance" | "/principles";

/** Shell for the Method, Provenance and Principles pages: header, a title block, the content, and a way on. */
export function PublicPage({ current, eyebrow, title, intro, children, next }: {
  current: Href; eyebrow: string; title: React.ReactNode; intro: string; children: React.ReactNode;
  next: { href: Href; name: string };
}) {
  return (
    <div className="min-h-dvh bg-paper">
      <SiteHeader current={current} />
      <main className="mx-auto max-w-5xl px-5 py-16 sm:px-10 lg:py-24">
        <p className="eyebrow text-accent">{eyebrow}</p>
        <h1 className="mt-5 font-serif text-[clamp(2.6rem,5vw,4.2rem)] leading-[1.05]">{title}</h1>
        <p className="mt-6 max-w-2xl text-xl leading-relaxed text-ink-2">{intro}</p>
        <div className="mt-16">{children}</div>
        <div className="mt-24 flex flex-wrap items-center justify-between gap-6 border-t border-rule pt-10">
          <Link href="/study" className="rounded-xl bg-ink px-7 py-4 text-lg text-paper hover:bg-ink-2">Choose a passage →</Link>
          <Link href={next.href} className="text-lg underline underline-offset-4 hover:text-accent">Next: {next.name} →</Link>
        </div>
      </main>
      <footer className="border-t border-rule">
        <div className="mx-auto flex max-w-5xl flex-wrap gap-x-5 gap-y-2 px-5 py-10 text-sm text-muted sm:px-10">
          <Link href="/" className="hover:text-ink">Home</Link>
          <Link href="/sources" className="hover:text-ink">Source library</Link>
          <Link href="/audit" className="hover:text-ink">How references are checked</Link>
          <Link href="/copyright" className="hover:text-ink">Copyright</Link>
          <Link href="/privacy" className="hover:text-ink">Privacy</Link>
        </div>
      </footer>
    </div>
  );
}
