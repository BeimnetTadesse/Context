"use client";

import type { GreekWord, VerseRow } from "@/lib/data/chapter";
import type { ReadPrefs, VersionCode } from "@/lib/versions";
import type { LicensedText } from "./Licensed";
import { CompareView } from "./read/CompareView";
import { FlowingView } from "./read/FlowingView";
import { GreekView } from "./read/GreekView";
import type { PhraseMark } from "./read/marks";

export type { PhraseMark };

/** The Read step's text: Greek interlinear, several versions side by side, or one version flowing. */
export function ReadStep({
  verses,
  prefs,
  selected,
  onSelectWord,
  marks = [],
  trail = null,
  onVerse,
  activeVerse = null,
  licensed = {},
  licensedFailed = [],
}: {
  verses: VerseRow[];
  prefs: ReadPrefs;
  licensed?: Record<string, LicensedText>;
  licensedFailed?: string[];
  selected: GreekWord | null;
  onSelectWord: (w: GreekWord) => void;
  marks?: PhraseMark[];
  trail?: string | null;
  onVerse?: (v: number) => void;
  activeVerse?: number | null;
}) {
  if (prefs.greek) return <GreekView verses={verses} selected={selected} onSelectWord={onSelectWord} />;

  // Provenance underlines are anchored to the WEB wording, so they only show on WEB.
  const markFor = (v: VerseRow, code: VersionCode) => (code === "WEB" ? marks.filter((m) => m.ord === v.ord) : []);
  const shared = { verses, licensed, licensedFailed, markFor, trail, onVerse, activeVerse };
  return prefs.compare.length ? <CompareView {...shared} prefs={prefs} /> : <FlowingView {...shared} code={prefs.primary} />;
}
