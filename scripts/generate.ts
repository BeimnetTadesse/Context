// Prepare chapter studies from the command line.
//   npm run study:generate -- "Eph 3" "John 1"     specific chapters
//   npm run study:generate -- --all                every NT chapter not yet ready (resumable)
//   FORCE=1 npm run study:generate -- "Eph 3"      regenerate even if ready
// Stops cleanly when the free quota is exhausted; run it again later and it continues where it left off.
import { config } from "dotenv";
config({ path: ".env.local" });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const { parseRef } = await import("../lib/bible/refs");
  const { NT_BOOKS } = await import("../lib/bible/books");
  const { generateChapterStudy, beginGeneration, failGeneration } = await import("../lib/study/generate");
  const { AiRateLimitError, AiBusyError } = await import("../lib/ai/client");
  const { sql } = await import("../lib/db");

  let targets: { book: (typeof NT_BOOKS)[number]; chapter: number }[] = [];
  if (process.argv.includes("--all")) {
    const counts = await sql<{ id: number; chapter_count: number }[]>`select id, chapter_count from books where testament = 'NT' order by id`;
    const ready = new Set((await sql<{ k: string }[]>`select book_id || '.' || chapter as k from chapter_studies where status = 'ready'`).map((r) => r.k));
    for (const b of NT_BOOKS) {
      const n = counts.find((c) => c.id === b.id)?.chapter_count ?? 0;
      for (let c = 1; c <= n; c++) if (!ready.has(`${b.id}.${c}`)) targets.push({ book: b, chapter: c });
    }
  } else {
    for (const arg of process.argv.slice(2)) {
      const ref = parseRef(arg);
      if (ref && ref.book.testament === "NT") targets.push({ book: ref.book, chapter: ref.chapter });
      else console.log(`skip ${arg}`);
    }
  }
  if (process.env.FORCE !== "1") {
    const ready = new Set((await sql<{ k: string }[]>`select book_id || '.' || chapter as k from chapter_studies where status = 'ready'`).map((r) => r.k));
    targets = targets.filter((t) => !ready.has(`${t.book.id}.${t.chapter}`));
  }
  console.log(`${targets.length} chapters to prepare`);

  let done = 0;
  let rateLimitsInARow = 0;
  for (const { book, chapter } of targets) {
    const label = `${book.name} ${chapter}`;
    await beginGeneration(book.id, chapter);
    const started = Date.now();
    try {
      const r = await generateChapterStudy(book, chapter);
      done++;
      rateLimitsInARow = 0;
      console.log(`✓ ${label}  (${Math.round((Date.now() - started) / 1000)}s, ${r.issues} validator issues)  [${done}/${targets.length}]`);
    } catch (e) {
      await failGeneration(book.id, chapter, String(e));
      if (e instanceof AiRateLimitError) {
        rateLimitsInARow++;
        if (rateLimitsInARow >= 3) {
          console.log(`■ quota exhausted after ${done} chapters — run again later to continue`);
          break;
        }
        console.log(`… rate limited on ${label}, waiting 70s`);
        await sleep(70_000);
        continue;
      }
      if (e instanceof AiBusyError) {
        console.log(`… Gemini busy on ${label}, waiting 60s`);
        await sleep(60_000);
        continue;
      }
      console.log(`✗ ${label}: ${(e as Error).message}`);
    }
    await sleep(4_000); // stay well under per-minute limits
  }
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from chapter_studies where status = 'ready'`;
  console.log(`done this run: ${done}. chapters ready overall: ${n}/260`);
  await sql.end();
}
main();
