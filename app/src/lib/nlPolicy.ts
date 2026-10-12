import { z } from "zod";
import { parsePolicy, toHours, type ParsedPolicy } from "./policyParse";

// The model reports the duration as written (number + unit) and the code does
// the unit conversion: a 3B local model was observed reading "30 min" as 30
// hours when asked for hours directly.
const ModelReadingSchema = z.object({
  spendCapMon: z.number().positive(),
  duration: z.number().positive(),
  durationUnit: z.enum(["seconds", "minutes", "hours", "days", "weeks"]),
});

export type PolicyIntent = ParsedPolicy;

const SYSTEM_PROMPT =
  "You extract a spending policy from a plain-English description. The spend cap is the amount " +
  "of money: any number in the text that is NOT attached to a time unit is the spend cap, in MON, even if " +
  "the word MON is missing. Report the duration EXACTLY as the user wrote it: the number, and its unit as " +
  "one of seconds, minutes, hours, days, weeks. Do NOT convert between units. Only if the text contains no amount " +
  "at all use 0.05; only if it contains no duration at all use 24 hours.\n" +
  "Examples:\n" +
  '"spend at most 0.004 for 20 minutes" -> {"spendCapMon": 0.004, "duration": 20, "durationUnit": "minutes"}\n' +
  '"0.01 for 90 sec" -> {"spendCapMon": 0.01, "duration": 90, "durationUnit": "seconds"}\n' +
  '"0.3 mon, 2 hrs" -> {"spendCapMon": 0.3, "duration": 2, "durationUnit": "hours"}\n' +
  '"half an hour, up to 0.02" -> {"spendCapMon": 0.02, "duration": 30, "durationUnit": "minutes"}\n' +
  '"0.1 for a week" -> {"spendCapMon": 0.1, "duration": 1, "durationUnit": "weeks"}\n' +
  '"let it spend 0.08" -> {"spendCapMon": 0.08, "duration": 24, "durationUnit": "hours"}\n' +
  'Respond with strict JSON only: {"spendCapMon": number, "duration": number, "durationUnit": "seconds"|"minutes"|"hours"|"days"|"weeks"}.';

const NOT_CONFIDENT =
  "Couldn't translate that confidently. Rephrase it (for example \"0.05 MON for 2 hours\") or fill in the fields directly.";

function nearlyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
}

async function readWithModel(description: string): Promise<ParsedPolicy> {
  const baseUrl = import.meta.env?.VITE_OLLAMA_BASE_URL ?? "http://localhost:11434";
  const model = import.meta.env?.VITE_OLLAMA_MODEL ?? "qwen2.5:3b";

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
  const reading = ModelReadingSchema.parse(JSON.parse(body.message?.content ?? ""));
  return { spendCapMon: reading.spendCapMon, validForHours: toHours(reading.duration, reading.durationUnit)! };
}

/**
 * Translates a plain-English policy into spend cap and validity fields, via
 * the locally-running Ollama instance (the browser calls localhost:11434
 * directly, so Ollama must allow this origin via OLLAMA_ORIGINS).
 *
 * The model's reading is never trusted alone: an independent deterministic
 * parse must agree on both the cap and the duration, or nothing is filled in.
 * This is still only an autofill — the owner reviews the fields and the grant
 * itself is authorized with their passkey.
 */
export async function translatePolicyIntent(description: string): Promise<PolicyIntent> {
  const parsed = parsePolicy(description);
  if (!parsed) throw new Error(NOT_CONFIDENT);

  let modelReading: ParsedPolicy;
  try {
    modelReading = await readWithModel(description);
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("Ollama request failed")) throw e;
    throw new Error(NOT_CONFIDENT);
  }

  const agree =
    nearlyEqual(modelReading.spendCapMon, parsed.spendCapMon) &&
    nearlyEqual(modelReading.validForHours, parsed.validForHours);
  if (!agree) throw new Error(NOT_CONFIDENT);

  return parsed;
}
