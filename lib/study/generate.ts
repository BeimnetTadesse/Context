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
  excerpt: z.string().nullable().describe("REQUIRED when citing a K: commentary id: the commentator's exact words (copied, 5–30 words) that support the claim; otherwise null"),
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

The pack includes excerpts from named commentators (K: ids): John Calvin (Reformed, 16th c.), Matthew Henry (devotional, 18th c.), John Gill (Particular Baptist, 18th c.), Adam Clarke (Methodist/Arminian, 19th c.), Jamieson-Fausset-Brown (Scottish evangelical, 1871) and the Tyndale Open Study Notes (modern evangelical). Use them:
- When you report how someone reads the passage, name the commentator ("Calvin reads…", "Clarke, from the Arminian side, argues…"), cite their K: id, and put their exact words (copied, not paraphrased) in "excerpt". A claim that cites a K: id without the exact words loses that citation.
- Interpretation views should be anchored in commentators who actually hold them. Where the commentators disagree, show that. Where they agree, say so in common ground. These are all Protestant voices; do not present them as "the Christian view".
- Historical or background claims may cite academic commentators (Calvin, Gill, Clarke, JFB, Tyndale) — as their view, with the excerpt. Never present a commentator's historical claim as settled fact; label it scholarly unless it is lexical.

Label every claim with exactly one of:
- explicit: the words are on the page (cite the verse).
- inference: follows closely from the text but is not stated.
- historical: from lexical, historical or ancient-source evidence (cite an L: id, or an academic commentator's K: id with its excerpt). If you lack such evidence, do not make the claim.
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
  const pack = await chapterEvidence(book, chapter, { lexicon: 20, xrefs: 30, claims: true, commentary: 24000 });
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
  const review = await reviewChapter(book, chapter, pack);
  await sql`update chapter_studies set audit = ${sql.json({ validatorIssues: issues.length, ...review } as never)}
            where book_id = ${book.id} and chapter = ${chapter}`;
  return { issues: issues.length, runId, review };
}

// ── Second reader: check every saved claim against the evidence it cites ──
const ReviewSchema = z.object({
  verdicts: z.array(
    z.object({
      claim: z.number().describe("the claim number"),
      verdict: z.enum(["supported", "partial", "unsupported"]),
      reason: z.string().describe("one sentence: what in the evidence does or does not support it"),
    }),
  ),
});

const REVIEW_SYSTEM = `You are an independent second reader checking a Bible study for accuracy. For each numbered claim you get its label and the exact evidence it cites (verse text, lexicon entry, cross-reference, or a commentator's words).

Judge ONLY whether the cited evidence supports the claim as worded:
- supported: the evidence clearly supports the claim and its label (e.g. "explicit" claims are really stated in the verse; a claim attributed to a commentator matches what that commentator says).
- partial: broadly right but overstated, imprecise, or the label is too strong (e.g. an inference labelled explicit).
- unsupported: the evidence does not say this, the claim misattributes a view, or it adds facts not in the evidence.
Be strict but fair. Do not use outside knowledge to rescue a claim; do not penalise a claim for being modest.`;

export async function reviewChapter(book: Book, chapter: number, pack: EvidencePack) {
  const claims = await sql<{ id: number; label: string; statement: string; step: string; cites: { kind: string; locator: string | null; quote: string | null; key: string }[] }[]>`
    select c.id, c.label, c.statement, c.step,
           coalesce(json_agg(json_build_object('kind', s.source_type, 'locator', ci.locator, 'quote', ci.quote, 'key', s.key)) filter (where ci.id is not null), '[]') as cites
    from claims c left join citations ci on ci.claim_id = c.id left join sources s on s.id = ci.source_id
    where c.book_id = ${book.id} and c.chapter = ${chapter} and c.origin = 'ai_draft' and c.status = 'unverified'
    group by c.id order by c.id`;
  if (!claims.length) return { reviewed: 0, supported: 0, partial: 0, unsupported: 0 };

  // Re-assemble each claim's evidence text from the pack (verses by locator; commentators by their quoted words).
  const verseByRef = new Map<string, string>();
  for (const i of pack.items) if (i.kind === "verse") verseByRef.set(i.id.replace(/^V:\w+\.(\d+)\.(\d+)$/, `${book.name} $1:$2`), i.text.split("  [")[0]);
  const lexByStrongs = new Map(pack.items.filter((i) => i.kind === "lexicon").map((i) => [i.id.slice(2), i.text.slice(0, 400)]));
  const lines = claims.map((c, n) => {
    const ev = c.cites.map((x) => {
      if (x.key === "WEB") return `  - verse ${x.locator}: "${verseByRef.get(x.locator ?? "") ?? "?"}"`;
      if (x.key === "Abbott-Smith") return `  - lexicon ${x.locator}: ${lexByStrongs.get(x.locator ?? "") ?? "?"}`;
      if (x.key === "OpenBible") return `  - cross-reference: ${x.locator}`;
      return `  - ${x.key} ${x.locator ?? ""}: "${x.quote ?? "(no quoted words)"}"`;
    });
    return `${n + 1}. [${c.label}] ${c.statement}\n${ev.join("\n")}`;
  });

  const { output, runId } = await generateStructured({
    kind: "review",
    schema: ReviewSchema,
    system: REVIEW_SYSTEM,
    input: `Study of ${book.name} ${chapter}. Review each claim against its cited evidence.\n\n${lines.join("\n\n")}`,
    effort: "medium",
    maxTokens: 16000,
    audit: { bookId: book.id, chapter },
  });

  const counts = { reviewed: 0, supported: 0, partial: 0, unsupported: 0 };
  for (const v of output.verdicts) {
    const c = claims[v.claim - 1];
    if (!c) continue;
    await sql`update claims set review = ${v.verdict}, review_note = ${stripIds(v.reason)}, reviewed_at = now() where id = ${c.id}`;
    counts.reviewed++;
    counts[v.verdict]++;
  }
  await recordValidation(runId, counts);
  return counts;
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
        const source =
          kind === "V" ? src.WEB : kind === "L" ? src["Abbott-Smith"] : kind === "X" ? src.OpenBible
          : kind === "K" ? src[String(item?.meta?.key)] : null;
        if (!source) continue; // C: ids link claims to claims; the chain continues through that claim's own citations
        const locator =
          kind === "V" ? ref.replace(/^(\w+)\.(\d+)\.(\d+)$/, `${book.name} $2:$3`)
          : kind === "L" ? ref
          : kind === "K" ? `${book.name} ${String(item?.meta?.range ?? "").replace(/^on /, "")}`
          : String(item?.meta?.ref ?? ref);
        // A commentator citation carries the commentator's exact words (verified by the validator).
        const quote = kind === "K" ? c.excerpts[cite] ?? null : null;
        await tx`insert into citations (claim_id, source_id, locator, quote) values (${row.id}, ${source}, ${locator}, ${quote})`;
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
