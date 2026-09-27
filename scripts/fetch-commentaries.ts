// Downloads public-domain / CC BY-SA commentaries for the NT from the Free Use Bible API (bible.helloao.org)
// into data/raw/commentaries/<id>/<BOOK>/<chapter>.json. Cached: re-running only fetches what's missing.
// Run: npm run data:commentaries
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { NT_BOOKS } from "../lib/bible/books";

export const COMMENTARIES = ["john-calvin", "matthew-henry", "john-gill", "adam-clarke", "jamieson-fausset-brown", "tyndale"];
const API = "https://bible.helloao.org/api/c";
const OUT = join(process.cwd(), "data/raw/commentaries");

async function get(url: string, tries = 4): Promise<unknown> {
  for (let i = 1; ; i++) {
    const r = await fetch(url);
    if (r.status === 404) return null;
    if (r.ok) return r.json();
    if (i >= tries) throw new Error(`${r.status} ${url}`);
    await new Promise((res) => setTimeout(res, 1000 * i));
  }
}

async function main() {
  const jobs: { id: string; book: string; chapter: number | "books" }[] = [];
  const chapters: Record<string, number> = {
    MAT: 28, MRK: 16, LUK: 24, JHN: 21, ACT: 28, ROM: 16, "1CO": 16, "2CO": 13, GAL: 6, EPH: 6, PHP: 4, COL: 4,
    "1TH": 5, "2TH": 3, "1TI": 6, "2TI": 4, TIT: 3, PHM: 1, HEB: 13, JAS: 5, "1PE": 5, "2PE": 3, "1JN": 5, "2JN": 1, "3JN": 1, JUD: 1, REV: 22,
  };
  for (const id of COMMENTARIES) {
    jobs.push({ id, book: "_", chapter: "books" });
    for (const b of NT_BOOKS) for (let c = 1; c <= chapters[b.usfm]; c++) jobs.push({ id, book: b.usfm, chapter: c });
  }

  let done = 0, fetched = 0, missing = 0;
  const worker = async () => {
    for (let job = jobs.shift(); job; job = jobs.shift()) {
      const dir = join(OUT, job.id, job.book);
      const file = join(dir, `${job.chapter}.json`);
      if (!existsSync(file)) {
        const url = job.chapter === "books" ? `${API}/${job.id}/books.json` : `${API}/${job.id}/${job.book}/${job.chapter}.json`;
        const data = await get(url);
        mkdirSync(dir, { recursive: true });
        writeFileSync(file, JSON.stringify(data ?? { missing: true }));
        fetched++;
        if (!data) missing++;
      }
      if (++done % 200 === 0) console.log(`${done} files (${fetched} downloaded, ${missing} not available)`);
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  console.log(`done: ${done} files, ${fetched} downloaded now, ${missing} chapters without notes`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
