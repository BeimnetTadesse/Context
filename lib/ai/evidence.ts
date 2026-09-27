import "server-only";
import { sql } from "@/lib/db";
import type { Book } from "@/lib/bible/books";

// The evidence pack: the ONLY material the model may use. Every item has an id the model must cite.
//   V:Eph.3.6   a verse (WEB text + SBL Greek)
//   L:G3466     a lexicon entry (Abbott-Smith via STEP)
//   X:12345     a cross-reference target (OpenBible), with its verse text
//   C:42        an existing claim in the database (with its label and status)
//   K:1234.0    a paragraph of a named commentator's note (Calvin, Henry, Gill, Clarke, JFB, Tyndale)
export interface EvidenceItem {
  id: string;
  kind: "verse" | "lexicon" | "xref" | "claim" | "commentary";
  text: string;
  meta?: Record<string, unknown>;
}

export interface EvidencePack {
  items: EvidenceItem[];
  byId: Map<string, EvidenceItem>;
  verseText: Map<number, string>; // ord → WEB text, for checking quoted phrases
  ordById: Map<string, number>; // V:… id → ord
  commentaryText: Map<string, string>; // K:… id → excerpt text, for checking quoted words
  academic: Set<string>; // K:… ids from tier 2–4 commentators
}

const vid = (book: Book, chapter: number, verse: number) => `V:${book.osis}.${chapter}.${verse}`;

export async function chapterEvidence(
  book: Book,
  chapter: number,
  opts: { lexicon?: number; xrefs?: number; claims?: boolean; commentary?: number; verseRange?: [number, number] } = {},
): Promise<EvidencePack> {
  const verses = await sql<{ ord: number; verse: number; web: string; greek: string | null }[]>`
    select v.ord, v.verse, w.text as web, g.text as greek
    from verses v
    join verse_texts w on w.ord = v.ord and w.translation_code = 'WEB'
    left join verse_texts g on g.ord = v.ord and g.translation_code = 'SBLGNT'
    where v.book_id = ${book.id} and v.chapter = ${chapter}
    order by v.ord`;
  const [lo, hi] = [verses[0].ord, verses[verses.length - 1].ord];

  const items: EvidenceItem[] = verses.map((v) => ({
    id: vid(book, chapter, v.verse),
    kind: "verse",
    text: `${v.web}${v.greek ? `  [Greek: ${v.greek}]` : "  [not in the SBL Greek text]"}`,
    meta: { ord: v.ord },
  }));

  // Lexicon: the chapter's content words, weighted towards words repeated here but not everywhere in the NT.
  if (opts.lexicon !== 0) {
    const lex = await sql<{ strongs: string; lemma: string; translit: string; gloss: string; definition: string | null; here: number; nt: number; verses: number[] }[]>`
      with here as (
        select g.strongs, count(*)::int as here, array_agg(distinct v.verse order by v.verse) as verses
        from greek_words g join verses v on v.ord = g.ord
        where g.ord between ${lo} and ${hi} and g.strongs is not null
          and g.morph !~ '^(T-|CONJ|PREP|PRT|P-|R-|D-|ADV|COND)'
        group by g.strongs
      )
      select l.strongs, l.lemma, l.translit, l.gloss, l.definition, h.here, h.verses,
             (select count(*)::int from greek_words x where x.strongs = l.strongs) as nt
      from here h join lemmas l on l.strongs = h.strongs
      order by (h.here::float / ln(2 + (select count(*) from greek_words x where x.strongs = l.strongs))) desc
      limit ${opts.lexicon ?? 18}`;
    for (const l of lex) {
      const def = (l.definition ?? "").replace(/<BR\s*\/?>/gi, " ").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").slice(0, 900);
      items.push({
        id: `L:${l.strongs}`,
        kind: "lexicon",
        text: `${l.lemma} (${l.translit}) — gloss: ${l.gloss}. In this chapter ${l.here}× (verses ${l.verses.join(", ")}); ${l.nt}× in the NT. Abbott-Smith: ${def}`,
        meta: { strongs: l.strongs, lemma: l.lemma },
      });
    }
  }

  // Cross-references: strongest-voted targets from this chapter.
  if (opts.xrefs !== 0) {
    const xr = await sql<{ id: number; from_verse: number; to_start: number; to_end: number; votes: number; ref: string; text: string }[]>`
      select x.id, fv.verse as from_verse, x.to_start, x.to_end, x.votes,
             tb.name || ' ' || tv.chapter || ':' || tv.verse ||
               case when x.to_end <> x.to_start then '–' || ev.verse else '' end as ref,
             (select string_agg(t.text, ' ' order by t.ord) from verse_texts t
               where t.translation_code = 'WEB' and t.ord between x.to_start and least(x.to_end, x.to_start + 3)) as text
      from cross_refs x
      join verses fv on fv.ord = x.from_start
      join verses tv on tv.ord = x.to_start join books tb on tb.id = tv.book_id
      join verses ev on ev.ord = x.to_end
      where x.from_start between ${lo} and ${hi} and x.votes > 5
        and not (x.to_start between ${lo} and ${hi})
      order by x.votes desc
      limit ${opts.xrefs ?? 30}`;
    for (const x of xr) {
      items.push({
        id: `X:${x.id}`,
        kind: "xref",
        text: `${x.ref} (linked from v${x.from_verse}, ${x.votes} votes): ${x.text}`,
        meta: { to_start: x.to_start, to_end: x.to_end, ref: x.ref },
      });
    }
  }

  // Existing claims about this chapter or book (verified first).
  if (opts.claims) {
    const cl = await sql<{ id: number; label: string; statement: string; status: string; chapter: number | null }[]>`
      select id, label, statement, status, chapter from claims
      where book_id = ${book.id} and (chapter = ${chapter} or chapter is null) and status = 'verified'
      order by id limit 80`;
    for (const c of cl) {
      items.push({
        id: `C:${c.id}`,
        kind: "claim",
        text: `[${c.label}${c.status === "verified" ? ", verified" : ", unverified draft"}${c.chapter ? "" : ", book-level"}] ${c.statement}`,
      });
    }
  }

  // Commentary: split notes into paragraphs, give each commentator an equal share of the budget,
  // and spread each share across the chapter (round-robin by verse) so no voice or section dominates.
  const commentaryText = new Map<string, string>();
  const academic = new Set<string>();
  if (opts.commentary) {
    const notes = await sql<{ id: number; key: string; author: string; written: string; tradition: string; tier: number; text: string; sv: number; ev: number }[]>`
      select n.id, s.key, s.author, s.written, s.tradition, s.tier, n.text, a.verse as sv, z.verse as ev
      from commentary_notes n join sources s on s.id = n.source_id
      join verses a on a.ord = n.start_ord join verses z on z.ord = n.end_ord
      where n.start_ord <= ${hi} and n.end_ord >= ${lo}
      order by s.written, n.start_ord, n.sort`;
    const byKey = new Map<string, { id: string; text: string; head: string; tier: number; key: string; range: string }[]>();
    for (const n of notes) {
      const paras = n.text.split(/\n\s*\n/).map((p) => p.replace(/\s+/g, " ").trim()).filter((p) => p.length > 40);
      const range = n.sv === n.ev ? `${chapter}:${n.sv}` : `${chapter}:${n.sv}–${n.ev}`;
      paras.forEach((p, i) => {
        const text = p.length > 700 ? p.slice(0, 700).replace(/\s+\S*$/, "") + "…" : p;
        const list = byKey.get(n.key) ?? [];
        list.push({ id: `K:${n.id}.${i}`, text, head: `${n.author} (${n.written}, ${n.tradition}) on ${range}`, tier: n.tier, key: n.key, range });
        byKey.set(n.key, list);
      });
    }
    const share = Math.floor(opts.commentary / Math.max(1, byKey.size));
    for (const [, paras] of byKey) {
      let used = 0;
      const step = Math.max(1, Math.floor(paras.length / Math.max(1, Math.floor(share / 450))));
      for (let i = 0; i < paras.length && used < share; i += step) {
        const p = paras[i];
        items.push({ id: p.id, kind: "commentary", text: `${p.head}: ${p.text}`, meta: { key: p.key, range: `on ${p.range}` } });
        commentaryText.set(p.id, p.text);
        if (p.tier >= 2 && p.tier <= 4) academic.add(p.id);
        used += p.text.length;
      }
    }
  }

  const verseText = new Map(verses.map((v) => [v.ord, v.web]));
  const ordById = new Map(verses.map((v) => [vid(book, chapter, v.verse), v.ord]));
  return { items, byId: new Map(items.map((i) => [i.id, i])), verseText, ordById, commentaryText, academic };
}

export const renderEvidence = (pack: EvidencePack) =>
  pack.items.map((i) => `<evidence id="${i.id}">${i.text}</evidence>`).join("\n");
