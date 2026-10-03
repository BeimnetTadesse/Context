// Pre-load every NT chapter into the live site's data cache after a deploy, so no reader waits for the
// (possibly sleeping) database. Four requests at a time; each gets up to 90 seconds.
// Run: npm run cache:warm            (or: npm run cache:warm -- https://preview-url.vercel.app)
import { NT_BOOKS } from "../lib/bible/books";

const SITE = (process.argv[2] ?? "https://context-black.vercel.app").replace(/\/$/, "");
const PARALLEL = 4;

async function hit(path: string) {
  try {
    const r = await fetch(`${SITE}${path}`, { signal: AbortSignal.timeout(90_000) });
    await r.arrayBuffer();
    return r.ok;
  } catch {
    return false;
  }
}

async function main() {
  const paths = NT_BOOKS.flatMap((b) => Array.from({ length: b.chapters }, (_, i) => `/study/${b.slug}/${i + 1}`));
  const failed: string[] = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: PARALLEL }, async () => {
      while (next < paths.length) {
        const path = paths[next++];
        if (!(await hit(path))) failed.push(path);
      }
    }),
  );
  await Promise.all(["/study", "/sources", "/audit"].map(hit));
  for (const f of failed) console.log(`failed: ${f}`);
  console.log(`warmed ${paths.length - failed.length} of ${paths.length} chapters`);
  if (failed.length) process.exitCode = 1;
}

main();
