import "server-only";
import * as z from "zod/v4";
import { sql } from "@/lib/db";
import type { Book } from "@/lib/bible/books";
import { currentModel, generateStructured, recordValidation } from "@/lib/ai/client";
import { chapterEvidence, renderEvidence, type EvidencePack } from "@/lib/ai/evidence";
import { checkClaim, restatesVerse, soundsAuthoritative, stripIds, type CheckedClaim, type ValidationIssue } from "@/lib/ai/validate";
import { writeClaim } from "./generate";

// Study notes: the underlined phrases in the Read step. Regenerated on their own (the rest of the chapter study is
// untouched) so that each one points at something a careful reader might miss, instead of restating the verse.
export const NOTES_VERSION = "2026-10-26.3"; // .2 name commentators; .3 one note per phrase

const KINDS = ["repetition", "contrast", "echo", "word", "shift", "structure", "background"] as const;
const NOTE_LABELS = ["explicit", "inference", "historical", "scholarly"] as const;

const NotesSchema = z.object({
  notes: z.array(
    z.object({
      kind: z.enum(KINDS),
      label: z.enum(NOTE_LABELS),
      statement: z.string().describe("what to notice and why it matters, in one or two sentences"),
      quote: z.string().describe("exact words from the FIRST cited verse (WEB): the phrase that will be underlined"),
      cites: z.array(z.string()).describe("evidence ids; the verse with the quote first"),
      excerpt: z.string().nullable().describe("REQUIRED when citing a K: commentary id: the commentator's exact words (5–30 words); otherwise null"),
    }),
  ),
});

const SYSTEM = `You write the study notes for Context, a Bible study workspace. A study note underlines a phrase in a New Testament chapter and tells the reader something about it that a careful reader might otherwise miss. You are not a pastor or an authority.

You will receive an evidence pack. Every note must cite evidence ids from that pack and nothing else. Do not name sources that are not in the pack.

Write 8–12 notes for the chapter, spread across it, each one of these kinds:
- repetition: a word or idea that recurs in the chapter (cite every verse where it recurs).
- contrast: two things the chapter sets against each other (cite both verses).
- echo: an Old Testament passage or earlier scene this recalls (cite the X: cross-reference).
- word: a Greek word whose range of meaning matters here (cite its L: lexicon id). Never claim it "really means" something translations missed.
- shift: a change of speaker, scene, time, audience or tone (cite the verses on both sides).
- structure: how the passage is built: a frame, a sequence, a turning point (cite the verses involved).
- background: something about the setting that the text assumes (cite an academic commentator's K: id with their exact words in "excerpt", or a lexicon entry).

Rules:
- NEVER restate or summarise the verse. "Nicodemus is a Pharisee" on a verse that says so is not a note. If the reader learns nothing by reading your note after the verse, leave it out.
- "quote" must be copied exactly from the first cited verse (World English Bible); keep it short (3–12 words).
- Labels: explicit = a pattern plainly on the page across two or more verses (cite them all); inference = follows from the text but is not stated; historical = from lexical or historical evidence (L: id, or an academic commentator's K: id with excerpt); scholarly = a reasoned reading others dispute, phrased as a view and attributed ("Calvin reads…").
- At most a third of the notes may be explicit. Use inference, historical and scholarly where the evidence allows.
- Commentators are Protestant voices (Calvin, Henry, Gill, Clarke, Jamieson-Fausset-Brown, Tyndale). Whenever a note relies on one, the note itself must name them ("Clarke notes…", "Calvin reads…") and copy their exact words into "excerpt". Never write "scholars note" or state a commentator's view as plain fact. A commentator's reading is "scholarly"; use "historical" only for lexical evidence or a commentator's report of historical fact.
- Never write "God is telling you", "the Bible means", or "this verse means". Say "the passage", "one reading holds".
- One or two sentences per note.`;

const ReviewSchema = z.object({
  verdicts: z.array(
    z.object({
      note: z.number(),
      verdict: z.enum(["supported", "partial", "unsupported"]),
      insight: z.enum(["new", "restates"]).describe("new: tells a careful reader something they would likely miss; restates: only repeats what the verse says"),
      reason: z.string(),
    }),
  ),
});

const REVIEW_SYSTEM = `You are an independent second reader checking study notes on a Bible chapter. For each numbered note you get its label, the underlined phrase, and the exact evidence it cites.

For each note give:
- verdict: supported (the evidence clearly supports the note and its label), partial (broadly right but overstated or the label is too strong), or unsupported (the evidence does not say this, or the note adds facts not in the evidence).
- insight: "new" if the note tells a careful reader something they would likely miss on a first reading; "restates" if it only repeats or paraphrases what the verse already says.
Judge only from the evidence given. Be strict but fair.`;

type Candidate = { kind: (typeof KINDS)[number]; claim: CheckedClaim };

/** How a commentator (by source key) must be named in a note that relies on them. */
const COMMENTATOR_NAMES: Record<string, RegExp> = {
  Calvin: /\bCalvin\b/, Henry: /\bHenry\b/, Gill: /\bGill\b/, Clarke: /\bClarke\b/,
  JFB: /\b(Jamieson|Fausset|Brown|JFB)\b/, Tyndale: /\bTyndale\b/,
};

export async function generateStudyNotes(book: Book, chapter: number) {
  const pack = await chapterEvidence(book, chapter, { lexicon: 20, xrefs: 30, claims: false, commentary: 24000 });
  const input = `Chapter: ${book.name} ${chapter} (World English Bible, with SBL Greek).\n\n<evidence_pack>\n${renderEvidence(pack)}\n</evidence_pack>\n\nWrite the study notes for this chapter.`;
  const { output, runId } = await generateStructured({
    kind: "study_notes", schema: NotesSchema, system: SYSTEM, input, effort: "high", maxTokens: 12000,
    promptVersion: NOTES_VERSION, audit: { bookId: book.id, chapter, retrieved: pack.items.map((i) => i.id) },
  });

  // 1. Code checks: citations exist, quotes are word for word, no restating, explicit notes show a pattern.
  const issues: ValidationIssue[] = [];
  const candidates: Candidate[] = [];
  const underlined = new Map<number, [number, number][]>(); // verse ord → character spans already underlined
  for (const n of output.notes) {
    if (soundsAuthoritative(n.statement)) { issues.push({ statement: n.statement, problem: "dropped: speaks for God" }); continue; }
    const c = checkClaim({ label: n.label, statement: n.statement, cites: n.cites, quote: n.quote, excerpt: n.excerpt }, pack, issues);
    if (!c?.quote) { if (c) issues.push({ statement: n.statement, problem: "dropped: quote not found in its verse" }); continue; }
    // A note resting on a commentator says so by name; without lexical evidence, their reading is "scholarly".
    const kKeys = c.cites.filter((id) => id.startsWith("K:")).map((id) => String(pack.byId.get(id)?.meta?.key ?? ""));
    if (kKeys.length && !kKeys.some((k) => COMMENTATOR_NAMES[k]?.test(c.statement))) {
      issues.push({ statement: n.statement, problem: "dropped: relies on a commentator without naming them" });
      continue;
    }
    if (kKeys.length && c.label === "historical" && !c.cites.some((id) => id.startsWith("L:"))) {
      issues.push({ statement: n.statement, problem: "historical → scholarly: a commentator's reading, not lexical evidence" });
      c.label = "scholarly";
    }
    const verses = new Set(c.anchors.map((a) => a.ord));
    if (c.label === "explicit" && verses.size < 2) { issues.push({ statement: n.statement, problem: "dropped: an explicit note about one verse only restates it" }); continue; }
    const citedText = [...verses].map((o) => pack.verseText.get(o) ?? "").join(" ");
    if (restatesVerse(c.statement, citedText, 0.6)) { issues.push({ statement: n.statement, problem: "dropped: restates its verse" }); continue; }
    // One note per phrase: two notes underlining overlapping words in the same verse can't both be clicked.
    const at = c.anchors.find((a) => a.quote)!;
    const start = norm(pack.verseText.get(at.ord) ?? "").indexOf(norm(at.quote!));
    const span: [number, number] = [start, start + at.quote!.length];
    const taken = underlined.get(at.ord) ?? [];
    if (start >= 0 && taken.some(([a, b]) => span[0] < b && a < span[1])) { issues.push({ statement: n.statement, problem: "dropped: another note already underlines these words" }); continue; }
    underlined.set(at.ord, [...taken, span]);
    candidates.push({ kind: n.kind, claim: c });
  }
  // At most a third explicit.
  const maxExplicit = Math.max(1, Math.ceil(candidates.length / 3));
  let explicit = 0;
  const kept = candidates.filter((x) => x.claim.label !== "explicit" || ++explicit <= maxExplicit);
  if (kept.length < candidates.length) issues.push({ statement: "", problem: `dropped ${candidates.length - kept.length} explicit notes over the one-third cap` });

  // 2. Second reader: accuracy and insight. Unsupported or restating notes are dropped.
  const review = kept.length ? await reviewNotes(book, chapter, pack, kept) : [];
  const final = kept
    .map((x, i) => ({ ...x, review: review[i] }))
    .filter((x) => x.review && x.review.verdict !== "unsupported" && x.review.insight === "new");

  // 3. Replace the chapter's Read notes (verified notes are never touched).
  const src = Object.fromEntries((await sql<{ id: number; key: string }[]>`select id, key from sources`).map((r) => [r.key, r.id]));
  await sql.begin(async (tx) => {
    await tx`delete from claims where book_id = ${book.id} and chapter = ${chapter} and step = 'read' and origin = 'ai_draft' and status = 'unverified'`;
    for (const x of final) {
      const id = await writeClaim(tx, book, chapter, pack, src, x.claim, "read", x.kind);
      await tx`update claims set review = ${x.review!.verdict}, review_note = ${stripIds(x.review!.reason)}, reviewed_at = now() where id = ${id}`;
    }
  });
  const summary = { model: currentModel(), drafted: output.notes.length, passedChecks: kept.length, saved: final.length, labels: count(final.map((x) => x.claim.label)), issues };
  await recordValidation(runId, summary);
  return summary;
}

async function reviewNotes(book: Book, chapter: number, pack: EvidencePack, notes: Candidate[]) {
  const lines = notes.map((x, n) => {
    const c = x.claim;
    const ev = c.cites.map((id) => {
      if (id.startsWith("V:")) return `  - verse ${id.replace(/^V:\w+\.(\d+)\.(\d+)$/, `${book.name} $1:$2`)}: "${pack.verseText.get(pack.ordById.get(id)!) ?? "?"}"`;
      if (id.startsWith("K:")) return `  - ${String(pack.byId.get(id)?.meta?.key ?? "commentator")}: "${c.excerpts[id] ?? "?"}"`;
      return `  - ${id}: ${(pack.byId.get(id)?.text ?? "?").slice(0, 400)}`;
    });
    return `${n + 1}. [${c.label}, ${x.kind}] underlining "${c.quote}": ${c.statement}\n${ev.join("\n")}`;
  });
  const { output, runId } = await generateStructured({
    kind: "review", schema: ReviewSchema, system: REVIEW_SYSTEM, effort: "medium", maxTokens: 8000, promptVersion: NOTES_VERSION,
    input: `Study notes on ${book.name} ${chapter}. Review each note against its cited evidence.\n\n${lines.join("\n\n")}`,
    audit: { bookId: book.id, chapter },
  });
  const byNote = new Map(output.verdicts.map((v) => [v.note, v]));
  await recordValidation(runId, { reviewed: output.verdicts.length });
  return notes.map((_, i) => byNote.get(i + 1));
}

const norm = (s: string) => s.replace(/[“”"‘’']/g, "'").replace(/\s+/g, " ").trim().toLowerCase();
const count = (xs: string[]) => xs.reduce<Record<string, number>>((m, x) => ((m[x] = (m[x] ?? 0) + 1), m), {});
