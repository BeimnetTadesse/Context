import "server-only";
import { bookBySlug } from "@/lib/bible/books";
import { AiRefusedError, AiUnavailableError } from "@/lib/ai/client";

export const json = (data: unknown, status = 200) => Response.json(data, { status });

export function ntChapter(slug: unknown, chapter: unknown) {
  const book = typeof slug === "string" ? bookBySlug(slug) : undefined;
  const ch = Number(chapter);
  return book && book.testament === "NT" && Number.isInteger(ch) && ch >= 1 ? { book, chapter: ch } : null;
}

/** Turn AI failures into honest, user-facing messages. */
export function aiError(e: unknown) {
  if (e instanceof AiUnavailableError) return json({ error: "ai_unavailable", message: e.message }, 503);
  if (e instanceof AiRefusedError) return json({ error: "refused", message: "The assistant declined this request." }, 422);
  console.error(e);
  return json({ error: "failed", message: e instanceof Error ? e.message : "Something went wrong." }, 500);
}

export const clean = (s: unknown, max: number) => (typeof s === "string" ? s.trim().slice(0, max) : "");
