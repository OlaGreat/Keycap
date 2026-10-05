import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

export interface Candidate {
  id: string;
  description: string;
  priceWei: bigint;
}

export interface PrioritizationContext {
  candidates: Candidate[];
  spentWei: bigint;
  spendingLimitWei: bigint;
  validUntil: bigint;
}

const RankedChoiceSchema = z.object({
  id: z.string(),
  reasoning: z.string(),
});
const PrioritizationSchema = z.object({
  ranking: z.array(RankedChoiceSchema),
});
export type Prioritization = z.infer<typeof PrioritizationSchema>;

const SYSTEM_PROMPT =
  "You are an autonomous agent deciding which of several paid API calls are worth " +
  "making right now, from a strictly capped, on-chain enforced budget. The cap is " +
  "enforced by the smart contract regardless of your decision — if you rank " +
  "something you can't actually afford, the call simply fails on-chain and is " +
  "skipped; you cannot overspend even if you tried. You do not need to verify that " +
  "the combined cost of your ranking fits the remaining budget — that arithmetic is " +
  "handled separately and is not your job. Your only job is judging genuine value: " +
  "which calls are actually worth making, and in what priority order. Omit any " +
  "candidate that isn't worth calling at all — an empty ranking is a valid answer. " +
  'Respond with strict JSON only: {"ranking": [{"id": string, "reasoning": string}, ...]}, ' +
  "most important first.";

// Wei-scale bigints are unreliable for a small model to do arithmetic on
// correctly (observed: a 3B local model miscalculated remaining-budget math
// in an earlier single-candidate version of this prompt). All arithmetic
// that matters is done here in code — the model is only ever asked to reason
// from already-computed, human-readable facts, never to derive them itself.
function weiToMon(wei: bigint): string {
  return (Number(wei) / 1e18).toFixed(6);
}

function buildUserPrompt(ctx: PrioritizationContext): string {
  const remainingWei = ctx.spendingLimitWei - ctx.spentWei;
  const secondsUntilExpiry = ctx.validUntil - BigInt(Math.floor(Date.now() / 1000));
  const minutesUntilExpiry = Number(secondsUntilExpiry) / 60;

  const candidateLines = ctx.candidates
    .map((c) => `- id="${c.id}": ${c.description} — costs ${weiToMon(c.priceWei)} MON per call`)
    .join("\n");

  return (
    `Remaining budget: ${weiToMon(remainingWei)} MON of ${weiToMon(ctx.spendingLimitWei)} MON total.\n` +
    `Session key expires in: ${minutesUntilExpiry.toFixed(1)} minutes.\n\n` +
    `Candidate calls available right now:\n${candidateLines}\n\n` +
    "Rank the candidates that are genuinely worth calling right now, most valuable " +
    "first. Consider both the per-call cost and what each call is actually useful " +
    "for — cheap isn't automatically worth it, and expensive isn't automatically " +
    "skippable."
  );
}

/** Requires Anthropic API credit — see prioritizeWithOllama for a free local alternative. */
async function prioritizeWithAnthropic(ctx: PrioritizationContext): Promise<Prioritization> {
  const client = new Anthropic();
  const response = await client.messages.parse({
    model: "claude-opus-5",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserPrompt(ctx) }],
    output_config: { format: zodOutputFormat(PrioritizationSchema) },
  });

  if (!response.parsed_output) {
    throw new Error("Claude did not return a parseable ranking");
  }
  return response.parsed_output;
}

/** Same decision, via a locally-run model through Ollama — no API key, no cost. */
async function prioritizeWithOllama(ctx: PrioritizationContext): Promise<Prioritization> {
  const baseUrl = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
  const model = process.env.OLLAMA_MODEL ?? "qwen2.5:3b";

  const res = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      format: "json",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(ctx) },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`Ollama request failed: ${res.status} ${await res.text()}`);
  }

  const body = (await res.json()) as { message?: { content?: string } };
  const raw = body.message?.content;
  if (!raw) throw new Error("Ollama did not return a message");

  return PrioritizationSchema.parse(JSON.parse(raw));
}

/**
 * Asks the model to rank which of several competing paid calls are worth
 * making right now, given a shared remaining budget — genuine prioritization
 * under a constraint, not a single pass/fail gate. The model only sets
 * strategy (what's worth it, in what order); code and the on-chain contract
 * enforce what's actually affordable (see index.ts's execution loop).
 * Provider is swappable (LLM_PROVIDER=ollama|anthropic, defaults to ollama).
 */
export async function prioritizeCandidates(ctx: PrioritizationContext): Promise<Prioritization> {
  const provider = process.env.LLM_PROVIDER ?? "ollama";
  if (provider === "anthropic") return prioritizeWithAnthropic(ctx);
  if (provider === "ollama") return prioritizeWithOllama(ctx);
  throw new Error(`Unknown LLM_PROVIDER: ${provider}`);
}
