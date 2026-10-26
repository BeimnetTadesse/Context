// Imports the Amharic Old Testament (1962 Haile Selassie Bible, Bible Society of Ethiopia) from WordProject's copy
// (downloaded by `npm run data:amharic`; the eBible.org e-text Context uses for the NT has no Old Testament).
// A chapter is imported only where its verses line up with the World English Bible's: the same number of verses, AND
// verse lengths that track the English (an Amharic verse and its English verse are roughly proportional in length).
// The second check catches chapters that follow the Hebrew numbering with the same count, e.g. Jonah 2, where the
// English 1:17 is the Hebrew 2:1. Everything left out is listed in data/raw/amharic-ot-review.md, not guessed.
// Idempotent: replaces only the Amharic Old Testament rows. Run: npm run db:amharic-ot
import { config } from "dotenv";
config({ path: ".env.local" });
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";
import { BOOKS } from "../lib/bible/books";
import { parseWordProjectChapter } from "../lib/bible/wordproject";

const sql = postgres(process.env.DATABASE_URL!, { onnotice: () => {}, max: 1 });
const RAW = join(process.cwd(), "data/raw/wordproject-am");
const stripFootnotes = (t: string) => t.replace(/\s+ፍ\d+\s[\s\S]*$/, "").trim();

async function main() {
  const [src] = await sql<{ id: number }[]>`
    insert into sources (key, title, publisher, year, url, tier, source_type, orientation, license, can_display, notes, written)
    values ('AMH1962-WP', 'Amharic Bible (1962) — WordProject copy', 'WordProject (text: Bible Society of Ethiopia)', '1962',
            'https://www.wordproject.org/bibles/am/index.htm', 1, 'Primary text · translation', 'Ethiopian Protestant/Orthodox common Bible',
            'Non-commercial use permitted by WordProject; text © Bible Society of Ethiopia', true,
            'The Old Testament, and verses missing from the eBible.org e-text of the New Testament.', '1962')
    on conflict (key) do update set title = excluded.title, url = excluded.url, license = excluded.license, notes = excluded.notes
    returning id`;
  const verses = await sql<{ ord: number; book_id: number; chapter: number; verse: number; web: number }[]>`
    select v.ord, v.book_id, v.chapter, v.verse, coalesce(length(w.text), 0) as web
    from verses v join books b on b.id = v.book_id left join verse_texts w on w.ord = v.ord and w.translation_code = 'WEB'
    where b.testament = 'OT' order by v.ord`;
  const seq = new Map(verses.map((v, i) => [v.ord, i])); // position in the whole OT, to test shifted alignments
  const ordOf = new Map(verses.map((v) => [`${v.book_id}.${v.chapter}.${v.verse}`, v.ord]));
  const webCount = new Map<string, number>();
  for (const v of verses) webCount.set(`${v.book_id}.${v.chapter}`, Math.max(webCount.get(`${v.book_id}.${v.chapter}`) ?? 0, v.verse));

  const rows: { translation_code: string; ord: number; end_ord: number | null; text: string; para: boolean; source_id: number }[] = [];
  const mismatched: string[] = [];
  const shifted: string[] = [];
  const missing: string[] = [];
  let chapters = 0;
  for (const book of BOOKS.filter((b) => b.testament === "OT")) {
    const dir = join(RAW, String(book.id).padStart(2, "0"));
    for (let c = 1; c <= book.chapters; c++) {
      const file = join(dir, `${c}.htm`);
      if (!existsSync(file)) { missing.push(`${book.name} ${c}`); continue; }
      const wp = parseWordProjectChapter(readFileSync(file, "utf8"));
      const last = wp.length ? wp[wp.length - 1].verse : 0;
      const web = webCount.get(`${book.id}.${c}`) ?? 0;
      if (last !== web) { mismatched.push(`${book.name} ${c}: Amharic ${last} verses, WEB ${web}`); continue; }
      // A verse printed as "-" is combined with the next one that carries text: one row covering both.
      const chapterRows: typeof rows = [];
      let pending: number | null = null;
      for (const v of wp) {
        if (v.text === null) { pending ??= v.verse; continue; }
        const start = ordOf.get(`${book.id}.${c}.${pending ?? v.verse}`);
        const end = ordOf.get(`${book.id}.${c}.${v.verse}`);
        pending = null;
        if (!start || !end) continue;
        chapterRows.push({ translation_code: "AMH", ord: start, end_ord: end !== start ? end : null, text: stripFootnotes(v.text), para: false, source_id: src.id });
      }
      const fit = alignment(chapterRows.filter((r) => r.end_ord === null), (shift, ord) => verses[seq.get(ord)! + shift]?.web ?? 0);
      if (fit.shifted) { shifted.push(`${book.name} ${c}: lines up ${fit.best > 0 ? "+" : ""}${fit.best} verse(s) off (r ${fit.base.toFixed(2)} → ${fit.bestR.toFixed(2)})`); continue; }
      rows.push(...chapterRows);
      chapters++;
    }
  }

  await sql.begin(async (tx) => {
    await tx`delete from verse_texts where translation_code = 'AMH' and ord in (select v.ord from verses v join books b on b.id = v.book_id where b.testament = 'OT')`;
    for (let i = 0; i < rows.length; i += 4000) await tx`insert into verse_texts ${tx(rows.slice(i, i + 4000))}`;
  });
  const report = [
    "# Amharic Old Testament (WordProject): chapters not imported", "",
    `${chapters} chapters imported (${rows.length} verses). ${mismatched.length} chapters are numbered differently from the World English Bible and were left out rather than guessed:`, "",
    ...mismatched.map((m) => `- ${m}`),
    "", `${shifted.length} chapters have the same number of verses but line up better when shifted (they follow the Hebrew numbering), so they were left out too:`, "",
    ...shifted.map((m) => `- ${m}`),
    ...(missing.length ? ["", `Not downloaded (${missing.length}): ${missing.join(", ")}`] : []),
  ].join("\n");
  writeFileSync(join(process.cwd(), "data/raw/amharic-ot-review.md"), report);
  console.log(`${chapters} OT chapters, ${rows.length} verses imported · left out: ${mismatched.length} numbered differently, ${shifted.length} shifted · ${missing.length} not downloaded`);
  await sql.end();
}

/**
 * Do the Amharic verses line up with the English ones? Correlation of verse lengths at the given alignment, compared
 * with the best alignment shifted by up to 9 verses. "shifted" = clearly better when shifted, or the lengths run
 * opposite to each other. Short poetry with similar verse lengths scores low everywhere and is not flagged.
 */
export function alignment(rows: { ord: number; text: string }[], webLength: (shift: number, ord: number) => number) {
  const r = (shift: number) => pearson(rows.map((x) => [x.text.length, webLength(shift, x.ord)] as [number, number]).filter((p) => p[1] > 0));
  const base = r(0);
  let best = 0, bestR = base;
  for (let s = -9; s <= 9; s++) if (s) { const v = r(s); if (v > bestR) { bestR = v; best = s; } }
  const shifted = rows.length >= 5 && (base < 0 || (base < 0.5 && bestR - base >= 0.2 && bestR >= 0.55));
  return { base, best, bestR, shifted };
}

function pearson(xs: [number, number][]) {
  const n = xs.length;
  if (n < 5) return 1;
  const mx = xs.reduce((s, x) => s + x[0], 0) / n, my = xs.reduce((s, x) => s + x[1], 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (const [x, y] of xs) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; }
  return sxy / Math.sqrt(sxx * syy || 1);
}

main().catch(async (e) => { console.error(e); await sql.end(); process.exit(1); });
