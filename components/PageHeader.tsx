import Link from "next/link";
import { cookies } from "next/headers";
import { Wordmark } from "@/components/ui";
import { AccountButton } from "@/components/AccountButton";
import { LAST_STUDY_COOKIE, parseLastStudy } from "@/lib/lastStudy";
import type { Viewer } from "@/lib/user";

/** Header for the reader's own pages (notebook, profile), with a way back to the passage they were reading. */
export async function PageHeader({ viewer }: { viewer: Viewer }) {
  const back = parseLastStudy((await cookies()).get(LAST_STUDY_COOKIE)?.value);
  return (
    <header className="border-b border-rule">
      <div className="mx-auto flex h-20 max-w-4xl items-center justify-between gap-4 px-5 sm:px-10">
        <Wordmark />
        <nav className="flex items-center gap-1 text-[0.95rem] sm:gap-3">
          {back ? (
            <Link href={back.href} className="rounded-lg px-2 py-1.5 text-accent hover:text-ink">
              ← <span className="hidden sm:inline">Back to </span>{back.label}
            </Link>
          ) : (
            <Link href="/study" className="rounded-lg px-2 py-1.5 text-ink-2 hover:text-ink">Study</Link>
          )}
          <Link href="/notebook" className="rounded-lg px-2 py-1.5 text-ink-2 hover:text-ink">Notebook</Link>
          <AccountButton viewer={{ signedIn: viewer.signedIn, name: viewer.name, image: viewer.image }} />
        </nav>
      </div>
    </header>
  );
}
