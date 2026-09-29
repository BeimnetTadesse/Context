"use client";

import Link from "next/link";
import Script from "next/script";
import { useEffect, useState } from "react";
import { isLicensedVersion, versionInfo, type VersionCode } from "@/lib/versions";

export interface LicensedText {
  verses: Record<number, string>;
  copyright: string;
}

declare global {
  interface Window {
    fums?: (...args: unknown[]) => void;
    fumsData?: unknown[];
  }
}

// API.Bible's Fair Use Management System: required for web apps showing their licensed text.
// Queue calls before the script loads (their documented pattern).
function trackView(token: string | null) {
  if (!token) return;
  window.fumsData = window.fumsData || [];
  window.fums = window.fums || function (...args: unknown[]) { window.fumsData!.push(args); };
  window.fums("trackView", token);
}

/** Fetches licensed chapters (NIV/NLT/NASB) the reader has chosen, reporting each view to FUMS. */
export function useLicensed(codes: VersionCode[], bookSlug: string, chapter: number) {
  const wanted = codes.filter((c) => isLicensedVersion(c));
  const key = `${bookSlug}/${chapter}`;
  const [store, setStore] = useState<{ key: string; texts: Record<string, LicensedText>; failed: string[] }>({ key, texts: {}, failed: [] });
  const current = store.key === key ? store : { key, texts: {}, failed: [] as string[] };

  useEffect(() => {
    let live = true;
    for (const code of wanted) {
      if (current.texts[code] || current.failed.includes(code)) continue;
      fetch(`/api/licensed/${code}/${bookSlug}/${chapter}`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d: LicensedText & { fumsToken: string | null }) => {
          if (!live) return;
          trackView(d.fumsToken);
          setStore((s) => ({ key, texts: { ...(s.key === key ? s.texts : {}), [code]: { verses: d.verses, copyright: d.copyright } }, failed: s.key === key ? s.failed : [] }));
        })
        .catch(() => live && setStore((s) => ({ key, texts: s.key === key ? s.texts : {}, failed: [...(s.key === key ? s.failed : []), code] })));
    }
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted.join(","), key]);

  return { texts: current.texts, failed: current.failed, active: wanted.length > 0 };
}

/** The FUMS script (only mounted while licensed text is on screen) and the required notices. */
export function LicensedNotices({ codes, texts }: { codes: VersionCode[]; texts: Record<string, LicensedText> }) {
  const shown = codes.filter((c) => isLicensedVersion(c));
  if (!shown.length) return null;
  return (
    <>
      <Script src="https://pkg.api.bible/fumsV3.min.js" strategy="afterInteractive" />
      <div className="mt-10 space-y-2 border-t border-rule pt-4 text-[0.75rem] leading-relaxed text-muted">
        {shown.map((c) => (
          <p key={c}>
            <span className="font-mono text-accent">{versionInfo(c).short}</span> — {texts[c]?.copyright ?? versionInfo(c).name}
          </p>
        ))}
        <p>
          Licensed text provided by{" "}
          <a href="https://api.bible" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-ink">API.Bible</a>
          {" "}for reading only: it can’t be copied here and is never used by Context’s AI.{" "}
          <Link href="/copyright" className="underline underline-offset-2 hover:text-ink">Full copyright information</Link>
        </p>
      </div>
    </>
  );
}
