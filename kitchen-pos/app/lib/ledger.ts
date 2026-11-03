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

/** Revenue plus everything on the ledger. */
export function netOf({ revenue, expenses, additions }: Money): number {
  return revenue + expenses + additions;
}

/**
 * The organisation's figures: every row summed, "not tied to a campaign"
 * included. There is no org table to read this from — one deployment is one
 * organisation, so the total is simply everything in the database.
 */
export function sumBalances(rows: readonly Money[]): Money {
  return rows.reduce<Money>(
    (total, row) => ({
      revenue: total.revenue + row.revenue,
      expenses: total.expenses + row.expenses,
      additions: total.additions + row.additions,
    }),
    { revenue: 0, expenses: 0, additions: 0 },
  );
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
