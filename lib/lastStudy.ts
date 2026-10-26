import { bookBySlug, chapterLabel } from "@/lib/bible/books";
import { isStepKey, type StepKey } from "@/lib/steps";

// Where the reader last was in the workspace, so the notebook and profile can link straight back.
// Kept in a cookie (not localStorage) so those server-rendered pages can show the link on first paint.
export const LAST_STUDY_COOKIE = "lastStudy";

/** "luke/2/context" → where to go back to, or null if the cookie is missing or not a real NT chapter. */
export function parseLastStudy(value: string | undefined): { href: string; label: string } | null {
  const m = value?.match(/^([a-z0-9-]+)\/(\d{1,3})\/([a-z]+)$/);
  if (!m) return null;
  const book = bookBySlug(m[1]);
  const chapter = Number(m[2]);
  if (!book || chapter < 1 || chapter > book.chapters) return null;
  const step: StepKey = isStepKey(m[3]) ? m[3] : "read";
  return { href: `/study/${book.slug}/${chapter}${step === "read" ? "" : `?step=${step}`}`, label: chapterLabel(book.name, chapter) };
}

export const lastStudyValue = (slug: string, chapter: number, step: StepKey) => `${slug}/${chapter}/${step}`;
