"use client";

import { useRouter } from "next/navigation";

/**
 * Shown where the research assistant would be, for readers who aren't signed in.
 * Reading, versions, commentaries and notes stay open; only the AI assistant needs an account.
 */
export function SignInToUse({ what = "the research assistant", compact = false }: { what?: string; compact?: boolean }) {
  const router = useRouter();
  // Come back to the same chapter and step after signing in.
  const go = () => router.push(`/signin?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
  return (
    <div className={`rounded-xl border border-rule bg-paper-2/60 ${compact ? "p-4" : "p-5"}`}>
      <p className="font-serif text-[1.1rem]">Sign in to use {what}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-2">
        It’s free. Reading, every version, the commentators and your notes stay open without an account; signing in
        for the AI keeps the free service available for everyone.
      </p>
      <button type="button" onClick={go} className="mt-3 rounded-lg bg-ink px-4 py-2 text-sm text-paper hover:bg-ink-2">
        Sign in with Google
      </button>
    </div>
  );
}
