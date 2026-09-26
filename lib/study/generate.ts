import "server-only";
import * as z from "zod/v4";
import { sql } from "@/lib/db";
import type { Book } from "@/lib/bible/books";
import { LABELS } from "@/lib/labels";
import { PROMPT_VERSION, currentModel, generateStructured, recordValidation } from "@/lib/ai/client";
import { chapterEvidence, renderEvidence, type EvidencePack } from "@/lib/ai/evidence";
import { checkClaim, checkClaims, soundsAuthoritative, stripIds, type CheckedClaim, type DraftClaim, type ValidationIssue } from "@/lib/ai/validate";

// ── What we ask the model for (structured output) ──
const Claim = z.object({
  label: z.enum(LABELS),
  statement: z.string(),
  cites: z.array(z.string()).describe("evidence ids, e.g. V:Eph.3.6, L:G3466, X:123"),
  quote: z.string().nullable().describe("exact words from the cited WEB verse this claim is about, or null"),
});

const StudySchema = z.object({
  sections: z.array(z.object({ start_verse: z.number(), end_verse: z.number(), title: z.string(), summary: z.string() })),
  margin_notes: z.array(Claim).describe("key phrases in the chapter; quote is required"),
  observations: z.array(Claim),
  context: z.array(Claim.extend({ topic: z.enum(["author", "audience", "setting", "literary", "argument"]) })),
  language: z.array(
    z.object({
      strongs: z.string().describe("must match an L: evidence id, without the L: prefix"),
      meaning_here: z.string(),
      translation_note: z.string().nullable(),
      caution: z.string().nullable(),
      claims: z.array(Claim),
    }),
  ),
  connections: z.array(
    z.object({ xref: z.string().describe("an X: evidence id"), group: z.string(), relation: z.string(), explanation: z.string() }),
  ),
  interpretations: z.array(
    z.object({
      question: z.string(),
      start_verse: z.number(),
      end_verse: z.number(),
      common_ground: z.string(),
      views: z.array(z.object({ title: z.string(), claims: z.array(Claim) })),
    }),
  ),
  reflect_statements: z.array(
    z.object({ text: z.string(), expected_label: z.enum(LABELS), explanation: z.string(), cites: z.array(z.string()) }),
  ),
  reflect_prompts: z.array(z.object({ start_verse: z.number(), end_verse: z.number(), prompt: z.string() })),
});
export type Study = z.infer<typeof StudySchema>;

const SYSTEM = `You are the research assistant inside Context, a Bible study workspace. You help a reader investigate a New Testament chapter. You are not a pastor, theologian, or authority.

You will receive an evidence pack. Every statement you make must cite evidence ids from that pack and nothing else. You have no other sources: do not name commentators, scholars, dictionaries, manuscripts, or books that are not in the pack, and do not quote Scripture except by citing verse ids.

Label every claim with exactly one of:
- explicit: the words are on the page (cite the verse).
- inference: follows closely from the text but is not stated.
- historical: from lexical or ancient-source evidence (cite an L: id). If you lack such evidence, do not make the claim.
- scholarly: a reasoned reading that others dispute. Phrase it as a view ("One reading holds…"), never as fact.
- tradition: a belief handed down in a church tradition, not derived from this passage. Name the tradition generically.
- personal: something a reader brings to the text.

Rules:
- Say "the passage says", "one reading holds", "the text does not say". Never "the Bible means", "God is telling you", or "God wants you to".
- Where readers genuinely disagree, give each view its evidence. Do not manufacture controversy where the text is plain, and do not manufacture consensus.
- Context claims about authorship, date, or audience beyond what the text states belong under "scholarly" and must say they are debated; keep them few and modest. Prefer what the text itself states about author, audience, and situation.
- Language: explain the range of meaning from the lexicon and the sense in this passage. Never claim a Greek word "really means" something English translations missed. Warn about root fallacies where relevant.
- Connections: only use X: ids from the pack. Group them (e.g. "The same idea elsewhere in Paul", "Old Testament background", "Earlier in this book") and explain the relationship in one sentence.
- Reflection prompts are questions, never conclusions or instructions from God.
- Text or Assumption? statements: write 4–6 statements a reader might believe about this chapter, mixing labels (include at least one explicit, one tradition or scholarly, and one personal). The expected_label must be defensible from the evidence.
- Sizes: 3–5 sections; 4–7 margin notes (each with an exact quote from the WEB verse); 3–6 observations; 3–6 context claims; 3–5 language terms; 5–10 connections; 1–3 interpretation questions with 2 views each; 3–4 reflection prompts.
- Be concise: one or two sentences per claim.`;

export async function generateChapterStudy(book: Book, chapter: number) {
  const pack = await chapterEvidence(book, chapter, { lexicon: 20, xrefs: 30, claims: true });
  const input = `Chapter: ${book.name} ${chapter} (World English Bible, with SBL Greek).\n\n<evidence_pack>\n${renderEvidence(pack)}\n</evidence_pack>\n\nPrepare the study for this chapter.`;

  const { output, runId } = await generateStructured({
    kind: "chapter_study",
    schema: StudySchema,
    system: SYSTEM,
    input,
    effort: "high",
    maxTokens: 32000,
    audit: { bookId: book.id, chapter, retrieved: pack.items.map((i) => i.id) },
  });

  const issues: ValidationIssue[] = [];
  await saveStudy(book, chapter, output, pack, issues);
  await recordValidation(runId, { issues });
  return { issues: issues.length, runId };
}

// ── Validate + write (one transaction; replaces the previous unverified draft) ──
export async function saveStudy(book: Book, chapter: number, s: Study, pack: EvidencePack, issues: ValidationIssue[]) {
  const [sourceRows] = [await sql<{ id: number; key: string }[]>`select id, key from sources`];
  const src = Object.fromEntries(sourceRows.map((r) => [r.key, r.id]));
  const verseOrd = (v: number) => pack.ordById.get(`V:${book.osis}.${chapter}.${v}`);
  const chapterOrds = [...pack.ordById.values()];
  const clampOrd = (v: number, fallback: number) => verseOrd(v) ?? fallback;
  const firstOrd = Math.min(...chapterOrds);
  const lastOrd = Math.max(...chapterOrds);

  const guard = (c: DraftClaim) => {
    if (soundsAuthoritative(c.statement)) {
      issues.push({ statement: c.statement, problem: "dropped: speaks for God / collapses interpretation into fact" });
      return null;
    }
    return checkClaim(c, pack, issues);
  };

  await sql.begin(async (tx) => {
    // Clear the previous AI draft for this chapter (verified work is never touched).
    await tx`delete from claims where book_id = ${book.id} and chapter = ${chapter} and origin = 'ai_draft' and status = 'unverified'`;
    await tx`delete from sections where book_id = ${book.id} and chapter = ${chapter} and origin = 'ai_draft'`;
    await tx`delete from connections where book_id = ${book.id} and chapter = ${chapter}`;
    await tx`delete from interp_questions where book_id = ${book.id} and chapter = ${chapter} and origin = 'ai_draft'`;
    await tx`delete from reflection_items where book_id = ${book.id} and chapter = ${chapter}`;
    await tx`delete from language_notes where book_id = ${book.id} and chapter = ${chapter} and origin = 'ai_draft'`;

    const insertClaim = async (c: CheckedClaim, step: string, topic: string | null = null, strongs: string | null = null) => {
      const [row] = await tx<{ id: number }[]>`
        insert into claims (label, statement, step, topic, book_id, chapter, strongs, origin)
        values (${c.label}, ${c.statement}, ${step}, ${topic}, ${book.id}, ${chapter}, ${strongs}, 'ai_draft') returning id`;
      for (const a of c.anchors) {
        await tx`insert into claim_anchors (claim_id, start_ord, end_ord, quote) values (${row.id}, ${a.ord}, ${a.ord}, ${a.quote})`;
      }
      for (const cite of c.cites) {
        const [kind, ref] = [cite.slice(0, 1), cite.slice(2)];
        const item = pack.byId.get(cite);
        const source = kind === "V" ? src.WEB : kind === "L" ? src["Abbott-Smith"] : kind === "X" ? src.OpenBible : null;
        if (!source) continue; // C: ids link claims to claims; the chain continues through that claim's own citations
        const locator =
          kind === "V" ? ref.replace(/^(\w+)\.(\d+)\.(\d+)$/, `${book.name} $2:$3`) : kind === "L" ? ref : String(item?.meta?.ref ?? ref);
        await tx`insert into citations (claim_id, source_id, locator) values (${row.id}, ${source}, ${locator})`;
      }
      return row.id;
    };

    let sort = 0;
    for (const sec of s.sections) {
      const lo = clampOrd(sec.start_verse, firstOrd);
      const hi = clampOrd(sec.end_verse, lastOrd);
      if (hi < lo) continue;
      await tx`insert into sections (book_id, chapter, start_ord, end_ord, title, summary, origin)
               values (${book.id}, ${chapter}, ${lo}, ${hi}, ${stripIds(sec.title)}, ${stripIds(sec.summary)}, 'ai_draft')`;
    }

    for (const c of s.margin_notes) {
      const ok = guard(c);
      if (ok?.quote) await insertClaim(ok, "read");
      else if (ok) issues.push({ statement: c.statement, problem: "margin note dropped: no verifiable quote" });
    }
    for (const c of s.observations) {
      const ok = guard(c);
      if (ok) await insertClaim(ok, "observe");
    }
    for (const c of s.context) {
      const ok = guard(c);
      if (ok) await insertClaim(ok, "context", c.topic);
    }

    sort = 0;
    for (const term of s.language) {
      if (!pack.byId.has(`L:${term.strongs}`)) {
        issues.push({ statement: term.meaning_here, problem: `language term ${term.strongs} not in evidence` });
        continue;
      }
      await tx`insert into language_notes (book_id, chapter, strongs, meaning_here, translation_note, caution, origin, sort)
               values (${book.id}, ${chapter}, ${term.strongs}, ${stripIds(term.meaning_here)}, ${term.translation_note && stripIds(term.translation_note)}, ${term.caution && stripIds(term.caution)}, 'ai_draft', ${sort++})`;
      for (const ok of checkClaims(term.claims, pack, issues)) await insertClaim(ok, "language", null, term.strongs);
    }

    sort = 0;
    for (const cn of s.connections) {
      const item = pack.byId.get(cn.xref);
      if (!item || item.kind !== "xref") {
        issues.push({ statement: cn.explanation, problem: `connection ${cn.xref} not in evidence` });
        continue;
      }
      await tx`insert into connections (book_id, chapter, group_name, relation, to_start, to_end, explanation, sort)
               values (${book.id}, ${chapter}, ${cn.group}, ${cn.relation}, ${item.meta!.to_start as number}, ${item.meta!.to_end as number}, ${stripIds(cn.explanation)}, ${sort++})`;
    }

    sort = 0;
    for (const q of s.interpretations) {
      const [qrow] = await tx<{ id: number }[]>`
        insert into interp_questions (book_id, chapter, start_ord, end_ord, question, common_ground, origin, sort)
        values (${book.id}, ${chapter}, ${clampOrd(q.start_verse, firstOrd)}, ${clampOrd(q.end_verse, lastOrd)},
                ${stripIds(q.question)}, ${stripIds(q.common_ground)}, 'ai_draft', ${sort++}) returning id`;
      let v = 0;
      for (const view of q.views) {
        const [vrow] = await tx<{ id: number }[]>`
          insert into interpretations (question_id, view_label, title, sort)
          values (${qrow.id}, ${"View " + String.fromCharCode(65 + v)}, ${view.title}, ${v++}) returning id`;
        for (const c of view.claims) {
          const ok = guard(c);
          if (!ok) continue;
          const id = await insertClaim(ok, "interpretations");
          await tx`insert into interpretation_claims (interpretation_id, claim_id) values (${vrow.id}, ${id})`;
        }
      }
    }

    sort = 0;
    for (const st of s.reflect_statements) {
      const ok = guard({ label: st.expected_label, statement: st.explanation, cites: st.cites, quote: null });
      if (!ok || ok.label !== st.expected_label) continue; // the answer key must survive validation unchanged
      const claimId = await insertClaim(ok, "reflect");
      await tx`insert into reflection_items (book_id, chapter, kind, text, expected_label, explanation, claim_id, sort)
               values (${book.id}, ${chapter}, 'statement', ${stripIds(st.text)}, ${st.expected_label}, ${stripIds(st.explanation)}, ${claimId}, ${sort++})`;
    }
    for (const p of s.reflect_prompts) {
      await tx`insert into reflection_items (book_id, chapter, kind, text, anchor_start, anchor_end, sort)
               values (${book.id}, ${chapter}, 'prompt', ${stripIds(p.prompt)}, ${clampOrd(p.start_verse, firstOrd)}, ${clampOrd(p.end_verse, lastOrd)}, ${sort++})`;
    }

    await tx`
      insert into chapter_studies (book_id, chapter, status, model, prompt_version, generated_at, error)
      values (${book.id}, ${chapter}, 'ready', ${currentModel()}, ${PROMPT_VERSION}, now(), null)
      on conflict (book_id, chapter) do update set status = 'ready', model = excluded.model,
        prompt_version = excluded.prompt_version, generated_at = now(), error = null`;
  });
}

/** Claim the right to generate (so two visitors don't both pay for the same chapter). */
export async function beginGeneration(bookId: number, chapter: number): Promise<"started" | "busy" | "ready"> {
  const [row] = await sql<{ status: string; stale: boolean }[]>`
    select status, coalesce(generated_at < now() - interval '6 minutes', true) as stale
    from chapter_studies where book_id = ${bookId} and chapter = ${chapter}`;
  if (row?.status === "ready") return "ready";
  if (row?.status === "pending" && !row.stale) return "busy";
  await sql`
    insert into chapter_studies (book_id, chapter, status, generated_at) values (${bookId}, ${chapter}, 'pending', now())
    on conflict (book_id, chapter) do update set status = 'pending', generated_at = now(), error = null`;
  return "started";
}

export async function failGeneration(bookId: number, chapter: number, error: string) {
  await sql`update chapter_studies set status = 'failed', error = ${error.slice(0, 500)} where book_id = ${bookId} and chapter = ${chapter}`;
}
