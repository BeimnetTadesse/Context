// Regenerate the study notes (the underlined phrases in Read) without touching the rest of each chapter's study.
//   npm run study:notes -- "John 3" "Eph 3"     specific chapters
//   npm run study:notes -- --all                every NT chapter not yet on the current NOTES_VERSION (resumable)
// Stops cleanly when the free quota runs out; run it again later and it continues where it left off.
import { config } from "dotenv";
config({ path: ".env.local" });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const { parseRef } = await import("../lib/bible/refs");
  const { NT_BOOKS } = await import("../lib/bible/books");
  const { generateStudyNotes, NOTES_VERSION } = await import("../lib/study/notes");
  const { AiRateLimitError, AiBusyError } = await import("../lib/ai/client");
  const { sql } = await import("../lib/db");

  // "Done" = a study_notes run on this version that saved its notes.
  const done = new Set((await sql<{ k: string }[]>`
    select distinct book_id || '.' || chapter as k from ai_runs
    where kind = 'study_notes' and prompt_version = ${NOTES_VERSION} and validation ? 'saved'`).map((r) => r.k));

  const targets: { book: (typeof NT_BOOKS)[number]; chapter: number }[] = [];
  if (process.argv.includes("--all")) {
    const counts = await sql<{ id: number; chapter_count: number }[]>`select id, chapter_count from books where testament = 'NT'`;
    for (const b of NT_BOOKS) {
      const n = counts.find((c) => c.id === b.id)?.chapter_count ?? 0;
      for (let c = 1; c <= n; c++) if (!done.has(`${b.id}.${c}`)) targets.push({ book: b, chapter: c });
    }
  } else {
    for (const arg of process.argv.slice(2)) {
      const ref = parseRef(arg);
      if (ref && ref.book.testament === "NT") targets.push({ book: ref.book, chapter: ref.chapter });
      else console.log(`skip ${arg}`);
    }
  }
  console.log(`${targets.length} chapters to write notes for (version ${NOTES_VERSION})`);

  let ok = 0;
  outer: for (const { book, chapter } of targets) {
    const label = `${book.name} ${chapter}`;
    for (let attempt = 1; ; attempt++) {
      const started = Date.now();
      try {
        const r = await generateStudyNotes(book, chapter);
        ok++;
        console.log(`✓ ${label}: ${r.saved} notes kept of ${r.drafted} drafted ${JSON.stringify(r.labels)} (${Math.round((Date.now() - started) / 1000)}s) [${ok}/${targets.length}]`);
        break;
      } catch (e) {
        const transient = e instanceof AiRateLimitError || e instanceof AiBusyError;
        if (!transient) { console.log(`✗ ${label}: ${(e as Error).message}`); break; }
        if (attempt >= 5) { console.log(`■ still limited after 5 tries on ${label}: likely the daily quota. Run again later to continue.`); break outer; }
        const wait = 70_000 * attempt;
        console.log(`… ${e instanceof AiRateLimitError ? "rate limited" : "busy"} on ${label}, retrying in ${wait / 1000}s`);
        await sleep(wait);
      }
    }
    await sleep(15_000); // stay under the per-minute limit
  }
  console.log(`done this run: ${ok}`);
  await sql.end();
}
main();
