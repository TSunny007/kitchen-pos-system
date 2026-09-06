/**
 * Shared display formatters, driven by `tenant.locale` / `tenant.currency` so
 * a deployment outside the US doesn't have to patch components one by one.
 *
 * `formatCurrency` intentionally matches the name and signature used on the
 * metrics branch (PR #15) so the two copies of this file collapse into one on
 * merge rather than becoming competing helpers.
 */

import { tenant } from "../config/tenant";

// `tenant.locale` and `tenant.currency` are validated at the config boundary,
// so constructing these at module scope can't throw. See tenant.ts for why
// that guarantee matters here.
const { locale, currency } = tenant;

const currencyFormatter = new Intl.NumberFormat(locale, { style: "currency", currency });

/** As above but always signed, for price adjustments. Plain amount at zero. */
const priceDeltaFormatter = new Intl.NumberFormat(locale, {
  style: "currency",
  currency,
  signDisplay: "exceptZero",
});

const clockFormatter = new Intl.DateTimeFormat(locale, {
  hour: "numeric",
  minute: "2-digit",
});

const dateFormatter = new Intl.DateTimeFormat(locale, { dateStyle: "short" });

/**
 * `Intl.DateTimeFormat.format` throws on an unparseable date, where the
 * `toLocaleTimeString` this replaced merely returned "Invalid Date". A bad
 * timestamp reaching a card should cost that one cell, not unmount the kitchen
 * display mid-service.
 */
function formatDateSafely(formatter: Intl.DateTimeFormat, dateString: string): string {
  const date = new Date(dateString);
  return Number.isNaN(date.getTime()) ? "—" : formatter.format(date);
}

/** A money amount in the tenant's currency, e.g. "$4.50" or "4,50 €". */
export function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount);
}

/**
 * A price adjustment, with its sign — "Extra Shot +$0.75". Prefer this over
 * prefixing a manual "+", which puts the sign on the wrong side of the number
 * in some locales.
 */
export function formatPriceDelta(amount: number): string {
  return priceDeltaFormatter.format(amount);
}

/**
 * Wall-clock time of an ISO timestamp, e.g. "2:05 PM" or "14:05" — 12- vs
 * 24-hour is the locale's call, not ours.
 */
export function formatClockTime(dateString: string): string {
  return formatDateSafely(clockFormatter, dateString);
}

/**
 * Calendar date of an ISO timestamp, e.g. "8/15/26" or "15/08/2026". Pinned to
 * the tenant's locale rather than the browser's, so a terminal that happens to
 * be configured for another region still matches the rest of the UI.
 */
export function formatDate(dateString: string): string {
  return formatDateSafely(dateFormatter, dateString);
}

/**
 * A span of elapsed time, e.g. "45m" or "2h 05m".
 *
 * Takes MILLISECONDS. Note the metrics branch also exports a `formatDuration`
 * that takes SECONDS and renders "5m 30s" - the different name here keeps the
 * two from silently colliding on merge, since a unit mismatch would still
 * typecheck.
 */
export function formatElapsed(ms: number, zeroLabel = "Just now"): string {
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return zeroLabel;
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

/**
 * How to attach the currency's symbol to a bare number input, taken from the
 * same formatter the amounts use so the two can't disagree.
 *
 * Both fields matter: the symbol trails the amount in most European locales
 * ("1,50 €"), and it is not always one glyph — de-CH/CHF gives "CHF",
 * pt-BR/BRL gives "R$" — so callers size the padding from the string rather
 * than assuming a single character on the left.
 */
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Coarse "how long ago" label for an order in a list: "Just now", "5m ago",
 * "3h ago". Past a day the relative form stops being useful ("76h 12m ago"),
 * so it falls back to the wall-clock time the order was placed - restoring
 * behaviour that was lost when OrderCard moved onto the shared helpers.
 */
export function formatTimeSince(since: string, elapsedMs: number): string {
  const mins = Math.floor(elapsedMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (elapsedMs < DAY_MS) return `${Math.floor(mins / 60)}h ago`;
  return formatClockTime(since);
}

export const currencyAdornment: { symbol: string; position: "prefix" | "suffix" } = (() => {
  const parts = currencyFormatter.formatToParts(0);
  const index = parts.findIndex((part) => part.type === "currency");
  return {
    symbol: index === -1 ? "$" : parts[index].value,
    position: index === 0 ? "prefix" : "suffix",
  };
})();
