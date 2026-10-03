import "server-only";
import { sql } from "@/lib/db";
import { AiBusyError, AiRateLimitError, AiRefusedError, AiUnavailableError } from "@/lib/ai/client";

export const json = (data: unknown, status = 200) => Response.json(data, { status });

export { ntChapter } from "@/lib/bible/books";

/** Turn AI failures into honest, user-facing messages. The Ai*Error messages are written by us, for readers. */
export function aiError(e: unknown) {
  if (e instanceof AiUnavailableError) return json({ error: "ai_unavailable", message: e.message }, 503);
  if (e instanceof AiRateLimitError) return json({ error: "rate_limited", message: e.message }, 429);
  if (e instanceof AiBusyError) return json({ error: "busy", message: e.message }, 503);
  if (e instanceof AiRefusedError) return json({ error: "refused", message: e.message }, 422);
  // Anything else is unexpected: the details go to the server log, never to the reader
  // (they can include database or provider internals).
  console.error(e);
  return json({ error: "failed", message: "Something went wrong. Please try again." }, 500);
}

/**
 * Protect the (free) AI quota once the site is public:
 * at most PER_USER calls per visitor and SITE calls in total, per rolling 24 hours.
 */
const PER_USER = Number(process.env.AI_DAILY_LIMIT_PER_USER ?? 40);
const SITE = Number(process.env.AI_DAILY_LIMIT_SITE ?? 300);

export async function aiBudgetExceeded(userId: number) {
  const [r] = await sql<{ mine: number; all: number }[]>`
    select count(*) filter (where user_id = ${userId})::int as mine, count(*)::int as all
    from ai_runs where created_at > now() - interval '24 hours'`;
  if (r.mine >= PER_USER) return json({ error: "limit", message: `You've reached today's limit of ${PER_USER} questions. It resets within 24 hours.` }, 429);
  if (r.all >= SITE) return json({ error: "limit", message: "Context has reached today's limit for the research assistant. Please try again tomorrow." }, 429);
  return null;
}

export const clean = (s: unknown, max: number) => (typeof s === "string" ? s.trim().slice(0, max) : "");
