import Link from "next/link";
import { Wordmark } from "@/components/ui";

const NAV = [
  { href: "/method", name: "Method" },
  { href: "/provenance", name: "Provenance" },
  { href: "/principles", name: "Principles" },
] as const;

/** Header for the public pages: the landing page and the Method, Provenance and Principles pages. */
export function SiteHeader({ current }: { current?: (typeof NAV)[number]["href"] }) {
  return (
    <header className="border-b border-rule">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-10">
        <Wordmark />
        <nav className="hidden gap-10 text-[1.02rem] text-ink-2 md:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} aria-current={current === n.href ? "page" : undefined}
              className={current === n.href ? "text-ink underline decoration-accent decoration-2 underline-offset-8" : "hover:text-ink"}>
              {n.name}
            </Link>
          ))}
        </nav>
        <Link href="/study" className="rounded-xl border border-ink px-5 py-2.5 text-[1.02rem] hover:bg-ink hover:text-paper">
          Open workspace
        </Link>
      </div>
    </header>
  );
}
