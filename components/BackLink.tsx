"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

/** "← Back": returns to the previous page on this site, or to the home page if the visitor arrived directly. */
export function BackLink() {
  const router = useRouter();
  return (
    <Link
      href="/"
      onClick={(e) => {
        const fromHere = document.referrer && new URL(document.referrer).origin === window.location.origin;
        if (fromHere && window.history.length > 1) {
          e.preventDefault();
          router.back();
        }
      }}
      className="inline-flex items-center gap-2 text-ink-2 hover:text-accent"
    >
      ← Back
    </Link>
  );
}
