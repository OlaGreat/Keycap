export interface ParsedPolicy {
  spendCapMon: number;
  validForHours: number;
}

export const DEFAULT_CAP_MON = 0.05;
export const DEFAULT_HOURS = 24;

const UNIT_HOURS: Record<string, number> = {
  minute: 1 / 60,
  hour: 1,
  day: 24,
  week: 168,
};

/** Maps a unit as written ("mins", "hrs", "days"…) to a canonical unit, or null. */
export function canonicalUnit(raw: string): keyof typeof UNIT_HOURS | null {
  const u = raw.toLowerCase();
  if (/^(minutes?|mins?)$/.test(u)) return "minute";
  if (/^(hours?|hrs?)$/.test(u)) return "hour";
  if (/^days?$/.test(u)) return "day";
  if (/^(weeks?|wks?)$/.test(u)) return "week";
  return null;
}

export function toHours(amount: number, unit: string): number | null {
  const canonical = canonicalUnit(unit);
  return canonical === null ? null : amount * UNIT_HOURS[canonical];
}

const NUMERIC_DURATION = /(\d+(?:\.\d+)?)\s*(minutes?|mins?|hours?|hrs?|days?|weeks?|wks?)\b/i;

const WORD_DURATIONS: [RegExp, number][] = [
  [/\bhalf (an )?hour\b/i, 0.5],
  [/\b(an|one) hour\b/i, 1],
  [/\b(a|one|next|the next) day\b/i, 24],
  [/\b(a|one|next|the next) week\b/i, 168],
];

/**
 * Deterministic reading of a policy description, used to cross-check the
 * model's reading. Returns null when the text is ambiguous (e.g. several
 * candidate amounts), so the caller fails loudly instead of guessing.
 */
export function parsePolicy(text: string): ParsedPolicy | null {
  let rest = text;
  let validForHours = DEFAULT_HOURS;

  const numeric = rest.match(NUMERIC_DURATION);
  if (numeric) {
    validForHours = toHours(parseFloat(numeric[1]), numeric[2])!;
    rest = rest.replace(numeric[0], " ");
  } else {
    const word = WORD_DURATIONS.find(([pattern]) => pattern.test(rest));
    if (word) {
      validForHours = word[1];
      rest = rest.replace(word[0], " ");
    }
  }

  const amounts = rest.match(/\d+(?:\.\d+)?/g) ?? [];
  if (amounts.length > 1) return null;
  const spendCapMon = amounts.length === 1 ? parseFloat(amounts[0]) : DEFAULT_CAP_MON;

  if (!(spendCapMon > 0) || !(validForHours > 0)) return null;
  return { spendCapMon, validForHours };
}
