import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { FinishReason, GoogleGenAI, ThinkingLevel } from "@google/genai";
import * as z from "zod/v4";
import { sql } from "@/lib/db";

// ── Provider selection ──
// AI_PROVIDER=gemini | claude. Defaults to whichever key is present (Gemini first: it has a free tier).
// Only this file knows which provider is used; the evidence pack, validator and database rules are identical.
type Provider = "gemini" | "claude";

function provider(): Provider | null {
  const wanted = process.env.AI_PROVIDER as Provider | undefined;
  const has = { gemini: !!process.env.GEMINI_API_KEY, claude: !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) };
  if (wanted && has[wanted]) return wanted;
  if (has.gemini) return "gemini";
  if (has.claude) return "claude";
  return null;
}

const MODELS: Record<Provider, string> = {
  gemini: process.env.GEMINI_MODEL || "gemini-3.8-flash",
  claude: process.env.CLAUDE_MODEL || "claude-opus-5",
};
export const currentModel = () => {
  const p = provider();
  return p ? MODELS[p] : null;
};
export const PROMPT_VERSION = "2026-09-27.2";

export const aiConfigured = () => provider() !== null;

export class AiUnavailableError extends Error {
  constructor() {
    super("The AI research assistant isn't configured yet (add GEMINI_API_KEY to .env.local).");
  }
}
export class AiRefusedError extends Error {}
export class AiRateLimitError extends Error {}
export class AiBusyError extends Error {}

type Effort = "low" | "medium" | "high";

// ── Gemini ──
let gemini: GoogleGenAI | null = null;
// If the main model is overloaded (503), fall back to these (all current Flash models).
const GEMINI_FALLBACKS = (process.env.GEMINI_FALLBACK_MODELS || "gemini-3.6-flash,gemini-3.5-flash").split(",").map((m) => m.trim()).filter(Boolean);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Gemini accepts a subset of JSON Schema: drop $schema and turn ["string","null"] into anyOf. */
function geminiSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(geminiSchema);
  if (!node || typeof node !== "object") return node;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node)) {
    if (k === "$schema") continue;
    out[k] = geminiSchema(v);
  }
  if (Array.isArray(out.type)) {
    const { type, ...rest } = out;
    return { anyOf: (type as string[]).map((t) => (t === "null" ? { type: "null" } : { ...rest, type: t })) };
  }
  return out;
}

async function callGemini(opts: { schema: z.ZodType; system: string; input: string; effort: Effort; maxTokens: number }) {
  gemini ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const level = { low: ThinkingLevel.LOW, medium: ThinkingLevel.MEDIUM, high: ThinkingLevel.HIGH }[opts.effort];
  const config = {
    systemInstruction: opts.system,
    responseMimeType: "application/json",
    responseJsonSchema: geminiSchema(z.toJSONSchema(opts.schema)),
    maxOutputTokens: opts.maxTokens,
    thinkingConfig: { thinkingLevel: level },
  };

  // Retry transient overloads with backoff, then try the fallback models.
  let response;
  let lastError: unknown;
  outer: for (const model of [MODELS.gemini, ...GEMINI_FALLBACKS]) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        response = await gemini.models.generateContent({ model, contents: opts.input, config });
        break outer;
      } catch (e) {
        lastError = e;
        const status = (e as { status?: number }).status;
        if (status === 429) {
          // Google's message names the exhausted quota (per-minute vs per-day); keep it for the logs.
          const detail = String((e as Error).message ?? "").match(/Quota exceeded for metric: [^,\n"]+|quotaId["':\s]+[\w-]+/i)?.[0];
          throw new AiRateLimitError(
            `The free Gemini quota is used up for now — try again in a minute (or tomorrow if the daily limit is reached).${detail ? ` [${detail}]` : ""}`,
          );
        }
        if (status !== 503 && status !== 500) throw e;
        await sleep(1500 * (attempt + 1));
      }
    }
  }
  if (!response) {
    console.error(lastError);
    throw new AiBusyError("Gemini is overloaded right now. Please try again in a few minutes.");
  }

  if (response.promptFeedback?.blockReason) throw new AiRefusedError(`Gemini blocked the request (${response.promptFeedback.blockReason}).`);
  const finish = response.candidates?.[0]?.finishReason;
  if (finish === FinishReason.SAFETY || finish === FinishReason.RECITATION || finish === FinishReason.PROHIBITED_CONTENT)
    throw new AiRefusedError(`Gemini stopped the answer (${finish}).`);
  if (finish === FinishReason.MAX_TOKENS) throw new Error("The model ran out of room before finishing.");

  const parsed = opts.schema.safeParse(JSON.parse(response.text ?? "null"));
  if (!parsed.success) throw new Error("The model's answer did not match the expected structure.");
  return { output: parsed.data, model: response.modelVersion ?? MODELS.gemini };
}

// ── Claude ──
let claude: Anthropic | null = null;

async function callClaude(opts: { schema: z.ZodType; system: string; input: string; effort: Effort; maxTokens: number }) {
  claude ??= new Anthropic();
  const response = await claude.beta.messages.parse({
    model: MODELS.claude,
    max_tokens: opts.maxTokens,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    thinking: { type: "adaptive" },
    output_config: { effort: opts.effort, format: betaZodOutputFormat(opts.schema) },
    system: [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: opts.input }],
  });
  if (response.stop_reason === "refusal") throw new AiRefusedError("The model declined this request.");
  if (response.stop_reason === "max_tokens") throw new Error("The model ran out of room before finishing.");
  if (!response.parsed_output) throw new Error("The model's answer did not match the expected structure.");
  return { output: response.parsed_output, model: response.model };
}

/**
 * One structured call: the model must answer in the Zod schema's shape (JSON-schema constrained output),
 * and the answer is re-validated against the same Zod schema here. Every call is logged to ai_runs.
 */
export async function generateStructured<S extends z.ZodType>(opts: {
  kind: string;
  schema: S;
  system: string;
  input: string;
  effort?: Effort;
  maxTokens?: number;
  audit?: { userId?: number | null; bookId?: number; chapter?: number; retrieved?: unknown };
}): Promise<{ output: z.infer<S>; runId: number }> {
  const p = provider();
  if (!p) throw new AiUnavailableError();
  const args = { schema: opts.schema, system: opts.system, input: opts.input, effort: opts.effort ?? "high", maxTokens: opts.maxTokens ?? 16000 };
  const { output, model } = p === "gemini" ? await callGemini(args) : await callClaude(args);

  const [run] = await sql<{ id: number }[]>`
    insert into ai_runs (user_id, kind, book_id, chapter, input, retrieved, output, model, prompt_version)
    values (${opts.audit?.userId ?? null}, ${opts.kind}, ${opts.audit?.bookId ?? null}, ${opts.audit?.chapter ?? null},
            ${opts.input.slice(0, 20000)}, ${sql.json((opts.audit?.retrieved ?? null) as never)},
            ${sql.json(output as never)}, ${model}, ${PROMPT_VERSION})
    returning id`;
  return { output: output as z.infer<S>, runId: run.id };
}

export async function recordValidation(runId: number, validation: unknown) {
  await sql`update ai_runs set validation = ${sql.json(validation as never)} where id = ${runId}`;
}
