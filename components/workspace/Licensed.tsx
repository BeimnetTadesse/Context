"use client";

import Link from "next/link";
import Script from "next/script";
import { useEffect, useState } from "react";
import { isLicensedVersion, isYouVersion, versionInfo, type VersionCode } from "@/lib/versions";

export interface LicensedText {
  verses: Record<number, string>;
  /** Combined verses: first → last. */
  spans: Record<number, number>;
  /** Verses printed here by this version that Context places elsewhere: verse → "14:24". */
  moved: Record<number, string>;
  publisher: { name: string; url: string } | null;
  copyright: string;
  trademark: string | null;
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

/** Fetches licensed chapters (NIV/NLT/NASB/NASV) the reader has chosen, reporting API.Bible views to FUMS. */
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
          const text = { verses: d.verses, spans: d.spans ?? {}, moved: d.moved ?? {}, publisher: d.publisher ?? null, copyright: d.copyright, trademark: d.trademark ?? null };
          setStore((s) => ({ key, texts: { ...(s.key === key ? s.texts : {}), [code]: text }, failed: s.key === key ? s.failed : [] }));
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

const link = "underline underline-offset-2 hover:text-ink";

/** The FUMS script (only while API.Bible text is on screen) and each version's required notices. */
export function LicensedNotices({ codes, texts }: { codes: VersionCode[]; texts: Record<string, LicensedText> }) {
  const shown = codes.filter((c) => isLicensedVersion(c));
  if (!shown.length) return null;
  const apiBible = shown.some((c) => !isYouVersion(c));
  const youVersion = shown.some((c) => isYouVersion(c));
  return (
    <>
      {apiBible && <Script src="https://pkg.api.bible/fumsV3.min.js" strategy="afterInteractive" />}
      <div className="mt-10 space-y-2 border-t border-rule pt-4 text-[0.75rem] leading-relaxed text-muted">
        {shown.map((c) => (
          <div key={c}>
            <p className="whitespace-pre-line">
              <span className="font-mono text-accent">{versionInfo(c).short}</span> — {texts[c]?.copyright ?? versionInfo(c).name}
            </p>
            {texts[c]?.trademark && <p className="mt-1">{texts[c].trademark}</p>}
            {texts[c]?.publisher && (
              <p className="mt-1">
                Published by{" "}
                <a href={texts[c].publisher!.url} target="_blank" rel="noreferrer" className={link}>
                  {texts[c].publisher!.name} ({texts[c].publisher!.url.replace(/^https:\/\/(www\.)?/, "")})
                </a>
              </p>
            )}
          </div>
        ))}
        <p>
          Licensed text provided by{" "}
          {apiBible && <a href="https://api.bible" target="_blank" rel="noreferrer" className={link}>API.Bible</a>}
          {apiBible && youVersion && " and "}
          {youVersion && <a href="https://platform.youversion.com" target="_blank" rel="noreferrer" className={link}>the YouVersion Platform</a>}
          {" "}for reading only: it can’t be copied here and is never used by Context’s AI.{" "}
          <Link href="/copyright" className={link}>Full copyright information</Link>
        </p>
      </div>
    </>
  );
}
