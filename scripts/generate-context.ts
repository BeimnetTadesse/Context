// Prepare the Context step for Old Testament chapters (their full studies aren't prepared yet).
//   npm run study:context -- "Genesis 1" "Gen 2"   specific chapters
//   npm run study:context -- --book Genesis        every chapter of a book without a Context draft
//   npm run study:context -- --all                 every OT chapter without a Context draft (resumable)
// Like study:generate: retries the same chapter on rate limits, stops cleanly when the daily quota runs out.
import { config } from "dotenv";
config({ path: ".env.local" });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const { BOOKS } = await import("../lib/bible/books");
  const { parseRef } = await import("../lib/bible/refs");
  const { generateChapterContext } = await import("../lib/study/context");
  const { AiRateLimitError, AiBusyError } = await import("../lib/ai/client");
  const { sql } = await import("../lib/db");

  const done = new Set((await sql<{ k: string }[]>`
    select distinct book_id || '.' || chapter as k from claims where step = 'context' and chapter is not null`).map((r) => r.k));
  const args = process.argv.slice(2);
  const bookArg = args.includes("--book") ? args[args.indexOf("--book") + 1]?.toLowerCase() : null;
  const ot = BOOKS.filter((b) => b.testament === "OT");
  let targets: { book: (typeof BOOKS)[number]; chapter: number }[];
  if (args.includes("--all") || bookArg) {
    targets = ot.filter((b) => !bookArg || b.name.toLowerCase() === bookArg || b.slug === bookArg)
      .flatMap((book) => Array.from({ length: book.chapters }, (_, i) => ({ book, chapter: i + 1 })))
      .filter((t) => !done.has(`${t.book.id}.${t.chapter}`));
  } else {
    targets = args.flatMap((a) => {
      const r = parseRef(a);
      const book = r && ot.find((b) => b.slug === r.book.slug);
      if (!r || !book) { console.log(`skipped "${a}": not an Old Testament chapter`); return []; }
      return [{ book, chapter: r.chapter }];
    });
  }
  console.log(`${targets.length} chapters to prepare`);

  let n = 0;
  for (const { book, chapter } of targets) {
    for (let attempt = 1; ; attempt++) {
      const started = Date.now();
      try {
        const r = await generateChapterContext(book, chapter);
        n++;
        console.log(`✓ ${book.name} ${chapter}  (${Math.round((Date.now() - started) / 1000)}s, ${r.saved}/${r.drafted} claims kept, ${r.issues} validator issues; review ${r.review.supported}/${r.review.partial}/${r.review.unsupported})  [${n}/${targets.length}]`);
        break;
      } catch (e) {
        const transient = e instanceof AiRateLimitError || e instanceof AiBusyError;
        if (!transient || attempt >= 5) {
          console.log(`✗ ${book.name} ${chapter}: ${(e as Error).message}`);
          if (transient) { await sql.end(); return; }
          break;
        }
        const wait = 70_000 * attempt;
        console.log(`… ${e instanceof AiRateLimitError ? "rate limited" : "busy"} on ${book.name} ${chapter}, retrying in ${wait / 1000}s`);
        await sleep(wait);
      }
    }
  }
  console.log(`done this run: ${n}`);
  await sql.end();
}
main();
