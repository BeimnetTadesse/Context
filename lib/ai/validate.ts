// The guard between the model and the database. Pure functions: no I/O, fully unit-tested.
// Rules (the "source policy" in code):
//  1. A citation must point at evidence we actually handed the model. Unknown ids are removed.
//  2. A claim left with no citations is dropped — no claim without provenance.
//  3. "explicit" must cite at least one verse; otherwise it is downgraded to "inference".
//  4. "historical" must cite lexicon evidence (our only historical data); otherwise it is dropped.
//  5. A quoted phrase must appear word-for-word in the cited verse, or the quote is removed.
import type { Label } from "@/lib/labels";

export interface PackLike {
  byId: Map<string, unknown>;
  verseText: Map<number, string>;
  ordById: Map<string, number>;
}

export interface DraftClaim {
  label: Label;
  statement: string;
  cites: string[];
  quote?: string | null;
}

export interface CheckedClaim extends DraftClaim {
  anchors: { ord: number; quote: string | null }[];
}

export interface ValidationIssue {
  statement: string;
  problem: string;
}

const norm = (s: string) => s.replace(/[“”"‘’']/g, "'").replace(/\s+/g, " ").trim().toLowerCase();

export function checkClaim(draft: DraftClaim, pack: PackLike, issues: ValidationIssue[]): CheckedClaim | null {
  const cites = [...new Set(draft.cites)];
  const unknown = cites.filter((c) => !pack.byId.has(c));
  if (unknown.length) issues.push({ statement: draft.statement, problem: `removed unknown citations: ${unknown.join(", ")}` });
  const known = cites.filter((c) => pack.byId.has(c));

  if (known.length === 0) {
    issues.push({ statement: draft.statement, problem: "dropped: no valid citation" });
    return null;
  }

  let label = draft.label;
  const verseCites = known.filter((c) => c.startsWith("V:"));
  if (label === "explicit" && verseCites.length === 0) {
    issues.push({ statement: draft.statement, problem: "explicit without a verse citation → inference" });
    label = "inference";
  }
  if (label === "historical" && !known.some((c) => c.startsWith("L:"))) {
    issues.push({ statement: draft.statement, problem: "dropped: historical claim without lexical/historical evidence" });
    return null;
  }

  // Anchor to verses; keep the quote only where it truly appears.
  let quote = draft.quote?.trim() || null;
  const anchors = verseCites.map((c) => {
    const ord = pack.ordById.get(c)!;
    const text = pack.verseText.get(ord) ?? "";
    const hit = quote && norm(text).includes(norm(quote)) ? quote : null;
    return { ord, quote: hit };
  });
  if (quote && !anchors.some((a) => a.quote)) {
    issues.push({ statement: draft.statement, problem: `quote not found in cited verses: “${quote}”` });
    quote = null;
  }

  return { label, statement: draft.statement.trim(), cites: known, quote, anchors };
}

export function checkClaims(drafts: DraftClaim[], pack: PackLike, issues: ValidationIssue[]) {
  return drafts.map((d) => checkClaim(d, pack, issues)).filter((c): c is CheckedClaim => c !== null);
}

/** Does the text of an answer try to speak for God or collapse interpretation into fact? */
const AUTHORITY_PATTERNS = [/\bgod is telling you\b/i, /\bthe bible means\b/i, /\bgod wants you to\b/i, /\bthis verse means\b/i];
export const soundsAuthoritative = (s: string) => AUTHORITY_PATTERNS.some((p) => p.test(s));
