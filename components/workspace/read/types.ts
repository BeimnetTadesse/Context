import type { VerseRow } from "@/lib/data/chapter";
import type { VersionCode } from "@/lib/versions";
import type { LicensedText } from "../Licensed";
import type { PhraseMark } from "./marks";

/** What the compare and flowing views share. */
export interface ReadViewProps {
  verses: VerseRow[];
  licensed: Record<string, LicensedText>;
  licensedFailed: string[];
  /** Provenance underlines for a verse in a version (WEB only). */
  markFor: (v: VerseRow, code: VersionCode) => PhraseMark[];
  trail: string | null;
  onVerse?: (v: number) => void;
  activeVerse: number | null;
}
