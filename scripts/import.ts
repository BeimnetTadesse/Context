// ETL: raw open-licensed files in data/raw → Postgres.
// Extract (read files) → Transform (parse USFM/TSV into rows) → Load (bulk insert).
// Idempotent: clears the TEXT tables and reloads them. Knowledge/user tables are untouched.
// Run: npm run db:import
import { config } from "dotenv";
config({ path: ".env.local" });
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";
import { AMHARIC_1962_NOTICE } from "../lib/notices";
import { BOOKS, bookByOsis, bookByStep } from "../lib/bible/books";
import { toWeb } from "../lib/bible/versification";
import { parseUsfm } from "../lib/bible/usfm";

const sql = postgres(process.env.DATABASE_URL!, { onnotice: () => {}, max: 1 });
const RAW = join(process.cwd(), "data/raw");
const warnings: string[] = [];

// ─── Sources: every imported dataset is itself a cited source ───
const SOURCES = [
  {
    key: "WEB", title: "World English Bible", publisher: "eBible.org", year: "2020",
    url: "https://ebible.org/find/details.php?id=engwebp", tier: 1,
    source_type: "Primary text · translation", orientation: "ecumenical, formal-leaning",
    license: "Public domain", can_display: true,
  },
  {
    key: "AMH1962", title: "Amharic Bible (1962), New Testament", publisher: "Bible Society of Ethiopia / United Bible Societies",
    year: "1962, 2003", url: "https://ebible.org/find/details.php?id=amh", tier: 1,
    source_type: "Primary text · translation", orientation: "Ethiopian (Haile Selassie translation)",
    license: "Non-commercial use with full copyright statement",
    can_display: true,
    notes: AMHARIC_1962_NOTICE,
  },
  {
    key: "SBLGNT", title: "SBL Greek New Testament (words marked SBL in STEP TAGNT)", author: "Michael W. Holmes (ed.)",
    publisher: "Society of Biblical Literature / Logos", year: "2010", url: "https://www.sblgnt.com/license/", tier: 1,
    source_type: "Primary text · critical Greek text", orientation: "critical text",
    license: "CC BY 4.0", can_display: true,
  },
  {
    key: "STEP-TAGNT", title: "Translators Amalgamated Greek NT (TAGNT)", author: "Tyndale House, Cambridge",
    publisher: "STEPBible.org", year: "2024", url: "https://github.com/STEPBible/STEPBible-Data", tier: 4,
    source_type: "Tagged text · morphology & glosses", orientation: "academic",
    license: "CC BY 4.0 — credit STEP Bible (www.STEPBible.org)", can_display: true,
  },
  {
    key: "Abbott-Smith", title: "A Manual Greek Lexicon of the New Testament (via STEP TBESG)", author: "G. Abbott-Smith",
    publisher: "T&T Clark; digitised by STEPBible.org", year: "1922", url: "https://github.com/STEPBible/STEPBible-Data", tier: 3,
    source_type: "Lexicon", orientation: "academic",
    license: "Public domain text; STEP edition CC BY 4.0", can_display: true,
  },
  ...[
    ["KJV", "King James Version", "1611 (1769 Blayney edition)", "eng-kjv", "Anglican, Textus Receptus"],
    ["BSB", "Berean Standard Bible", "2016–2023", "engbsb", "evangelical, modern formal-functional"],
    ["ASV", "American Standard Version", "1901", "eng-asv", "Revised Version tradition, very literal"],
    ["YLT", "Young's Literal Translation", "1862 (rev. 1898)", "engylt", "hyper-literal, Textus Receptus"],
  ].map(([key, title, year, id, orientation]) => ({
    key, title, publisher: "eBible.org", year, url: `https://ebible.org/find/details.php?id=${id}`, tier: 1,
    source_type: "Primary text · translation", orientation, license: "Public domain", can_display: true,
    notes: key === "KJV" ? "Public domain outside the UK; in the UK printing is under Crown letters patent." : null,
  })),
  {
    key: "OpenBible", title: "Bible cross-references", publisher: "OpenBible.info", year: "2026",
    url: "https://www.openbible.info/labs/cross-references/", tier: 4,
    source_type: "Cross-reference dataset (mostly Treasury of Scripture Knowledge)", orientation: "general",
    license: "CC BY", can_display: true,
  },
];

async function bulk<T extends Record<string, unknown>>(table: string, rows: T[], size = 4000) {
  for (let i = 0; i < rows.length; i += size) {
    await sql`insert into ${sql(table)} ${sql(rows.slice(i, i + size) as never)}`;
  }
}

async function main() {
  // Safety: this script rebuilds the TEXT tables with TRUNCATE … CASCADE, which also removes every
  // prepared study and commentary that references them. Refuse unless explicitly forced.
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from information_schema.tables where table_name = 'claims'`;
  if (n) {
    const [{ c }] = await sql<{ c: number }[]>`select count(*)::int as c from claims`;
    if (c > 0 && process.env.FORCE_REBUILD !== "1") {
      console.error(`Refusing: ${c} claims exist and would be deleted. Use npm run db:translations to add versions,\nor FORCE_REBUILD=1 npm run db:import to rebuild everything from scratch.`);
      await sql.end();
      process.exit(1);
    }
  }
  console.time("import");
  await sql`truncate verse_texts, greek_words, cross_refs, lemmas, translations, verses, books, sources restart identity cascade`;

  // Sources
  const src = await sql`insert into sources ${sql(SOURCES.map((s) => ({ author: null, notes: null, ...s })))} returning id, key`;
  const sid = Object.fromEntries(src.map((r) => [r.key, r.id as number]));
  await sql`insert into translations ${sql([
    { code: "WEB", name: "World English Bible", language: "en", source_id: sid.WEB },
    { code: "AMH", name: "Amharic 1962", language: "am", source_id: sid.AMH1962 },
    { code: "SBLGNT", name: "SBL Greek New Testament", language: "grc", source_id: sid.SBLGNT },
    { code: "BSB", name: "Berean Standard Bible", language: "en", source_id: sid.BSB },
    { code: "KJV", name: "King James Version", language: "en", source_id: sid.KJV },
    { code: "ASV", name: "American Standard Version", language: "en", source_id: sid.ASV },
    { code: "YLT", name: "Young's Literal Translation", language: "en", source_id: sid.YLT },
  ])}`;

  // Verses: WEB defines our versification. Ordinals assigned in canon order.
  const webDir = join(RAW, "web");
  const web = readdirSync(webDir)
    .filter((f) => f.endsWith(".usfm"))
    .flatMap((f) => parseUsfm(join(webDir, f)))
    .sort((a, b) => a.book - b.book || a.chapter - b.chapter || a.verse - b.verse);

  const ordOf = new Map<string, number>();
  const key = (b: number, c: number, v: number) => `${b}.${c}.${v}`;
  web.forEach((v, i) => ordOf.set(key(v.book, v.chapter, v.verse), i + 1));

  const chapterCount = new Map<number, number>();
  for (const v of web) chapterCount.set(v.book, Math.max(chapterCount.get(v.book) ?? 0, v.chapter));
  await sql`insert into books ${sql(
    BOOKS.map((b) => ({ id: b.id, osis: b.osis, usfm: b.usfm, name: b.name, slug: b.slug, testament: b.testament, chapter_count: chapterCount.get(b.id) ?? 0 })),
  )}`;
  await bulk("verses", web.map((v, i) => ({ ord: i + 1, book_id: v.book, chapter: v.chapter, verse: v.verse })));
  await bulk("verse_texts", web.map((v, i) => ({ translation_code: "WEB", ord: i + 1, end_ord: null, text: v.text, para: v.para })));
  console.log(`WEB: ${web.length} verses, ${chapterCount.size} books`);

  // Amharic NT
  const amhDir = join(RAW, "amh");
  const amhRows = [];
  for (const f of readdirSync(amhDir).filter((f) => f.endsWith(".usfm"))) {
    for (const v of parseUsfm(join(amhDir, f))) {
      const ord = ordOf.get(key(v.book, v.chapter, v.verse));
      if (!ord) { warnings.push(`AMH verse not in WEB: ${v.book}.${v.chapter}.${v.verse}`); continue; }
      const end = v.verseEnd ? ordOf.get(key(v.book, v.chapter, v.verseEnd)) ?? null : null;
      if (v.text) amhRows.push({ translation_code: "AMH", ord, end_ord: end, text: v.text, para: v.para });
    }
  }
  await bulk("verse_texts", amhRows);
  console.log(`AMH: ${amhRows.length} verse rows (${amhRows.filter((r) => r.end_ord).length} merged ranges)`);

  // Other public-domain English translations (NT). Standard numbering is mapped to WEB's where they differ.
  for (const [code, dirName] of [["BSB", "engbsb"], ["KJV", "eng-kjv"], ["ASV", "eng-asv"], ["YLT", "engylt"]] as const) {
    const dir = join(RAW, dirName);
    const rows: { translation_code: string; ord: number; end_ord: null; text: string; para: boolean }[] = [];
    const seen = new Set<number>();
    for (const f of readdirSync(dir).filter((f) => f.endsWith(".usfm"))) {
      for (const v of parseUsfm(join(dir, f))) {
        const book = BOOKS.find((b) => b.id === v.book)!;
        if (book.testament !== "NT" || !v.text) continue;
        const w = toWeb(book.osis, v.chapter, v.verse);
        const ord = ordOf.get(key(v.book, w.chapter, w.verse));
        if (!ord || seen.has(ord)) { warnings.push(`${code} verse not placed: ${book.osis} ${v.chapter}:${v.verse}`); continue; }
        seen.add(ord);
        rows.push({ translation_code: code, ord, end_ord: null, text: v.text, para: v.para });
      }
    }
    await bulk("verse_texts", rows);
    console.log(`${code}: ${rows.length} NT verses`);
  }

  // Lexicon (Abbott-Smith via TBESG). Keyed by the disambiguated Strong's number that TAGNT uses.
  const lemmas = new Map<string, Record<string, unknown>>();
  for (const line of readFileSync(join(RAW, "tbesg.txt"), "utf8").split("\n")) {
    const c = line.split("\t");
    if (!/^G\d/.test(c[0] ?? "")) continue;
    const strongs = (c[1] ?? "").split("=")[0].trim() || c[0];
    if (lemmas.has(strongs)) continue;
    lemmas.set(strongs, { strongs, lemma: c[3], translit: c[4], gloss: c[6], definition: c[7] ?? null, source_id: sid["Abbott-Smith"] });
  }
  await bulk("lemmas", [...lemmas.values()], 2000);
  console.log(`Lexicon: ${lemmas.size} entries`);

  // Greek words (TAGNT). Keep only words in the SBL edition → the SBLGNT text, tagged.
  const words = [];
  const sblText = new Map<number, string[]>();
  const REFRX = /^([1-3]?[A-Z][a-z]+)\.(\d+)\.(\d+)(?:[{(][^#]*)?#(\d+)=/;
  for (const file of ["tagnt1.txt", "tagnt2.txt"]) {
    for (const line of readFileSync(join(RAW, file), "utf8").split("\n")) {
      const m = REFRX.exec(line);
      if (!m) continue;
      const c = line.split("\t");
      if (!/\bSBL\b/.test(c[5] ?? "")) continue;
      const book = bookByStep(m[1]);
      const ord = book && ordOf.get(key(book.id, Number(m[2]), Number(m[3])));
      if (!ord) { warnings.push(`TAGNT verse not in WEB: ${m[1]}.${m[2]}.${m[3]}`); continue; }
      const gm = /^(.*?)\s*\((.*)\)\s*$/.exec(c[1]);
      const surface = (gm?.[1] ?? c[1]).trim();
      let strongs = (c[3] ?? "").split("=")[0].trim();
      if (!lemmas.has(strongs) && lemmas.has(strongs.replace(/[A-Z]$/, ""))) strongs = strongs.replace(/[A-Z]$/, "");
      words.push({
        ord, position: Number(m[4]), surface, translit: gm?.[2] ?? null,
        gloss: c[2]?.trim() || null, strongs: strongs || null, morph: (c[3] ?? "").split("=")[1]?.trim() || null,
      });
      sblText.set(ord, [...(sblText.get(ord) ?? []), surface]);
    }
  }
  await bulk("greek_words", words);
  await bulk("verse_texts", [...sblText].map(([ord, w]) => ({ translation_code: "SBLGNT", ord, end_ord: null, text: w.join(" "), para: false })));
  console.log(`Greek: ${words.length} words in ${sblText.size} verses`);

  // Cross-references from NT verses (targets may be OT or NT).
  const xrefs = [];
  const toOrd = (osis: string) => {
    const [b, c, v] = osis.split(".");
    const book = bookByOsis(b);
    return book ? ordOf.get(key(book.id, Number(c), Number(v))) : undefined;
  };
  const range = (s: string) => {
    const [a, b] = s.split("-");
    const start = toOrd(a);
    return start ? [start, b ? toOrd(b) ?? start : start] : null;
  };
  const firstNt = BOOKS.find((b) => b.testament === "NT")!.id;
  for (const line of readFileSync(join(RAW, "xref/cross_references.txt"), "utf8").split("\n").slice(1)) {
    const [from, to, votes] = line.split("\t");
    if (!from || !to) continue;
    if ((bookByOsis(from.split(".")[0])?.id ?? 0) < firstNt) continue;
    const f = range(from), t = range(to);
    if (!f || !t) continue;
    xrefs.push({ from_start: f[0], from_end: f[1], to_start: t[0], to_end: t[1], votes: Number(votes) || 0, source_id: sid.OpenBible });
  }
  await bulk("cross_refs", xrefs);
  console.log(`Cross-refs from NT: ${xrefs.length}`);

  if (warnings.length) console.log(`\n${warnings.length} warnings (first 10):\n  ${warnings.slice(0, 10).join("\n  ")}`);
  console.timeEnd("import");
  await sql.end();
}

main().catch(async (e) => {
  console.error(e);
  await sql.end();
  process.exit(1);
});
