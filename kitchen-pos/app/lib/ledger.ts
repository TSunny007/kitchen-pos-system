/**
 * Balance-sheet arithmetic, before any formatting.
 *
 * Pure numbers, like `pricing.ts` and for the same reason: currency and locale
 * live in `format.ts`, so a fork can change either without touching this file.
 *
 * Amounts are signed all the way through — expenses are negative, additions
 * positive — which is what lets "net" be a plain sum with no case analysis, and
 * lets the same figure be shown with `formatPriceDelta` (which draws the sign)
 * without a second convention to convert between.
 */

import type { CampaignBalance } from "../types";

type Money = Pick<CampaignBalance, "revenue" | "expenses" | "additions">;

/** The largest amount an entry can hold: `ledger_entries.amount` is `numeric(10,2)`. */
export const MAX_ENTRY_AMOUNT = 99_999_999.99;

/**
 * Round to hundredths.
 *
 * Every stored amount is `numeric(10,2)`, so the database's sums are exact
 * multiples of 0.01 — JavaScript's are not: `0.3 + -0.1 + -0.2` is 5.5e-17,
 * which would colour a break-even campaign green and could render "-$0.00".
 * Hundredths whatever the currency, because that is what the column stores; a
 * zero-decimal currency simply never uses the fractional part.
 *
 * The trailing `+ 0` turns a rounded `-0` into `0`, which `Intl` would
 * otherwise print with a minus sign.
 */
export function roundToCents(n: number): number {
  return Math.round(n * 100) / 100 + 0;
}

/** Revenue plus everything on the ledger. */
export function netOf({ revenue, expenses, additions }: Money): number {
  return roundToCents(revenue + expenses + additions);
}

/**
 * The organisation's figures: every row summed, "not tied to a campaign"
 * included. There is no org table to read this from — one deployment is one
 * organisation, so the total is simply everything in the database.
 */
export function sumBalances(rows: readonly Money[]): Money {
  const total = rows.reduce<Money>(
    (sum, row) => ({
      revenue: sum.revenue + row.revenue,
      expenses: sum.expenses + row.expenses,
      additions: sum.additions + row.additions,
    }),
    { revenue: 0, expenses: 0, additions: 0 },
  );
  return {
    revenue: roundToCents(total.revenue),
    expenses: roundToCents(total.expenses),
    additions: roundToCents(total.additions),
  };
}

/** What the entry form collects; the sign is chosen by the toggle, not typed. */
export type EntryKind = "expense" | "addition";

export function entryKind(amount: number): EntryKind {
  return amount < 0 ? "expense" : "addition";
}

/** A typed magnitude plus the toggle, as the signed number that gets stored. */
export function signedAmount(kind: EntryKind, magnitude: number): number {
  const abs = Math.abs(magnitude);
  return kind === "expense" ? -abs : abs;
}

/**
 * The names to suggest in the person field: every one already used, once each.
 *
 * Case-insensitive, because "priya" and "Priya" are the same person and two
 * spellings in a suggestion list is how a team ends up with three of them. The
 * first spelling seen wins, so pass the newest entries first and the most
 * recent capitalisation is the one offered.
 */
export function distinctPeople(names: readonly (string | null)[]): string[] {
  const seen = new Map<string, string>();
  for (const name of names) {
    const trimmed = name?.trim();
    if (trimmed && !seen.has(trimmed.toLowerCase())) {
      seen.set(trimmed.toLowerCase(), trimmed);
    }
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

/**
 * What to store for a typed name. Blank means nobody in particular; otherwise a
 * name that matches a known one ignoring case takes the known spelling, so
 * typing "priya" doesn't mint a second "Priya".
 */
export function resolvePerson(typed: string, known: readonly string[]): string | null {
  const name = typed.trim();
  if (!name) return null;
  return known.find((k) => k.toLowerCase() === name.toLowerCase()) ?? name;
}
