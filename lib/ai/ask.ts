import "server-only";
import * as z from "zod/v4";
import type { Book } from "@/lib/bible/books";
import { LABELS, type Label } from "@/lib/labels";
import { generateStructured, recordValidation } from "./client";
import { chapterEvidence, renderEvidence, type EvidencePack } from "./evidence";
import { checkClaim, soundsAuthoritative, stripIds, type ValidationIssue } from "./validate";

export interface EvidenceRef {
  id: string;
  kind: string;
  text: string;
}

const refsFor = (ids: string[], pack: EvidencePack): EvidenceRef[] =>
  ids.flatMap((id) => {
    const i = pack.byId.get(id);
    return i ? [{ id, kind: i.kind, text: i.kind === "verse" ? `${id.slice(2).replace(/\./g, " ").replace(/ (\d+) (\d+)$/, " $1:$2")} — ${i.text.split("  [")[0]}` : i.text.slice(0, 280) }] : [];
  });

const RULES = `You are the research assistant inside Context, a Bible study workspace — not a pastor, theologian, or authority.
Use ONLY the evidence pack. Cite evidence ids for every sentence. Never name sources that are not in the pack. Never quote Scripture from memory.
Never say "the Bible means", "God is telling you", or "God wants you to". Prefer "the passage says", "one reading holds", "the text does not say".
Labels: explicit (words on the page; cite a verse) · inference (follows closely from the text) · historical (lexical/ancient evidence; cite an L: id) · scholarly (a disputed reading, phrased as a view) · tradition (handed down in a church tradition, not derived from the passage) · personal (what a reader brings).`;

// ── Ask ──
const AskSchema = z.object({
  status: z.enum(["answered", "partial", "insufficient_evidence"]),
  segments: z.array(z.object({ label: z.enum(LABELS), text: z.string(), cites: z.array(z.string()) })),
  unanswered: z.string().nullable().describe("what the evidence does not settle, or null"),
});

export async function askPassage(book: Book, chapter: number, question: string, userId: number | null) {
  const pack = await chapterEvidence(book, chapter, { lexicon: 14, xrefs: 16, claims: true });
  const { output, runId } = await generateStructured({
    kind: "ask",
    schema: AskSchema,
    system: `${RULES}
Answer the reader's question in 1–5 short segments. Each segment is one kind of statement with one label — never blend observation, context, interpretation, and application in one segment.
If the evidence does not answer the question, return status "insufficient_evidence" with an empty segments list and say what is missing in "unanswered". That is better than guessing.`,
    input: `Passage: ${book.name} ${chapter}\n<evidence_pack>\n${renderEvidence(pack)}\n</evidence_pack>\n\nReader's question: ${question}`,
    effort: "medium",
    maxTokens: 8000,
    audit: { userId, bookId: book.id, chapter, retrieved: pack.items.map((i) => i.id) },
  });

  const issues: ValidationIssue[] = [];
  const segments = output.segments.flatMap((s) => {
    if (soundsAuthoritative(s.text)) {
      issues.push({ statement: s.text, problem: "dropped: authoritative language" });
      return [];
    }
    const ok = checkClaim({ label: s.label, statement: s.text, cites: s.cites, quote: null }, pack, issues);
    return ok ? [{ label: ok.label, text: ok.statement, evidence: refsFor(ok.cites, pack) }] : [];
  });
  await recordValidation(runId, { issues });

  return {
    status: segments.length === 0 ? ("insufficient_evidence" as const) : output.status,
    segments,
    unanswered:
      segments.length === 0
        ? stripIds(output.unanswered ?? "I don’t have enough reliable evidence in the current sources to answer that.")
        : output.unanswered && stripIds(output.unanswered),
    dropped: issues.length,
  };
}

// ── Text or Assumption? ──
const AssumptionSchema = z.object({
  label: z.enum(LABELS),
  reasoning: z.string(),
  cites: z.array(z.string()),
  text_says: z.string().nullable().describe("what the passage itself says nearby, or null"),
});

export async function classifyStatement(book: Book, chapter: number, statement: string, userId: number | null) {
  const pack = await chapterEvidence(book, chapter, { lexicon: 10, xrefs: 10, claims: true });
  const { output, runId } = await generateStructured({
    kind: "assumption",
    schema: AssumptionSchema,
    system: `${RULES}
Classify ONE statement a reader brings to this passage: is it explicit in the text, a strong inference, historical, a scholarly reading, a tradition, or the reader's own personal reflection?
Be conservative: if the evidence pack does not support it, label it personal (or tradition, if it is a well-known church reading) and say what the passage actually says instead.`,
    input: `Passage: ${book.name} ${chapter}\n<evidence_pack>\n${renderEvidence(pack)}\n</evidence_pack>\n\nStatement to classify: ${statement}`,
    effort: "medium",
    maxTokens: 4000,
    audit: { userId, bookId: book.id, chapter, retrieved: pack.items.map((i) => i.id) },
  });

  const issues: ValidationIssue[] = [];
  let label: Label = output.label;
  let cites: string[] = [];
  const ok = checkClaim({ label, statement: output.reasoning, cites: output.cites, quote: null }, pack, issues);
  if (ok) {
    label = ok.label;
    cites = ok.cites;
  } else if (label !== "personal" && label !== "tradition") {
    label = "personal"; // no surviving evidence → the conservative answer
    issues.push({ statement, problem: "no valid evidence → personal" });
  }
  await recordValidation(runId, { issues });
  return { label, reasoning: stripIds(output.reasoning), textSays: output.text_says ? stripIds(output.text_says) : null, evidence: refsFor(cites, pack) };
}
