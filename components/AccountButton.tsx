"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOutAction } from "@/app/actions";

export interface ViewerInfo {
  signedIn: boolean;
  name: string | null;
  image: string | null;
}

export function AccountButton({ viewer }: { viewer: ViewerInfo }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  if (!viewer.signedIn) {
    return (
      <Link href={`/signin?next=${encodeURIComponent(path)}`} className="rounded-xl px-3 py-2 text-[0.95rem] text-ink-2 hover:bg-paper-2 hover:text-ink">
        Sign in
      </Link>
    );
  }
  const initial = (viewer.name ?? "?").trim().charAt(0).toUpperCase();
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="grid h-9 w-9 place-items-center overflow-hidden rounded-full border border-rule bg-card" aria-label="Account">
        {viewer.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={viewer.image} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
        ) : (
          <span className="font-serif text-lg">{initial}</span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-50 w-56 rounded-xl border border-rule bg-card p-2 shadow-lg">
          <p className="px-3 py-2 text-sm text-muted">{viewer.name}</p>
          <Link href="/notebook" className="block rounded-lg px-3 py-2 text-sm hover:bg-paper-2">Notebook</Link>
          <form action={signOutAction}>
            <input type="hidden" name="next" value={path} />
            <button className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-paper-2">Sign out</button>
          </form>
        </div>
      )}
    </div>
  );
}
