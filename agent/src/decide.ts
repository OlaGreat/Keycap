import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

const DecisionSchema = z.object({
  approve: z.boolean(),
  reasoning: z.string(),
});

export type Decision = z.infer<typeof DecisionSchema>;

export interface DecisionContext {
  pricePerCallWei: bigint;
  spentWei: bigint;
  spendingLimitWei: bigint;
  validUntil: bigint;
}

const SYSTEM_PROMPT =
  "You are an autonomous agent deciding whether to spend from a strictly capped, " +
  "on-chain enforced budget to call a metered API. The cap is enforced by the " +
  "smart contract regardless of your decision — you cannot exceed it even if you " +
  "wanted to. Whether the call is affordable has already been computed for you — " +
  "trust that figure rather than re-deriving it yourself, since these numbers are " +
  "wei-scale integers a small model easily miscalculates. Your only job is judging " +
  "whether spending now is a reasonable use of the remaining budget and time. " +
  "Be decisive. " +
  'Respond with strict JSON only: {"approve": boolean, "reasoning": string}.';

// Wei-scale bigints are unreliable for a small model to do arithmetic on
// correctly (observed: a 3B local model miscalculated remaining-budget math
// and declined an affordable call). All arithmetic that matters for the
// decision is done here in code — the model is only ever asked to reason
// from already-computed, human-readable facts, never to derive them itself.
// The spend cap itself is enforced on-chain regardless of any of this.
function weiToMon(wei: bigint): string {
  return (Number(wei) / 1e18).toFixed(6);
}

function buildUserPrompt(ctx: DecisionContext): string {
  const remainingWei = ctx.spendingLimitWei - ctx.spentWei;
  const remainingAfterCallWei = remainingWei - ctx.pricePerCallWei;
  const affordable = remainingAfterCallWei >= 0n;
  const secondsUntilExpiry = ctx.validUntil - BigInt(Math.floor(Date.now() / 1000));
  const minutesUntilExpiry = Number(secondsUntilExpiry) / 60;

  return (
    `Spending cap: ${weiToMon(ctx.spendingLimitWei)} MON total, ${weiToMon(ctx.spentWei)} MON spent so far, ` +
    `${weiToMon(remainingWei)} MON remaining.\n` +
    `Price per call: ${weiToMon(ctx.pricePerCallWei)} MON.\n` +
    `Affordable right now: ${affordable ? "YES" : "NO"} ` +
    `(would leave ${weiToMon(affordable ? remainingAfterCallWei : 0n)} MON after this call).\n` +
    `Session key expires in: ${minutesUntilExpiry.toFixed(1)} minutes.\n\n` +
    "Should the agent make one call to the paid API right now? " +
    "Decline if it is not affordable, or if the session is about to expire with " +
    "too little time to make use of a successful call."
  );
}

/**
 * Asks Claude whether the agent should make the paid call right now. Requires
 * Anthropic API credit — see decideWithOllama for a free local alternative.
 */
async function decideWithAnthropic(ctx: DecisionContext): Promise<Decision> {
  const client = new Anthropic();
  const response = await client.messages.parse({
    model: "claude-opus-5",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserPrompt(ctx) }],
    output_config: { format: zodOutputFormat(DecisionSchema) },
  });

  if (!response.parsed_output) {
    throw new Error("Claude did not return a parseable decision");
  }
  return response.parsed_output;
}

/**
 * Same decision, via a locally-run model through Ollama (http://localhost:11434)
 * — no API key, no cost. Used as the default provider since real API credit
 * isn't available yet; swap OLLAMA_MODEL or LLM_PROVIDER=anthropic once it is.
 */
async function decideWithOllama(ctx: DecisionContext): Promise<Decision> {
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

  return DecisionSchema.parse(JSON.parse(raw));
}

/**
 * This is a deliberately thin decision loop — the point is a real model in
 * the loop above a cryptographically enforced ceiling, not an agent
 * framework. The cap itself is enforced on-chain by SessionKeyManager
 * regardless of what the model says; this call only decides whether it's
 * *worth* spending right now. Provider is swappable (LLM_PROVIDER=ollama|anthropic,
 * defaults to ollama) so this can move to Claude with no code change once API
 * credit is available.
 */
export async function decideWhetherToCall(ctx: DecisionContext): Promise<Decision> {
  const provider = process.env.LLM_PROVIDER ?? "ollama";
  if (provider === "anthropic") return decideWithAnthropic(ctx);
  if (provider === "ollama") return decideWithOllama(ctx);
  throw new Error(`Unknown LLM_PROVIDER: ${provider}`);
}
