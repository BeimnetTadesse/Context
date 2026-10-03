"use client";

import Link from "next/link";
import Script from "next/script";
import { useEffect, useRef, useState } from "react";
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

/**
 * Fetches the licensed chapters (NIV, NASV, AMP…) the reader has chosen, reporting API.Bible views to FUMS.
 * Results are stored by "chapter:version", so a late answer for a chapter the reader has left is harmless,
 * and turning on a second version never cancels or repeats the first one's request.
 */
export function useLicensed(codes: VersionCode[], bookSlug: string, chapter: number) {
  const key = `${bookSlug}/${chapter}`;
  const wanted = codes.filter((c) => isLicensedVersion(c));
  const wantedKey = wanted.join(",");
  const [texts, setTexts] = useState<Record<string, LicensedText>>({});
  const [failed, setFailed] = useState<string[]>([]);
  const started = useRef(new Set<string>()); // "chapter:version" requested during this visit to the chapter

  useEffect(() => {
    // A new chapter is a new view: forget other chapters' requests so returning re-fetches (and re-reports).
    for (const id of started.current) if (!id.startsWith(`${key}:`)) started.current.delete(id);
    for (const code of wantedKey ? wantedKey.split(",") : []) {
      const id = `${key}:${code}`;
      if (started.current.has(id)) continue;
      started.current.add(id);
      fetch(`/api/licensed/${code}/${bookSlug}/${chapter}`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d: LicensedText & { fumsToken: string | null }) => {
          trackView(d.fumsToken);
          const text = { verses: d.verses, spans: d.spans ?? {}, moved: d.moved ?? {}, publisher: d.publisher ?? null, copyright: d.copyright, trademark: d.trademark ?? null };
          setTexts((t) => ({ ...t, [id]: text }));
          setFailed((f) => f.filter((x) => x !== id)); // a retry that works clears an earlier failure
        })
        .catch(() => setFailed((f) => [...f, id]));
    }
  }, [wantedKey, key, bookSlug, chapter]);

  return {
    texts: Object.fromEntries(wanted.flatMap((c) => (texts[`${key}:${c}`] ? [[c, texts[`${key}:${c}`]]] : []))) as Record<string, LicensedText>,
    failed: wanted.filter((c) => failed.includes(`${key}:${c}`)),
    active: wanted.length > 0,
  };
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
