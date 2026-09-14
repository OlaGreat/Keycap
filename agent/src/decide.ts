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

const client = new Anthropic();

/**
 * Asks Claude whether the agent should make the paid call right now, given
 * its remaining on-chain budget and time window. This is a deliberately thin
 * decision loop — the point is a real model in the loop above a
 * cryptographically enforced ceiling, not an agent framework. The cap itself
 * is enforced on-chain by SessionKeyManager regardless of what Claude says;
 * this call only decides whether it's *worth* spending right now.
 */
export async function decideWhetherToCall(ctx: DecisionContext): Promise<Decision> {
  const remaining = ctx.spendingLimitWei - ctx.spentWei;
  const secondsUntilExpiry = ctx.validUntil - BigInt(Math.floor(Date.now() / 1000));

  const response = await client.messages.parse({
    model: "claude-opus-5",
    max_tokens: 1024,
    system:
      "You are an autonomous agent deciding whether to spend from a strictly capped, " +
      "on-chain enforced budget to call a metered API. The cap is enforced by the " +
      "smart contract regardless of your decision — you cannot exceed it even if you " +
      "wanted to. Your job is only to judge whether spending now is a reasonable use " +
      "of the remaining budget, not to second-guess the cap itself. Be decisive.",
    messages: [
      {
        role: "user",
        content:
          `Remaining budget: ${remaining} wei of ${ctx.spendingLimitWei} wei total.\n` +
          `Price per call: ${ctx.pricePerCallWei} wei.\n` +
          `Session key expires in: ${secondsUntilExpiry} seconds.\n\n` +
          "Should the agent make one call to the paid API right now? " +
          "Decline if the call would exceed the remaining budget, or if the session " +
          "is about to expire with too little time to make use of a successful call.",
      },
    ],
    output_config: {
      format: zodOutputFormat(DecisionSchema),
    },
  });

  if (!response.parsed_output) {
    throw new Error("Claude did not return a parseable decision");
  }
  return response.parsed_output;
}
