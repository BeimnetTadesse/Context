import "server-only";
import * as z from "zod/v4";
import { sql } from "@/lib/db";
import type { Book } from "@/lib/bible/books";
import { LABELS } from "@/lib/labels";
import { generateStructured, recordValidation } from "@/lib/ai/client";
import { chapterEvidence, renderEvidence } from "@/lib/ai/evidence";
import { checkClaim, soundsAuthoritative, type ValidationIssue } from "@/lib/ai/validate";
import { introEvidence } from "./book";
import { reviewChapter, writeClaim } from "./generate";

// The Context step on its own, for Old Testament chapters (whose full studies aren't prepared yet): where the chapter
// sits, who wrote it and for whom, the setting, and how it fits the book. Drafted only from the chapter's verses, the
// commentators' notes on it, and the reference works' articles on the book (ISBE 1915, Easton 1897), then checked
// by code (citations exist, quotes word for word) and by a second reader, like every other claim.
export const CONTEXT_VERSION = "2026-10-28.1";

const ContextSchema = z.object({
  context: z.array(
    z.object({
      topic: z.enum(["author", "audience", "setting", "literary", "argument"]),
      label: z.enum(LABELS),
      statement: z.string(),
      cites: z.array(z.string()).describe("evidence ids, e.g. V:Gen.12.1, K:1234.0, K:intro.12.3, X:123"),
      quote: z.string().nullable().describe("exact words from the cited WEB verse this claim is about, or null"),
      excerpt: z.string().nullable().describe("REQUIRED when citing a K: id: the source's exact words (copied, 5–30 words); otherwise null"),
    }),
  ),
});

const SYSTEM = `You are the research assistant inside Context, a Bible study workspace. You write the Context step for one Old Testament (Hebrew Bible) chapter: where it sits, who wrote it and for whom, its historical setting, its literary context, and how it moves the book's argument or story forward. You are not a pastor, theologian, or authority.

You will receive an evidence pack. Every statement must cite evidence ids from that pack and nothing else; do not name sources that are not in the pack.
- V: the chapter's verses (World English Bible).
- K:<number> commentators' notes on this chapter: John Calvin (Reformed, 16th c.), Matthew Henry (devotional, 18th c.), John Gill (Particular Baptist, 18th c.), Adam Clarke (Methodist/Arminian, 19th c.), Jamieson-Fausset-Brown (Scottish evangelical, 1871), Tyndale Open Study Notes (modern evangelical).
- K:intro ids: introductions to the whole book, from the International Standard Bible Encyclopedia (ISBE, 1915, multi-author scholarly encyclopedia; excerpts carry their section heading), Easton's Bible Dictionary (1897) and the commentators.
- X: cross-references from this chapter.

Topics (one to two claims each where the evidence allows; skip a topic rather than guess):
- author: who wrote or compiled the book, and what the text itself says about it.
- audience: who it was first written for.
- setting: the historical situation and time the chapter describes or was written in.
- literary: what kind of writing this is (narrative, law, poetry, prophecy, wisdom…) and where the chapter sits in the book (what comes before and after).
- argument: what this chapter contributes to the book's story or message.

Labels: explicit (the chapter itself says it; cite the verse), inference (follows closely from the text), historical (background from ISBE or an academic commentator; cite the K: id with their exact words), scholarly (a view others dispute; phrase it as a view and name who holds it: "ISBE argues…", "Clarke holds…"), tradition (a belief handed down in Jewish or Christian tradition, e.g. Mosaic authorship of the Pentateuch; name it as tradition), personal (never use here).

Rules:
- Prefer what the text says about itself. Traditional authorship and dates are tradition or scholarly views unless the book states them: attribute them and say where they are debated. ISBE (1915) argues against the critical theories of its day; report its arguments as its view.
- When you cite a K: id, copy the source's exact words (5–30 words) into "excerpt", or the citation is removed.
- These are all Protestant voices from 1540–2022; never present them as "the Christian view" or "scholars agree".
- Say "the chapter says", "one reading holds". Never "the Bible means", "God is telling you", or "God wants you to".
- 3–6 claims in total, one or two sentences each.`;

export async function generateChapterContext(book: Book, chapter: number) {
  const pack = await chapterEvidence(book, chapter, { lexicon: 0, xrefs: 12, claims: false, commentary: 14000 });
  const intro = await introEvidence(book, 0.7);
  for (const i of intro.items) { pack.items.push(i); pack.byId.set(i.id, i); }
  for (const [k, v] of intro.commentaryText) pack.commentaryText.set(k, v);
  for (const k of intro.academic) pack.academic.add(k);

  const { output, runId } = await generateStructured({
    kind: "chapter_context", schema: ContextSchema, system: SYSTEM, effort: "high", maxTokens: 8000, promptVersion: CONTEXT_VERSION,
    input: `Chapter: ${book.name} ${chapter} (World English Bible).\n\n<evidence_pack>\n${renderEvidence(pack)}\n</evidence_pack>\n\nWrite the Context step for this chapter.`,
    audit: { bookId: book.id, chapter, retrieved: pack.items.filter((i) => i.kind !== "verse").map((i) => i.id) },
  });

  const issues: ValidationIssue[] = [];
  const src = Object.fromEntries((await sql<{ id: number; key: string }[]>`select id, key from sources`).map((r) => [r.key, r.id]));
  let saved = 0;
  await sql.begin(async (tx) => {
    // Replace the previous unverified Context draft for this chapter (verified claims are never touched).
    await tx`delete from claims where book_id = ${book.id} and chapter = ${chapter} and step = 'context' and origin = 'ai_draft' and status = 'unverified'`;
    for (const c of output.context) {
      if (soundsAuthoritative(c.statement)) { issues.push({ statement: c.statement, problem: "dropped: speaks for God" }); continue; }
      const ok = checkClaim(c, pack, issues);
      if (!ok) continue;
      await writeClaim(tx, book, chapter, pack, src, ok, "context", c.topic);
      saved++;
    }
  });
  await recordValidation(runId, { issues });
  const review = await reviewChapter(book, chapter, pack);
  return { drafted: output.context.length, saved, issues: issues.length, review };
}
