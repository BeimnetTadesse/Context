import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type * as z from "zod/v4";
import { sql } from "@/lib/db";

export const MODEL = "claude-opus-5";
export const PROMPT_VERSION = "2026-09-27.1";

export const aiConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

export class AiUnavailableError extends Error {
  constructor() {
    super("The AI research assistant isn't configured yet (no ANTHROPIC_API_KEY).");
  }
}
export class AiRefusedError extends Error {}

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic());

/**
 * One structured call: the model must answer in the Zod schema's shape.
 * - Structured outputs (output_config.format) guarantee valid JSON of that shape.
 * - fallbacks: "default" lets the API re-run a policy-declined request on a fallback model.
 * - Every call is written to ai_runs so any answer can be audited later.
 */
export async function generateStructured<S extends z.ZodType>(opts: {
  kind: string;
  schema: S;
  system: string;
  input: string;
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
  audit?: { userId?: number | null; bookId?: number; chapter?: number; retrieved?: unknown };
}): Promise<{ output: z.infer<S>; runId: number }> {
  if (!aiConfigured()) throw new AiUnavailableError();

  const response = await getClient().beta.messages.parse({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    thinking: { type: "adaptive" },
    output_config: { effort: opts.effort ?? "high", format: betaZodOutputFormat(opts.schema) },
    system: [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: opts.input }],
  });

  if (response.stop_reason === "refusal") throw new AiRefusedError("The model declined this request.");
  if (response.stop_reason === "max_tokens") throw new Error("The model ran out of room before finishing.");
  const output = response.parsed_output as z.infer<S> | null;
  if (!output) throw new Error("The model's answer did not match the expected structure.");

  const [run] = await sql<{ id: number }[]>`
    insert into ai_runs (user_id, kind, book_id, chapter, input, retrieved, output, model, prompt_version)
    values (${opts.audit?.userId ?? null}, ${opts.kind}, ${opts.audit?.bookId ?? null}, ${opts.audit?.chapter ?? null},
            ${opts.input.slice(0, 20000)}, ${sql.json((opts.audit?.retrieved ?? null) as never)},
            ${sql.json(output as never)}, ${response.model}, ${PROMPT_VERSION})
    returning id`;
  return { output, runId: run.id };
}

export async function recordValidation(runId: number, validation: unknown) {
  await sql`update ai_runs set validation = ${sql.json(validation as never)} where id = ${runId}`;
}
