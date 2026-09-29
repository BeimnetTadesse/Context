import "server-only";
import { cache } from "react";
import { sql } from "@/lib/db";
import type { Book } from "@/lib/bible/books";
import type { Label } from "@/lib/labels";
import type { VerseRow } from "./chapter";
import { getBookIntros } from "./commentary";
import { cachedContent, chapterTag } from "@/lib/cache";

export interface Citation {
  key: string;
  title: string;
  source_type: string;
  orientation: string | null;
  tier: number;
  locator: string | null;
  url: string | null;
  checked: boolean;
  quote: string | null;
  written: string | null;
  tradition: string | null;
}

export interface ClaimView {
  id: number;
  label: Label;
  statement: string;
  step: string;
  topic: string | null;
  strongs: string | null;
  status: "verified" | "unverified";
  origin: "computed" | "ai_draft" | "human";
  review: "supported" | "partial" | "unsupported" | null;
  review_note: string | null;
  anchors: { ord: number; verse: number; quote: string | null; text: string }[];
  citations: Citation[];
}

export interface StudyData {
  status: "none" | "pending" | "ready" | "failed";
  error: string | null;
  generatedAt: string | null;
  claims: ClaimView[];
  sections: { start: number; end: number; title: string; summary: string | null }[];
  repeated: { word: string; count: number; verses: number[] }[];
  language: {
    strongs: string;
    lemma: string;
    translit: string | null;
    gloss: string | null;
    verses: number[];
    ntCount: number;
    meaningHere: string | null;
    translationNote: string | null;
    caution: string | null;
    computed: boolean;
  }[];
  connections: { group: string; relation: string; ref: string; href: string; text: string; explanation: string | null; votes: number | null }[];
  interpretations: {
    id: number;
    question: string;
    range: string;
    commonGround: string | null;
    views: { label: string; holders: string | null; title: string; claims: ClaimView[] }[];
  }[];
  statements: { id: number; text: string; expected: Label; explanation: string | null; claim: ClaimView | null }[];
  prompts: { id: number; text: string; range: string | null }[];
  ledger: Record<Label, number>;
  intros: { key: string; title: string; author: string | null; written: string | null; tradition: string | null; license: string; text: string }[];
  withheld: number;
}

const STOP = new Set(
  ("a an and are as at be been but by for from had has have he her him his i if in into is it its me my no not of on or our " +
    "out so that the their them then there these they this those to up us was we were what when which who whom will with " +
    "you your also all shall may might should would can could do did does being which whose upon unto than who even yet " +
    "because said says say let one own over such through about among before after again against very therefore let").split(" "),
);

function repeatedWords(verses: VerseRow[]) {
  const map = new Map<string, { count: number; verses: Set<number> }>();
  for (const v of verses) {
    for (const raw of v.web.toLowerCase().match(/[a-z’']+/g) ?? []) {
      const w = raw.replace(/[’']s$/, "").replace(/[’']/g, "");
      if (w.length < 4 || STOP.has(w)) continue;
      const e = map.get(w) ?? { count: 0, verses: new Set() };
      e.count++;
      e.verses.add(v.verse);
      map.set(w, e);
    }
  }
  return [...map]
    .filter(([, e]) => e.count >= 2)
    .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))
    .slice(0, 10)
    .map(([word, e]) => ({ word, count: e.count, verses: [...e.verses] }));
}

export const getStudy = cache((book: Book, chapter: number, verses: VerseRow[]): Promise<StudyData> =>
  cachedContent(["study", book.slug, chapter], [chapterTag(book.slug, chapter)], () => loadStudy(book, chapter, verses)),
);

async function loadStudy(book: Book, chapter: number, verses: VerseRow[]): Promise<StudyData> {
  const lo = verses[0].ord;
  const hi = verses[verses.length - 1].ord;
  const verseOf = (ord: number) => verses.find((v) => v.ord === ord)?.verse ?? null;
  const range = (a: number, b: number) => {
    const x = verseOf(a), y = verseOf(b);
    return x == null ? null : x === y || y == null ? `${chapter}:${x}` : `${chapter}:${x}–${y}`;
  };

  const [statusRow] = await sql<{ status: StudyData["status"]; error: string | null; generated_at: Date | null }[]>`
    select status, error, generated_at from chapter_studies where book_id = ${book.id} and chapter = ${chapter}`;

  const claimRows = await sql<Omit<ClaimView, "anchors" | "citations">[]>`
    select id, label, statement, step, topic, strongs, status, origin, review, review_note from claims
    where book_id = ${book.id} and (chapter = ${chapter} or chapter is null)
    order by id`;
  const ids = claimRows.map((c) => c.id);
  const anchorRows = ids.length
    ? await sql<{ claim_id: number; ord: number; verse: number; quote: string | null; text: string }[]>`
        select a.claim_id, a.start_ord as ord, v.verse, a.quote, t.text
        from claim_anchors a join verses v on v.ord = a.start_ord
        join verse_texts t on t.ord = a.start_ord and t.translation_code = 'WEB'
        where a.claim_id = any(${ids}) order by a.start_ord`
    : [];
  const citationRows = ids.length
    ? await sql<(Citation & { claim_id: number })[]>`
        select c.claim_id, s.key, s.title, s.source_type, s.orientation, s.tier, c.locator, s.url, c.checked, c.quote, s.written, s.tradition
        from citations c join sources s on s.id = c.source_id where c.claim_id = any(${ids}) order by s.tier, c.id`
    : [];
  // The second reader's "unsupported" verdict withholds a claim from the page (it stays in the audit).
  const withheld = claimRows.filter((c) => c.review === "unsupported" && c.status !== "verified").length;
  const claims: ClaimView[] = claimRows.filter((c) => !(c.review === "unsupported" && c.status !== "verified")).map((c) => ({
    ...c,
    anchors: anchorRows.filter((a) => a.claim_id === c.id).map((a) => ({ ord: a.ord, verse: a.verse, quote: a.quote, text: a.text })),
    citations: dedupeCitations(citationRows.filter((x) => x.claim_id === c.id)),
  }));
  const claimById = new Map(claims.map((c) => [c.id, c]));

  const sections = (
    await sql<{ start_ord: number; end_ord: number; title: string; summary: string | null }[]>`
      select start_ord, end_ord, title, summary from sections where book_id = ${book.id} and chapter = ${chapter} order by start_ord`
  ).map((s) => ({ start: verseOf(s.start_ord) ?? 1, end: verseOf(s.end_ord) ?? 1, title: s.title, summary: s.summary }));

  // Language: curated/AI notes first; otherwise the chapter's weightiest lemmas, computed.
  const notes = await sql<{ strongs: string; meaning_here: string; translation_note: string | null; caution: string | null }[]>`
    select strongs, meaning_here, translation_note, caution from language_notes
    where book_id = ${book.id} and chapter = ${chapter} order by sort`;
  const lemmaStats = await sql<{ strongs: string; lemma: string; translit: string | null; gloss: string | null; verses: number[]; nt: number; here: number }[]>`
    with here as (
      select g.strongs, count(*)::int as here, array_agg(distinct v.verse order by v.verse) as verses
      from greek_words g join verses v on v.ord = g.ord
      where g.ord between ${lo} and ${hi} and g.strongs is not null
        and g.morph !~ '^(T-|CONJ|PREP|PRT|P-|R-|D-|ADV|COND)'
      group by g.strongs)
    select l.strongs, l.lemma, l.translit, l.gloss, h.verses, h.here,
           (select count(*)::int from greek_words x where x.strongs = l.strongs) as nt
    from here h join lemmas l on l.strongs = h.strongs`;
  const stat = new Map(lemmaStats.map((l) => [l.strongs, l]));
  const language: StudyData["language"] = notes.length
    ? notes.flatMap((n) => {
        const l = stat.get(n.strongs);
        return l
          ? [{ strongs: n.strongs, lemma: l.lemma, translit: l.translit, gloss: l.gloss, verses: l.verses, ntCount: l.nt,
               meaningHere: n.meaning_here, translationNote: n.translation_note, caution: n.caution, computed: false }]
          : [];
      })
    : lemmaStats
        .filter((l) => l.here >= 2 && l.nt < 400)
        .sort((a, b) => b.here / Math.log(2 + b.nt) - a.here / Math.log(2 + a.nt))
        .slice(0, 6)
        .map((l) => ({ strongs: l.strongs, lemma: l.lemma, translit: l.translit, gloss: l.gloss, verses: l.verses, ntCount: l.nt,
                       meaningHere: null, translationNote: null, caution: null, computed: true }));

  // Connections: explained ones if generated; otherwise the strongest cross-references.
  const explained = await sql<{ group_name: string; relation: string; to_start: number; to_end: number; explanation: string }[]>`
    select group_name, relation, to_start, to_end, explanation from connections
    where book_id = ${book.id} and chapter = ${chapter} order by sort`;
  const targets = explained.length
    ? explained.map((c) => ({ ...c, votes: null as number | null }))
    : (
        await sql<{ to_start: number; to_end: number; votes: number }[]>`
          select to_start, to_end, max(votes) as votes from cross_refs
          where from_start between ${lo} and ${hi} and not (to_start between ${lo} and ${hi})
          group by to_start, to_end order by max(votes) desc limit 12`
      ).map((x) => ({ group_name: "Strongest cross-references", relation: "Cross-reference", explanation: null as string | null, ...x }));
  const connections = await Promise.all(
    targets.map(async (t) => {
      const [r] = await sql<{ name: string; slug: string; testament: string; c: number; v: number; ev: number; text: string }[]>`
        select b.name, b.slug, b.testament, v.chapter as c, v.verse as v, e.verse as ev,
               (select string_agg(x.text, ' ' order by x.ord) from verse_texts x
                 where x.translation_code = 'WEB' and x.ord between ${t.to_start} and least(${t.to_end}, ${t.to_start} + 3)) as text
        from verses v join books b on b.id = v.book_id join verses e on e.ord = ${t.to_end}
        where v.ord = ${t.to_start}`;
      return {
        group: t.group_name,
        relation: t.relation,
        ref: `${r.name} ${r.c}:${r.v}${t.to_end !== t.to_start ? `–${r.ev}` : ""}`,
        href: r.testament === "NT" ? `/study/${r.slug}/${r.c}#v${r.v}` : "",
        text: r.text,
        explanation: t.explanation,
        votes: t.votes,
      };
    }),
  );

  const qs = await sql<{ id: number; question: string; start_ord: number; end_ord: number; common_ground: string | null }[]>`
    select id, question, start_ord, end_ord, common_ground from interp_questions
    where book_id = ${book.id} and chapter = ${chapter} order by sort`;
  const views = qs.length
    ? await sql<{ id: number; question_id: number; view_label: string; holders: string | null; title: string; claim_ids: number[] }[]>`
        select i.id, i.question_id, i.view_label, i.holders, i.title,
               coalesce(array_agg(ic.claim_id order by ic.claim_id) filter (where ic.claim_id is not null), '{}') as claim_ids
        from interpretations i left join interpretation_claims ic on ic.interpretation_id = i.id
        where i.question_id = any(${qs.map((q) => q.id)}) group by i.id order by i.sort`
    : [];
  const interpretations = qs.map((q) => ({
    id: q.id,
    question: q.question,
    range: range(q.start_ord, q.end_ord) ?? "",
    commonGround: q.common_ground,
    views: views
      .filter((v) => v.question_id === q.id)
      .map((v) => {
        const vc = v.claim_ids.map((id) => claimById.get(id)).filter((c): c is ClaimView => !!c);
        // "Most commentators" is itself a claim about scholarship — shown only once verified.
        const verified = vc.length > 0 && vc.every((c) => c.status === "verified");
        return { label: v.view_label, holders: verified ? v.holders : null, title: v.title, claims: vc };
      }),
  }));

  const items = await sql<{ id: number; kind: string; text: string; expected_label: Label | null; explanation: string | null; claim_id: number | null; anchor_start: number | null; anchor_end: number | null }[]>`
    select id, kind, text, expected_label, explanation, claim_id, anchor_start, anchor_end from reflection_items
    where book_id = ${book.id} and chapter = ${chapter} order by sort, id`;

  const ledger = { explicit: 0, inference: 0, historical: 0, scholarly: 0, tradition: 0, personal: 0 } as Record<Label, number>;
  for (const c of claims) if (c.step !== "reflect") ledger[c.label]++;

  return {
    status: statusRow?.status ?? "none",
    error: statusRow?.error ?? null,
    generatedAt: statusRow?.generated_at?.toISOString() ?? null,
    claims,
    sections,
    repeated: repeatedWords(verses),
    language,
    connections,
    interpretations,
    statements: items
      .filter((i) => i.kind === "statement" && i.expected_label)
      .map((i) => ({ id: i.id, text: i.text, expected: i.expected_label!, explanation: i.explanation, claim: i.claim_id ? claimById.get(i.claim_id) ?? null : null })),
    prompts: items.filter((i) => i.kind === "prompt").map((i) => ({ id: i.id, text: i.text, range: i.anchor_start ? range(i.anchor_start, i.anchor_end ?? i.anchor_start) : null })),
    ledger,
    intros: [...(await getBookIntros(book.id))],
    withheld,
  };
}

function dedupeCitations(rows: (Citation & { claim_id: number })[]): Citation[] {
  const seen = new Set<string>();
  return rows
    .filter((r) => {
      const k = `${r.key}|${r.locator}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .map((c) => ({ key: c.key, title: c.title, source_type: c.source_type, orientation: c.orientation, tier: c.tier, locator: c.locator, url: c.url, checked: c.checked, quote: c.quote, written: c.written, tradition: c.tradition }));
}
