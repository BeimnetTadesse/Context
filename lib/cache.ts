import "server-only";
import { revalidateTag, unstable_cache } from "next/cache";

// Content (texts, studies, commentaries, lexicon) changes only when new content is synced and deployed,
// so it is served from Next's data cache instead of the database — pages stay fast even while the
// free Neon database is asleep. The key includes the deployed commit, so each deploy starts fresh.
const VERSION = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.VERCEL_DEPLOYMENT_ID ?? "local";
const ENABLED = process.env.NODE_ENV === "production";

export const chapterTag = (slug: string, chapter: number) => `chapter:${slug}:${chapter}`;

export function cachedContent<T>(key: (string | number)[], tags: string[], load: () => Promise<T>): Promise<T> {
  if (!ENABLED) return load(); // local development: always fresh
  return unstable_cache(load, ["content", VERSION, ...key.map(String)], {
    tags: ["content", ...tags],
    revalidate: 7 * 24 * 3600,
  })();
}

/** After generating or verifying a chapter's study on the live site. */
export function refreshChapter(slug: string, chapter: number) {
  revalidateTag(chapterTag(slug, chapter), { expire: 0 });
}
