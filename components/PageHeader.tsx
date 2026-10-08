import Link from "next/link";
import { Wordmark } from "@/components/ui";
import { AccountButton } from "@/components/AccountButton";
import type { Viewer } from "@/lib/user";

/** Header for the reader's own pages (notebook, profile). */
export function PageHeader({ viewer }: { viewer: Viewer }) {
  return (
    <header className="border-b border-rule">
      <div className="mx-auto flex h-20 max-w-4xl items-center justify-between gap-4 px-5 sm:px-10">
        <Wordmark />
        <nav className="flex items-center gap-1 text-[0.95rem] sm:gap-3">
          <Link href="/study" className="rounded-lg px-2 py-1.5 text-ink-2 hover:text-ink">Study</Link>
          <Link href="/notebook" className="rounded-lg px-2 py-1.5 text-ink-2 hover:text-ink">Notebook</Link>
          <AccountButton viewer={{ signedIn: viewer.signedIn, name: viewer.name, image: viewer.image }} />
        </nav>
      </div>
    </header>
  );
}
