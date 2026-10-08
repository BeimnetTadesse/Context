import "server-only";
import * as z from "zod/v4";
import { sql } from "@/lib/db";
import type { Book } from "@/lib/bible/books";
import { LABELS } from "@/lib/labels";
import { currentModel, generateStructured, recordValidation } from "@/lib/ai/client";
import { renderEvidence, type EvidenceItem, type EvidencePack } from "@/lib/ai/evidence";
import { checkClaim, soundsAuthoritative, stripIds, type DraftClaim, type ValidationIssue } from "@/lib/ai/validate";
import { reviewChapter } from "./generate";

// Book overview: what a whole book is about, drafted from the book's own verses and the commentators'
// introductions, under the same rules as chapter studies (cited, checked word for word, labelled, reviewed).
export const BOOK_PROMPT_VERSION = "2026-10-08.2"; // .2: adds ISBE (1915) and Easton (1897)

const Claim = z.object({
  label: z.enum(LABELS),
  statement: z.string(),
  cites: z.array(z.string()).describe("evidence ids, e.g. V:Eph.2.8 or K:intro.12.3"),
  excerpt: z.string().nullable().describe("REQUIRED when citing a K: id: the commentator's exact words (copied, 5–30 words); otherwise null"),
});
const BookSchema = z.object({
  summary: Claim.describe("2–3 plain sentences: what this book is and what it is about"),
  overview: z.array(Claim.extend({ topic: z.enum(["author", "audience", "purpose", "structure"]) })),
  themes: z.array(z.object({ title: z.string().describe("2–5 words"), claim: Claim })),
});
type BookStudy = z.infer<typeof BookSchema>;

const SYSTEM = `You are the research assistant inside Context, a Bible study workspace. You write the overview of one New Testament book: what it is about as a whole. You are not a pastor, theologian, or authority.

You will receive an evidence pack: every verse of the book (V: ids), and introductions to the book (K: ids) from:
- two reference works: the International Standard Bible Encyclopedia (ISBE, 1915, a multi-author scholarly encyclopedia; its excerpts carry their section heading) and Easton's Bible Dictionary (1897, a short popular dictionary);
- six commentators: John Calvin (Reformed, 16th c.), Matthew Henry (devotional, 18th c.), John Gill (Particular Baptist, 18th c.), Adam Clarke (Methodist/Arminian, 19th c.), Jamieson-Fausset-Brown (Scottish evangelical, 1871) and the Tyndale Open Study Notes (modern evangelical).
Every statement must cite ids from the pack and nothing else.

Label every claim with exactly one of: explicit (the book itself says it; cite the verse), inference (follows closely from the text), historical (background from ISBE or an academic commentator; cite the K: id with its exact words), scholarly (a view others dispute; phrase it as a view and name who holds it, e.g. "ISBE argues…", "Easton holds…"), tradition (a belief handed down in church tradition), personal (never use here).

Rules:
- Prefer what the book says about itself: who writes, to whom, why (cite those verses). Authorship, date and setting beyond the text are debated: label them scholarly or historical, attribute them to the source, and keep them modest. ISBE is the most thorough source on authorship, date and setting; where sources disagree, say so. These are all Protestant voices from 1540–2022; do not present them as "the Christian view".
- When you cite a K: id, copy the commentator's exact words (5–30 words) into "excerpt", or the citation is removed.
- summary: 2–3 plain sentences a newcomer understands. Cite the verses that show it.
- overview: 3–5 claims, at most one per topic (author, audience, purpose, structure).
- themes: 3–5 major themes that run through the book. Each claim names where the theme appears and cites 2–4 representative verses from different chapters.
- Say "the book says", "one reading holds". Never "the Bible means", "God is telling you", or "God wants you to".
- Be concise: one or two sentences per claim.`;

/** Every verse of the book (WEB) and the commentators' book introductions, split into paragraphs. */
async function bookEvidence(book: Book): Promise<EvidencePack> {
  const verses = await sql<{ ord: number; chapter: number; verse: number; web: string }[]>`
    select v.ord, v.chapter, v.verse, w.text as web from verses v
    join verse_texts w on w.ord = v.ord and w.translation_code = 'WEB'
    where v.book_id = ${book.id} order by v.ord`;
  const items: EvidenceItem[] = verses.map((v) => ({ id: `V:${book.osis}.${v.chapter}.${v.verse}`, kind: "verse", text: v.web, meta: { ord: v.ord } }));

  const intros = await sql<{ source_id: number; key: string; author: string; written: string; tradition: string; tier: number; text: string }[]>`
    select i.source_id, s.key, s.author, s.written, s.tradition, s.tier, i.text
    from book_intros i join sources s on s.id = i.source_id where i.book_id = ${book.id} order by s.written`;
  const commentaryText = new Map<string, string>();
  const academic = new Set<string>();
  // Space per source, so no single voice dominates: ISBE's long scholarly articles get the most.
  const BUDGET: Record<string, number> = { ISBE: 9000, Easton: 3000 };
  for (const intro of intros) {
    const budget = BUDGET[intro.key] ?? 5000;
    // Paragraphs with the section heading they sit under (short lines are headings, e.g. "II. Place and Date").
    let heading = "";
    const paras: { heading: string; text: string }[] = [];
    for (const raw of intro.text.split(/\n\s*\n/)) {
      const p = raw.replace(/\s+/g, " ").trim();
      if (p.length <= 80 && !/[.?!”"]$/.test(p.replace(/[:.]$/, "")) && p.length > 1) heading = p.replace(/[:.]$/, "");
      if (p.length > 60) paras.push({ heading, text: p });
    }
    // Long articles: take paragraphs evenly from start to end, so date, purpose and teaching are all represented.
    const total = paras.reduce((n, p) => n + Math.min(p.text.length, 900), 0);
    const step = Math.max(1, Math.ceil(total / budget));
    let used = 0;
    for (let i = 0; i < paras.length && used < budget; i += step) {
      const p = paras[i].text;
      const text = p.length > 900 ? p.slice(0, 900).replace(/\s+\S*$/, "") + "…" : p;
      const id = `K:intro.${intro.source_id}.${i}`;
      const where = paras[i].heading && intro.key === "ISBE" ? ` (section “${paras[i].heading}”)` : "";
      items.push({ id, kind: "commentary", text: `${intro.author} (${intro.written}, ${intro.tradition}), introduction to ${book.name}${where}: ${text}`, meta: { key: intro.key } });
      commentaryText.set(id, text);
      if (intro.tier >= 2 && intro.tier <= 4) academic.add(id);
      used += text.length;
    }
  }
  return {
    items,
    byId: new Map(items.map((i) => [i.id, i])),
    verseText: new Map(verses.map((v) => [v.ord, v.web])),
    ordById: new Map(verses.map((v) => [`V:${book.osis}.${v.chapter}.${v.verse}`, v.ord])),
    commentaryText,
    academic,
  };
}

export async function generateBookOverview(book: Book) {
  const pack = await bookEvidence(book);
  const { output, runId } = await generateStructured({
    kind: "book_overview",
    schema: BookSchema,
    system: SYSTEM,
    input: `Book: ${book.name}.\n\n<evidence_pack>\n${renderEvidence(pack)}\n</evidence_pack>\n\nWrite the overview of this book.`,
    effort: "high",
    maxTokens: 12000,
    audit: { bookId: book.id, retrieved: pack.items.filter((i) => i.kind === "commentary").map((i) => i.id) },
  });
  const issues: ValidationIssue[] = [];
  await saveBookOverview(book, output, pack, issues);
  await recordValidation(runId, { issues });
  const review = await reviewChapter(book, null, pack);
  return { issues: issues.length, review };
}

async function saveBookOverview(book: Book, s: BookStudy, pack: EvidencePack, issues: ValidationIssue[]) {
  const sources = Object.fromEntries((await sql<{ id: number; key: string }[]>`select id, key from sources`).map((r) => [r.key, r.id]));
  const check = (c: DraftClaim) => {
    if (soundsAuthoritative(c.statement)) {
      issues.push({ statement: c.statement, problem: "dropped: authoritative language" });
      return null;
    }
    return checkClaim({ ...c, quote: null }, pack, issues);
  };

  await sql.begin(async (tx) => {
    // Replace the previous AI draft of this book's overview (verified claims are never touched).
    await tx`delete from book_themes where book_id = ${book.id}`;
    await tx`delete from claims where book_id = ${book.id} and chapter is null and step = 'book' and origin = 'ai_draft' and status = 'unverified'`;

    const insert = async (c: DraftClaim, topic: string) => {
      const ok = check(c);
      if (!ok) return null;
      const [row] = await tx<{ id: number }[]>`
        insert into claims (label, statement, step, topic, book_id, chapter, origin)
        values (${ok.label}, ${stripIds(ok.statement)}, 'book', ${topic}, ${book.id}, null, 'ai_draft') returning id`;
      for (const a of ok.anchors) await tx`insert into claim_anchors (claim_id, start_ord, end_ord, quote) values (${row.id}, ${a.ord}, ${a.ord}, null)`;
      for (const cite of ok.cites) {
        const item = pack.byId.get(cite);
        const isVerse = cite.startsWith("V:");
        const source = isVerse ? sources.WEB : sources[String(item?.meta?.key)];
        if (!source) continue;
        const locator = isVerse ? cite.slice(2).replace(/^\w+\.(\d+)\.(\d+)$/, `${book.name} $1:$2`) : `Introduction to ${book.name}`;
        await tx`insert into citations (claim_id, source_id, locator, quote) values (${row.id}, ${source}, ${locator}, ${isVerse ? null : ok.excerpts[cite] ?? null})`;
      }
      return row.id;
    };

    await insert(s.summary, "summary");
    for (const c of s.overview) await insert(c, c.topic);
    let sort = 0;
    for (const t of s.themes) {
      const id = await insert(t.claim, "theme");
      if (id) await tx`insert into book_themes (book_id, title, claim_id, sort) values (${book.id}, ${stripIds(t.title)}, ${id}, ${sort++})`;
    }
    await tx`
      insert into book_overviews (book_id, model, prompt_version, generated_at) values (${book.id}, ${currentModel()}, ${BOOK_PROMPT_VERSION}, now())
      on conflict (book_id) do update set model = excluded.model, prompt_version = excluded.prompt_version, generated_at = now()`;
  });
}
