// Imports ISBE (1915) and Easton's Bible Dictionary (1897) articles on the New Testament books as book
// introductions (next to the commentators'), so book overviews and the Context step can use them.
// Additive and idempotent: replaces only these two sources' introductions. Run after `npm run data:reference`.
// Run: npm run db:reference
import { config } from "dotenv";
config({ path: ".env.local" });
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";
import { NT_BOOKS } from "../lib/bible/books";
import { ISBE_PAGES } from "./reference-works";

const sql = postgres(process.env.DATABASE_URL!, { onnotice: () => {}, max: 1 });
const RAW = join(process.cwd(), "data/raw/reference");

const decode = (s: string) =>
  s.replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&#39;|&rsquo;/g, "’").replace(/&lsquo;/g, "‘").replace(/&ldquo;/g, "“")
    .replace(/&rdquo;/g, "”").replace(/&mdash;/g, "—").replace(/&ndash;/g, "–").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const clean = (s: string) => decode(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

/** One ISBE page → paragraphs (headings kept as their own short paragraphs; outline and bibliography dropped). */
function isbePage(html: string): string[] {
  const start = html.indexOf('<div id="content">');
  const end = html.search(/<div[^>]+class="nav|<div id="sidebar"|<div class="sidebar"/);
  const body = html.slice(start, end > start ? end : undefined)
    .replace(/<p class="o[12]">[\s\S]*?<\/p>/g, "") // the article's table of contents (its headings repeat below)
    .replace(/<h1>[^<]*<\/h1>/, ""); // the article title
  const paras = [...body.matchAll(/<(h1|h2|h3|p)[^>]*>([\s\S]*?)<\/\1>/g)].map((m) => clean(m[2]))
    .map((p) => p.replace(/\((?:the )?(?:Greek|Hebrew)[^)]*missing here\)/gi, "").replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 1)
    // The website's own additions, not ISBE: continuation notes and "See also the McClintock and Strong…" links.
    .filter((p) => !/^Continued from /i.test(p) && !/McClintock and Strong/i.test(p) && !/^⇒/.test(p));
  // The bibliography starts at the last "Literature" heading. (The article's contents list near the top can
  // also say "LITERATURE", so only a heading in the second half counts.)
  const lit = paras.findLastIndex((p) => /^literature\.?$/i.test(p));
  const kept = lit > paras.length / 2 ? paras.slice(0, lit) : paras;
  return kept.filter((p) => !/^literature\.?$/i.test(p));
}

/** Easton's entries by title: <A NAME="T…"><B>Title - </B> text … (lines wrapped at ~65 characters). */
function eastonEntries(): Map<string, { text: string; url: string }> {
  const map = new Map<string, { text: string; url: string }>();
  for (const f of readdirSync(join(RAW, "easton")).sort()) {
    const html = readFileSync(join(RAW, "easton", f), "latin1");
    for (const part of html.split(/(?=<A NAME="T\d+">)/).slice(1)) {
      const m = part.match(/^<A NAME="(T\d+)">\s*<B>([^<]+?)\s*-\s*<\/B>([\s\S]*)$/);
      if (!m) continue;
      const paras = m[3].split(/<P>/i).map((p) => clean(p)).filter((p) => p.length > 1);
      map.set(m[2].trim(), { text: paras.join("\n\n"), url: `https://ccel.org/ccel/easton/ebd/ebd/${f}#${m[1]}` });
    }
  }
  return map;
}

const EASTON_TITLES: Record<string, string> = {
  matthew: "Matthew, Gospel according to", mark: "Mark, Gospel according to", luke: "Luke, Gospel according to",
  john: "John, Gospel of", acts: "Acts of the Apostles", romans: "Romans, Epistle to the",
  "1-corinthians": "Corinthians, First Epistle to the", "2-corinthians": "Corinthians, Second Epistle to the",
  galatians: "Galatians, Epistle to", ephesians: "Ephesians, Epistle to", philippians: "Philippians, Epistle to",
  colossians: "Colossians, Epistle to the", "1-thessalonians": "Thessalonians, Epistles to the",
  "2-thessalonians": "Thessalonians, Epistles to the", "1-timothy": "Timothy, First Epistle to",
  "2-timothy": "Timothy, Second Epistle to", titus: "Titus, Epistle to", philemon: "Philemon, Epistle to",
  hebrews: "Hebrews, Epistle to", james: "James, Epistle of", "1-peter": "Peter, First Epistle of",
  "2-peter": "Peter, Second Epistle of", "1-john": "John, First Epistle of", "2-john": "John, Second Epistle of",
  "3-john": "John, Third Epistle of", jude: "Jude, Epistle of", revelation: "Revelation, Book of",
};

async function source(key: string, s: { title: string; author: string; publisher: string; year: string; url: string; tier: number; type: string; tradition: string; notes: string }) {
  const [row] = await sql<{ id: number }[]>`
    insert into sources (key, title, author, publisher, year, url, tier, source_type, orientation, license, can_display, notes, written, tradition)
    values (${key}, ${s.title}, ${s.author}, ${s.publisher}, ${s.year}, ${s.url}, ${s.tier}, ${s.type}, ${s.tradition}, 'Public domain', true, ${s.notes}, ${s.year}, ${s.tradition})
    on conflict (key) do update set title = excluded.title, author = excluded.author, publisher = excluded.publisher, year = excluded.year,
      url = excluded.url, tier = excluded.tier, source_type = excluded.source_type, orientation = excluded.orientation,
      notes = excluded.notes, written = excluded.written, tradition = excluded.tradition
    returning id`;
  return row.id;
}

async function main() {
  if (!existsSync(join(RAW, "isbe")) || !existsSync(join(RAW, "easton"))) throw new Error("Run `npm run data:reference` first.");
  const isbe = await source("ISBE", {
    title: "The International Standard Bible Encyclopedia", author: "James Orr (general editor) and contributors", publisher: "Howard-Severance Company",
    year: "1915", url: "https://www.internationalstandardbible.com/", tier: 3, type: "Encyclopedia", tradition: "Evangelical scholarship (1915)",
    notes: "Articles on each New Testament book: authorship, date, setting, purpose, contents. Some Greek in the digital text was lost.",
  });
  const easton = await source("Easton", {
    title: "Easton’s Bible Dictionary", author: "M. G. Easton", publisher: "Thomas Nelson", year: "1897",
    url: "https://ccel.org/ccel/easton/ebd", tier: 6, type: "Bible dictionary", tradition: "Scottish Presbyterian",
    notes: "Short articles on each New Testament book, via the Christian Classics Ethereal Library.",
  });

  const entries = eastonEntries();
  let n = 0;
  for (const book of NT_BOOKS) {
    const isbeText = ISBE_PAGES[book.slug].flatMap((p) => isbePage(readFileSync(join(RAW, "isbe", `${p.replace("/", "_")}.html`), "utf8"))).join("\n\n");
    const eastonEntry = entries.get(EASTON_TITLES[book.slug]);
    if (!eastonEntry) console.warn(`no Easton entry for ${book.name}`);
    const isbeUrl = `https://www.internationalstandardbible.com/${ISBE_PAGES[book.slug][0]}.html`;
    for (const [src, text, url] of [[isbe, isbeText, isbeUrl], [easton, eastonEntry?.text, eastonEntry?.url ?? null]] as const) {
      if (!text || text.length < 200) {
        console.warn(`skipped ${book.name} (${src === isbe ? "ISBE" : "Easton"}): ${text?.length ?? 0} characters`);
        continue;
      }
      await sql`insert into book_intros (source_id, book_id, text, url) values (${src}, ${book.id}, ${text}, ${url})
                on conflict (source_id, book_id) do update set text = excluded.text, url = excluded.url`;
      n++;
    }
  }
  console.log(`imported ${n} book articles (ISBE + Easton) for ${NT_BOOKS.length} books`);
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
