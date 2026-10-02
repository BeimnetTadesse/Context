// Downloads the Amharic New Testament (1962 Haile Selassie Bible, Bible Society of Ethiopia) from WordProject,
// whose text fills the verses missing from the eBible.org e-text. WordProject allows non-profit use of its texts
// without asking (wordproject.org/contact/new/copyrights.htm). Saved as raw pages in data/raw/wordproject-am/;
// cached, so re-running only fetches what's missing. Polite: one request at a time.
// Run: npm run data:amharic
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { NT_BOOKS } from "../lib/bible/books";

const OUT = join(process.cwd(), "data/raw/wordproject-am");
const BASE = "https://www.wordproject.org/bibles/am";

async function get(url: string, tries = 4): Promise<string | null> {
  for (let i = 1; ; i++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": "Context Bible study (non-commercial)" } });
      if (r.status === 404) return null;
      if (r.ok) return await r.text();
      if (i >= tries) throw new Error(`${r.status} ${url}`);
    } catch (e) {
      if (i >= tries) throw e;
    }
    await new Promise((res) => setTimeout(res, 1500 * i));
  }
}

async function main() {
  let fetched = 0;
  for (const [i, book] of NT_BOOKS.entries()) {
    const num = String(40 + i).padStart(2, "0"); // WordProject numbers books 01–66 in English Bible order
    mkdirSync(join(OUT, num), { recursive: true });
    for (let c = 1; ; c++) {
      const file = join(OUT, num, `${c}.htm`);
      if (existsSync(file)) continue;
      const html = await get(`${BASE}/${num}/${c}.htm`);
      if (!html || !html.includes('id="textBody"')) break; // past the last chapter
      writeFileSync(file, html);
      fetched++;
      await new Promise((res) => setTimeout(res, 400));
    }
    process.stdout.write(`${book.osis} `);
  }
  console.log(`\nfetched ${fetched} new chapter pages into data/raw/wordproject-am`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
