// Imports the Hebrew (and Aramaic) Old Testament for the interlinear, and its lexicon, from STEP Bible:
//   · TAHOT: every word of the Leningrad Codex with transliteration, gloss, grammar and Strong's number (CC BY 4.0)
//   · TBESH: the brief Hebrew lexicon of extended Strong's numbers, abridged from Brown-Driver-Briggs (CC BY 4.0)
// Words are placed by TAHOT's English verse reference ("Mal.4.1(3.19)" → Malachi 4:1), so they line up with WEB.
// Only the written text (Leningrad, type L…) is used; the marginal readings (Qere) are left out so no word is doubled.
// Idempotent: replaces the Hebrew rows only. Needs data/raw/tahot1-4.txt and tbesh.txt (npm run data:fetch).
// Run: npm run db:hebrew
import { config } from "dotenv";
config({ path: ".env.local" });
import { readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";
import { bookByStep } from "../lib/bible/books";

const sql = postgres(process.env.DATABASE_URL!, { onnotice: () => {}, max: 1 });
const RAW = join(process.cwd(), "data/raw");

/** One TAHOT word line → its parts, or null for headers, notes and marginal readings. */
export function parseTahotLine(line: string) {
  const m = /^([1-3]?[A-Z][a-z]+)\.(\d+)\.(\d+)(?:\([^)]*\))?[^#\t]*#(\d+)=([A-Za-z()]+)\t/.exec(line);
  if (!m || !m[5].startsWith("L")) return null;
  const c = line.split("\t");
  const surface = (c[1] ?? "").replace(/[/\\]/g, "").trim();
  if (!surface) return null;
  // dStrongs like "H9003/{H7225G}": the braced number is the word itself; the rest are prefixes (and, the, in…).
  const main = /\{(H\d{4}[A-Z]?)\}/.exec(c[4] ?? "")?.[1] ?? /(H\d{4}[A-Z]?)/.exec(c[4] ?? "")?.[1] ?? null;
  return {
    book: m[1], chapter: Number(m[2]), verse: Number(m[3]), position: Number(m[4]),
    surface,
    translit: (c[2] ?? "").replace(/[/\\]/g, "").trim() || null,
    gloss: (c[3] ?? "").replace(/\//g, " ").replace(/\\/g, "").replace(/\s+/g, " ").trim() || null,
    strongs: main,
    morph: (c[5] ?? "").trim() || null,
  };
}

async function source(key: string, title: string, license: string, tier: number, type: string, notes: string) {
  const [row] = await sql<{ id: number }[]>`
    insert into sources (key, title, publisher, year, url, tier, source_type, license, can_display, notes)
    values (${key}, ${title}, 'STEP Bible, Tyndale House Cambridge', null, 'https://www.STEPBible.org', ${tier}, ${type}, ${license}, true, ${notes})
    on conflict (key) do update set title = excluded.title, license = excluded.license, notes = excluded.notes, source_type = excluded.source_type
    returning id`;
  return row.id;
}

async function main() {
  const lexId = await source("BDB-TBESH", "Brief Hebrew Lexicon (Brown-Driver-Briggs, abridged; STEP TBESH)",
    "Public domain text; STEP edition CC BY 4.0", 3, "Lexicon", "Hebrew and Aramaic lexicon keyed by extended Strong's numbers.");
  const wlcId = await source("WLC", "Hebrew Bible (Leningrad Codex, tagged in STEP TAHOT)",
    "Public domain text; STEP tagging CC BY 4.0 — credit STEP Bible (www.STEPBible.org)", 1, "Primary text · Hebrew and Aramaic", "The Masoretic text of the Leningrad Codex.");
  await sql`insert into translations (code, name, language, source_id) values ('WLC', 'Hebrew Bible (Leningrad Codex)', 'he', ${wlcId})
            on conflict (code) do update set name = excluded.name, source_id = excluded.source_id`;

  // Lexicon: one entry per extended Strong's number ("H7225G").
  const lemmas = new Map<string, { strongs: string; lemma: string; translit: string | null; gloss: string | null; definition: string | null; source_id: number }>();
  for (const line of readFileSync(join(RAW, "tbesh.txt"), "utf8").split("\n")) {
    const c = line.split("\t");
    if (!/^H\d/.test(c[0] ?? "")) continue;
    const strongs = (c[1] ?? "").split("=")[0].trim() || c[0];
    if (!/^H\d{4}[A-Z]?$/.test(strongs) || lemmas.has(strongs)) continue;
    lemmas.set(strongs, { strongs, lemma: c[3] ?? "", translit: c[4] || null, gloss: c[6] || null, definition: c[7] || null, source_id: lexId });
  }

  const verses = await sql<{ ord: number; book_id: number; chapter: number; verse: number }[]>`
    select v.ord, v.book_id, v.chapter, v.verse from verses v join books b on b.id = v.book_id where b.testament = 'OT'`;
  const ordOf = new Map(verses.map((v) => [`${v.book_id}.${v.chapter}.${v.verse}`, v.ord]));
  const words: { ord: number; position: number; surface: string; translit: string | null; gloss: string | null; strongs: string | null; morph: string | null }[] = [];
  const text = new Map<number, string[]>();
  const unplaced = new Set<string>();
  const seen = new Set<string>();
  for (const f of ["tahot1.txt", "tahot2.txt", "tahot3.txt", "tahot4.txt"]) {
    for (const line of readFileSync(join(RAW, f), "utf8").split("\n")) {
      const w = parseTahotLine(line);
      if (!w) continue;
      const book = bookByStep(w.book);
      // A Psalm title is "verse 0" in TAHOT: keep it with verse 1, before its words (negative positions = title).
      const title = w.verse === 0;
      const ord = book && ordOf.get(`${book.id}.${w.chapter}.${title ? 1 : w.verse}`);
      if (title) w.position -= 1000;
      if (!ord) { unplaced.add(`${w.book}.${w.chapter}.${w.verse}`); continue; }
      const k = `${ord}.${w.position}`;
      if (seen.has(k)) continue;
      seen.add(k);
      const strongs = w.strongs && (lemmas.has(w.strongs) ? w.strongs : lemmas.has(w.strongs.replace(/[A-Z]$/, "")) ? w.strongs.replace(/[A-Z]$/, "") : w.strongs);
      words.push({ ord, position: w.position, surface: w.surface, translit: w.translit, gloss: w.gloss, strongs, morph: w.morph });
      if (!title) text.set(ord, [...(text.get(ord) ?? []), w.surface]);
    }
  }

  const firstNt = (await sql<{ ord: number }[]>`select min(v.ord) as ord from verses v join books b on b.id = v.book_id where b.testament = 'NT'`)[0].ord;
  await sql.begin(async (tx) => {
    await tx`delete from greek_words where ord < ${firstNt}`;
    await tx`delete from lemmas where strongs like 'H%'`;
    await tx`delete from verse_texts where translation_code = 'WLC'`;
    const lex = [...lemmas.values()];
    for (let i = 0; i < lex.length; i += 2000) await tx`insert into lemmas ${tx(lex.slice(i, i + 2000))}`;
    for (let i = 0; i < words.length; i += 5000) await tx`insert into greek_words ${tx(words.slice(i, i + 5000))}`;
    const rows = [...text].map(([ord, w]) => ({ translation_code: "WLC", ord, end_ord: null, text: w.join(" "), para: false }));
    for (let i = 0; i < rows.length; i += 5000) await tx`insert into verse_texts ${tx(rows.slice(i, i + 5000))}`;
  });
  console.log(`Hebrew: ${lemmas.size} lexicon entries · ${words.length} words in ${text.size} verses` +
    (unplaced.size ? ` · ${unplaced.size} verses not placed (e.g. ${[...unplaced].slice(0, 5).join(", ")})` : ""));
  await sql.end();
}

if (process.argv[1]?.endsWith("import-hebrew.ts")) main().catch(async (e) => { console.error(e); await sql.end(); process.exit(1); });
