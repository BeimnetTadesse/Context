// Pre-generate chapter studies from the command line: npm run study:generate -- "Eph 3" "John 1"
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { parseRef } = await import("../lib/bible/refs");
  const { generateChapterStudy, beginGeneration, failGeneration } = await import("../lib/study/generate");
  const { sql } = await import("../lib/db");
  for (const arg of process.argv.slice(2)) {
    const ref = parseRef(arg);
    if (!ref || ref.book.testament !== "NT") { console.log(`skip ${arg}`); continue; }
    if ((await beginGeneration(ref.book.id, ref.chapter)) === "ready" && !process.env.FORCE) { console.log(`${arg}: already ready`); continue; }
    console.time(arg);
    try {
      const r = await generateChapterStudy(ref.book, ref.chapter);
      console.log(`${arg}: ready (${r.issues} validator issues, ai_run ${r.runId})`);
    } catch (e) {
      await failGeneration(ref.book.id, ref.chapter, String(e));
      console.error(`${arg}: failed`, e);
    }
    console.timeEnd(arg);
  }
  await sql.end();
}
main();
