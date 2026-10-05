import { z } from "zod";

const PolicySchema = z.object({
  spendCapMon: z.number().positive(),
  validForHours: z.number().positive(),
});

export type PolicyIntent = z.infer<typeof PolicySchema>;

const SYSTEM_PROMPT =
  "You translate a plain-English description of a spending policy into exact " +
  "numeric parameters for an on-chain session key grant. Extract a spend cap in " +
  "MON (native token) and a validity window in hours. If the user doesn't specify " +
  "a duration, default to 24 hours. If they don't specify an amount, default to " +
  "0.05 MON. " +
  'Respond with strict JSON only: {"spendCapMon": number, "validForHours": number}.';

/**
 * Runs entirely against the locally-running Ollama instance (no API key, no
 * cost, no backend needed — the browser calls localhost:11434 directly,
 * which is why Ollama must be started with OLLAMA_ORIGINS including this
 * dev server's origin). This is a convenience autofill only: the resulting
 * values populate the existing form fields for the owner to review, not a
 * bypass of the owner-passkey authorization that actually grants the key.
 */
export async function translatePolicyIntent(description: string): Promise<PolicyIntent> {
  const baseUrl = import.meta.env.VITE_OLLAMA_BASE_URL ?? "http://localhost:11434";
  const model = import.meta.env.VITE_OLLAMA_MODEL ?? "qwen2.5:3b";

  const res = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      format: "json",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: description },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`Ollama request failed: ${res.status} ${await res.text()}`);
  }

  const body = (await res.json()) as { message?: { content?: string } };
  const raw = body.message?.content;
  if (!raw) throw new Error("Ollama did not return a message");

  return PolicySchema.parse(JSON.parse(raw));
}
