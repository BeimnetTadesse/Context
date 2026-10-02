// Restores Amharic 1962 verses missing from the eBible.org e-text, using WordProject's copy of the same
// translation (downloaded by `npm run data:amharic`). Only gaps are touched: wherever the eBible text exists it
// is kept (the two copies agree word for word on 7,106 of 7,112 shared verses). A gap is filled only when
// WordProject's verses cover exactly the same verses; anything else is reported, not guessed.
// Restored rows are tagged with the WordProject source so the reader can see (and check) them.
// Additive and idempotent. Run: npm run db:amharic
import { config } from "dotenv";
config({ path: ".env.local" });
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";
import { NT_BOOKS } from "../lib/bible/books";
import { toWeb } from "../lib/bible/versification";
import { parseWordProjectChapter } from "../lib/bible/wordproject";

const sql = postgres(process.env.DATABASE_URL!, { onnotice: () => {}, max: 1 });
const RAW = join(process.cwd(), "data/raw/wordproject-am");

/** Drop the printed footnotes WordProject appends to a verse ("… ፍ1 ሌጌዎን ማለት …"). */
const stripFootnotes = (t: string) => t.replace(/\s+ፍ\d+\s[\s\S]*$/, "").trim();

interface Span { start: number; end: number; text: string } // WEB verse numbers, within one chapter

async function main() {
  if (!existsSync(RAW)) throw new Error("Run `npm run data:amharic` first.");
  const verses = await sql<{ ord: number; osis: string; chapter: number; verse: number }[]>`
    select v.ord, b.osis, v.chapter, v.verse from verses v join books b on b.id = v.book_id where b.testament = 'NT' order by v.ord`;
  const ordOf = new Map(verses.map((v) => [`${v.osis}.${v.chapter}.${v.verse}`, v.ord]));
  const refOf = new Map(verses.map((v) => [v.ord, v]));
  const amh = await sql<{ ord: number; end_ord: number | null; text: string; para: boolean; source_id: number | null }[]>`
    select ord, end_ord, text, para, source_id from verse_texts where translation_code = 'AMH'`;
  const amhAt = new Map(amh.map((r) => [r.ord, r]));
  const coveredBy = new Map<number, number>(); // ord → row ord whose text includes it
  for (const r of amh) for (let o = r.ord; o <= (r.end_ord ?? r.ord); o++) coveredBy.set(o, r.ord);

  // WordProject, renumbered to WEB order: chapter key → spans.
  const wp = new Map<string, Span[]>();
  for (const [i, book] of NT_BOOKS.entries()) {
    for (let c = 1; existsSync(join(RAW, String(40 + i), `${c}.htm`)); c++) {
      let pending: number[] = [];
      for (const v of parseWordProjectChapter(readFileSync(join(RAW, String(40 + i), `${c}.htm`), "utf8"))) {
        if (v.text === null) { pending.push(v.verse); continue; }
        const a = toWeb(book.osis, c, pending[0] ?? v.verse);
        const b = toWeb(book.osis, c, v.verse);
        pending = [];
        if (a.chapter !== b.chapter) continue;
        const key = `${book.osis}.${a.chapter}`;
        wp.set(key, [...(wp.get(key) ?? []), { start: a.verse, end: b.verse, text: stripFootnotes(v.text) }]);
      }
    }
  }

  // Gaps: an eBible merged range (usually the text of its last verse only), or verses with no row at all.
  const gaps: { ords: number[]; old: { ord: number; text: string; para: boolean } | null }[] = [];
  for (const r of amh) if (r.end_ord && r.source_id === null) gaps.push({ ords: range(r.ord, r.end_ord), old: r });
  for (const v of verses) {
    if (coveredBy.has(v.ord)) continue;
    const prev = gaps[gaps.length - 1];
    const p = prev && !prev.old ? refOf.get(prev.ords[prev.ords.length - 1])! : null;
    if (p && p.osis === v.osis && p.chapter === v.chapter && p.verse === v.verse - 1) prev.ords.push(v.ord); // neighbours: one gap
    else gaps.push({ ords: [v.ord], old: null });
  }

  const [src] = await sql<{ id: number }[]>`
    insert into sources (key, title, publisher, year, url, tier, source_type, orientation, license, can_display, notes, written)
    values ('AMH1962-WP', 'Amharic Bible (1962) — WordProject copy', 'WordProject (text: Bible Society of Ethiopia)', '1962',
            'https://www.wordproject.org/bibles/am/index.htm', 1, 'Primary text · translation', 'Ethiopian Protestant/Orthodox common Bible',
            'Non-commercial use permitted by WordProject; text © Bible Society of Ethiopia', true,
            'Used only to restore verses missing from the eBible.org e-text of the same translation.', '1962')
    on conflict (key) do update set title = excluded.title, url = excluded.url, license = excluded.license, notes = excluded.notes
    returning id`;

  const fills: { gap: (typeof gaps)[number]; rows: { ord: number; end_ord: number | null; text: string }[] }[] = [];
  const unresolved: string[] = [];
  for (const gap of gaps) {
    const first = refOf.get(gap.ords[0])!;
    const last = refOf.get(gap.ords[gap.ords.length - 1])!;
    const spans = (wp.get(`${first.osis}.${first.chapter}`) ?? []).filter((s) => s.end >= first.verse && s.start <= last.verse);
    const label = `${first.osis} ${first.chapter}:${first.verse}${last.verse !== first.verse ? `–${last.verse}` : ""}`;
    if (!spans.length) { unresolved.push(`${label}: not in WordProject either`); continue; }
    if (spans[0].start !== first.verse || spans[spans.length - 1].end !== last.verse) {
      unresolved.push(`${label}: WordProject groups these verses differently (${spans.map((s) => `${s.start}–${s.end}`).join(", ")})`);
      continue;
    }
    const added = spans.map((s) => s.text).join(" ");
    if (gap.old && added.replace(/\s/g, "").length < gap.old.text.replace(/\s/g, "").length * 1.1) continue; // already complete
    fills.push({
      gap,
      rows: spans.map((s) => ({
        ord: ordOf.get(`${first.osis}.${first.chapter}.${s.start}`)!,
        end_ord: s.end !== s.start ? ordOf.get(`${first.osis}.${first.chapter}.${s.end}`)! : null,
        text: s.text,
      })),
    });
  }

  await sql.begin(async (tx) => {
    for (const f of fills) {
      await tx`delete from verse_texts where translation_code = 'AMH' and ord = any(${f.gap.ords})`;
      for (const [i, r] of f.rows.entries())
        await tx`insert into verse_texts (translation_code, ord, end_ord, text, para, source_id)
                 values ('AMH', ${r.ord}, ${r.end_ord}, ${r.text}, ${i === 0 ? (f.gap.old?.para ?? false) : false}, ${src.id})`;
    }
    // The e-text sometimes printed a verse at the wrong number (Rom 16:25 held the last line of the doxology,
    // which belongs at 14:26 in Context's numbering). Once that verse is restored in its place, drop the stray copy.
    const strays = await tx<{ ord: number }[]>`
      delete from verse_texts e using verse_texts r, verses ve, verses vr
      where e.translation_code = 'AMH' and e.source_id is null and r.translation_code = 'AMH' and r.source_id = ${src.id}
        and r.ord <> e.ord and r.text = e.text and ve.ord = e.ord and vr.ord = r.ord and ve.book_id = vr.book_id
      returning e.ord`;
    if (strays.length) console.log(`removed ${strays.length} misplaced e-text verse(s): ${strays.map((s) => label(refOf.get(s.ord)!)).join(", ")}`);
  });

  const restoredVerses = fills.reduce((n, f) => n + f.gap.ords.length, 0);
  console.log(`restored ${fills.length} gaps (${restoredVerses} verses) from WordProject; ${unresolved.length} left as they were`);
  for (const u of unresolved) console.log("  ·", u);

  // A side-by-side list for checking by hand (not committed: data/raw is git-ignored).
  const report = [
    "# Amharic 1962 — verses restored from WordProject",
    "",
    "Each entry: what the eBible e-text had (or nothing), then the restored text. Check against a printed 1962 (1954 E.C.) Bible.",
    "",
    ...fills.map((f) => {
      const a = refOf.get(f.gap.ords[0])!;
      const b = refOf.get(f.gap.ords[f.gap.ords.length - 1])!;
      const ref = `${a.osis} ${a.chapter}:${a.verse}${b.verse !== a.verse ? `–${b.verse}` : ""}`;
      const rows = f.rows.map((r) => `> **${refOf.get(r.ord)!.verse}${r.end_ord ? `–${refOf.get(r.end_ord)!.verse}` : ""}** ${r.text}`).join("\n>\n");
      return `## ${ref}\n\neBible had: ${f.gap.old ? `“${f.gap.old.text}”` : "nothing"}\n\nRestored:\n\n${rows}\n`;
    }),
    ...(unresolved.length ? ["## Not restored", "", ...unresolved.map((u) => `- ${u}`)] : []),
  ].join("\n");
  if (fills.length) {
    writeFileSync(join(process.cwd(), "data/raw/amharic-restored.md"), report);
    console.log("review list: data/raw/amharic-restored.md");
  }
  await sql.end();
}

const label = (v: { osis: string; chapter: number; verse: number }) => `${v.osis} ${v.chapter}:${v.verse}`;
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
