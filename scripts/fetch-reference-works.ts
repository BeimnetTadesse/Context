// Downloads two public-domain reference works' articles on the New Testament books, for book overviews:
//   · International Standard Bible Encyclopedia (1915), from internationalstandardbible.com (robots.txt allows all)
//   · Easton's Bible Dictionary (1897), from the Christian Classics Ethereal Library ("Public Domain -- Copy Freely")
// Saves raw pages in data/raw/reference/; cached, so re-running only fetches what's missing. One request at a time.
// Run: npm run data:reference
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ISBE_PAGES } from "./reference-works";

const OUT = join(process.cwd(), "data/raw/reference");
const ISBE = "https://www.internationalstandardbible.com";


async function get(url: string, tries = 4): Promise<string> {
  for (let i = 1; ; i++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": "Context Bible study (non-commercial; github.com/BeimnetTadesse/Context)" } });
      if (r.ok) return await r.text();
      if (i >= tries) throw new Error(`${r.status} ${url}`);
    } catch (e) {
      if (i >= tries) throw e;
    }
    await new Promise((res) => setTimeout(res, 1500 * i));
  }
}

async function save(dir: string, name: string, url: string) {
  mkdirSync(join(OUT, dir), { recursive: true });
  const file = join(OUT, dir, name);
  if (existsSync(file)) return false;
  writeFileSync(file, await get(url));
  await new Promise((res) => setTimeout(res, 400));
  return true;
}

async function main() {
  let fetched = 0;
  for (const page of new Set(Object.values(ISBE_PAGES).flat())) {
    if (await save("isbe", `${page.replace("/", "_")}.html`, `${ISBE}/${page}.html`)) fetched++;
  }
  // Easton's: 100 topics per file (T0000000, T0000100, …). Past the end the site serves an index page with a
  // success code, so a file only counts if it holds its own first topic.
  for (let n = 0; n < 10000; n += 100) {
    const name = `T${String(n).padStart(7, "0")}.html`;
    const file = join(OUT, "easton", name);
    if (!existsSync(file)) {
      const html = await get(`https://ccel.org/ccel/easton/ebd/ebd/${name}`);
      if (!html.includes(`<A NAME="T${String(Math.max(n, 1)).padStart(7, "0")}">`)) break; // past the last file
      mkdirSync(join(OUT, "easton"), { recursive: true });
      writeFileSync(file, html);
      fetched++;
      await new Promise((res) => setTimeout(res, 400));
    }
  }
  console.log(`fetched ${fetched} new pages into data/raw/reference`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
