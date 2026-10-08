// Downloads the Church Fathers' comments on the New Testament and keeps only the old public-domain
// translations (see scripts/church-fathers.ts for the rules and why).
//   · quotes:  HistoricalChristianFaith/Commentaries-Database (its latest SQLite release)
//   · sources: HistoricalChristianFaith/Writings-Database (the full works, to read each one's translation note)
// Writes data/raw/fathers/quotes.json and a summary of what was kept and left out (data/raw/fathers/review.md).
// Needs git and the sqlite3 command-line tool. Run: npm run data:fathers
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { NT_BOOKS } from "../lib/bible/books";
import {
  bookSlug, EXCLUDED_CATEGORIES, EXCLUDED_WORKS, FATHER_NOTES, LAST_YEAR, MACHINE_NOTE, translationOf, TRUSTED_LINKS,
} from "./church-fathers";

const OUT = join(process.cwd(), "data/raw/fathers");
const DB = join(OUT, "commentaries.sqlite");
const WRITINGS = join(OUT, "writings");
const RELEASE = "https://github.com/HistoricalChristianFaith/Commentaries-Database/releases/latest/download/commentaries.sqlite";
const HCF_FILE = "https://historicalchristian.faith/by_father.php?file=";

type Row = {
  id: string; father: string; year: string; category: string; condemned: number; wiki: string | null;
  via: string | null; book: string; start: number; end: number; text: string; url: string | null; title: string | null;
};

export type FatherQuote = {
  id: string; father: string; year: number; category: string; condemned: boolean; note: string | null; wiki: string | null;
  book: string; startChapter: number; startVerse: number; endChapter: number; endVerse: number;
  text: string; work: string | null; via: string | null; translation: string; url: string | null;
};

async function main() {
  mkdirSync(OUT, { recursive: true });
  if (!existsSync(DB)) {
    console.log("Downloading the quotes database (≈160 MB)…");
    const r = await fetch(RELEASE);
    if (!r.ok) throw new Error(`${r.status} ${RELEASE}`);
    writeFileSync(DB, Buffer.from(await r.arrayBuffer()));
  }
  if (!existsSync(WRITINGS)) {
    console.log("Cloning the source works (≈470 MB)…");
    execFileSync("git", ["clone", "-q", "--depth", "1", "https://github.com/HistoricalChristianFaith/Writings-Database.git", WRITINGS], { stdio: "inherit" });
  }

  const books = NT_BOOKS.map((b) => `'${b.slug.replace("-", "")}'`).join(",");
  const rows: Row[] = JSON.parse(
    execFileSync("sqlite3", ["-json", DB, `
      select c.id, c.father_name as father, m.default_year as year, m.father_category as category,
             m.condemned_by_council as condemned, m.wiki_url as wiki, c.append_to_author_name as via, c.book,
             c.location_start as start, c.location_end as end, c.txt as text, c.source_url as url, c.source_title as title
      from commentary c join father_meta m on m.name = c.father_name
      where cast(m.default_year as int) <= ${LAST_YEAR} and c.book in (${books})`], { maxBuffer: 1 << 30 }).toString() || "[]",
  );

  const kept: FatherQuote[] = [];
  const left = new Map<string, number>(); // reason → quotes
  const works = new Map<string, number>(); // kept work → quotes
  const drop = (reason: string) => left.set(reason, (left.get(reason) ?? 0) + 1);
  const machine = new Map<string, boolean>();

  for (const r of rows) {
    if (EXCLUDED_CATEGORIES.includes(r.category)) { drop(`Not a Church Father (${r.category})`); continue; }
    if (!r.text?.trim()) { drop("Empty"); continue; }
    let file: string;
    if (r.url?.startsWith(HCF_FILE)) {
      file = decodeURIComponent(decodeURIComponent(r.url.slice(HCF_FILE.length)));
      if (EXCLUDED_WORKS.some((re) => re.test(file))) { drop("Modern or untraced translation"); continue; }
      if (!machine.has(file)) {
        const path = join(WRITINGS, file);
        machine.set(file, !existsSync(path) || MACHINE_NOTE.test(readFileSync(path, "utf8")));
      }
      if (machine.get(file)) { drop("Translated by AI or freshly from Migne (says so in the source), or source missing"); continue; }
    } else if (r.url && TRUSTED_LINKS.some((re) => re.test(r.url!))) {
      file = `${r.father}/`;
    } else {
      drop(r.url ? "Modern edition (Google Books, archive.org …)" : "No source link (modern, fair-use excerpt)");
      continue;
    }

    const translation = translationOf(file, r.category);
    const catena = file.startsWith("Thomas Aquinas/Catena Aurea/");
    kept.push({
      id: r.id, father: r.father, year: Number(r.year), category: r.category, condemned: r.condemned === 1,
      note: FATHER_NOTES[r.father] ?? null, wiki: r.wiki,
      book: bookSlug(r.book),
      startChapter: Math.floor(r.start / 1e6), startVerse: r.start % 1e6, endChapter: Math.floor(r.end / 1e6), endVerse: r.end % 1e6,
      text: r.text.trim(), work: catena ? null : r.title, via: catena ? "Quoted in Aquinas’s Catena Aurea (1274)" : null,
      translation, url: r.url,
    });
    const work = catena ? "Catena Aurea (Aquinas)" : `${r.father} · ${file.split("/")[1]?.replace(/\.html$/, "") ?? r.title}`;
    works.set(work, (works.get(work) ?? 0) + 1);
  }

  writeFileSync(join(OUT, "quotes.json"), JSON.stringify(kept));
  const fathers = new Set(kept.map((q) => q.father));
  const md = [
    `# Church Fathers: what was kept`,
    ``,
    `${kept.length} quotes from ${fathers.size} writers (to AD ${LAST_YEAR}) kept; ${rows.length - kept.length} left out.`,
    ``,
    `## Left out`,
    ...[...left].sort((a, b) => b[1] - a[1]).map(([k, n]) => `- ${n} · ${k}`),
    ``,
    `## Kept, by work`,
    ...[...works].sort((a, b) => b[1] - a[1]).map(([k, n]) => `- ${n} · ${k}`),
  ].join("\n");
  writeFileSync(join(OUT, "review.md"), md);
  console.log(md.split("\n").slice(0, 14).join("\n"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
