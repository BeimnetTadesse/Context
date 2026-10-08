// Prepare book overviews (what a whole book is about) from the command line.
//   npm run study:books -- --all          every NT book without a current overview (resumable)
//   npm run study:books -- Ephesians      specific books (by name)
// Like study:generate: retries the same book on rate limits, stops cleanly when the daily quota runs out.
import { config } from "dotenv";
config({ path: ".env.local" });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const { NT_BOOKS } = await import("../lib/bible/books");
  const { generateBookOverview, BOOK_PROMPT_VERSION } = await import("../lib/study/book");
  const { AiRateLimitError, AiBusyError } = await import("../lib/ai/client");
  const { sql } = await import("../lib/db");

  const current = new Set((await sql<{ book_id: number }[]>`select book_id from book_overviews where prompt_version = ${BOOK_PROMPT_VERSION}`).map((r) => r.book_id));
  const named = process.argv.slice(2).filter((a) => !a.startsWith("--")).map((a) => a.toLowerCase());
  const targets = process.argv.includes("--all")
    ? NT_BOOKS.filter((b) => !current.has(b.id))
    : NT_BOOKS.filter((b) => named.includes(b.name.toLowerCase()) || named.includes(b.slug));
  console.log(`${targets.length} books to prepare`);

  let done = 0;
  for (const book of targets) {
    for (let attempt = 1; ; attempt++) {
      const started = Date.now();
      try {
        const r = await generateBookOverview(book);
        done++;
        console.log(`✓ ${book.name}  (${Math.round((Date.now() - started) / 1000)}s, ${r.issues} validator issues; review ${r.review.supported}/${r.review.partial}/${r.review.unsupported})  [${done}/${targets.length}]`);
        break;
      } catch (e) {
        const transient = e instanceof AiRateLimitError || e instanceof AiBusyError;
        if (!transient || attempt >= 5) {
          console.log(`✗ ${book.name}: ${(e as Error).message}`);
          if (transient) { await sql.end(); return; }
          break;
        }
        const wait = 70_000 * attempt;
        console.log(`… ${e instanceof AiRateLimitError ? "rate limited" : "Gemini busy"} on ${book.name}, retrying in ${wait / 1000}s`);
        await sleep(wait);
      }
    }
    await sleep(20_000); // stay under the per-minute token limit
  }
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from book_overviews where prompt_version = ${BOOK_PROMPT_VERSION}`;
  console.log(`done this run: ${done}. books with a current overview: ${n}/27`);
  await sql.end();
}
main();
