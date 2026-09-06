/**
 * Shared display formatters.
 *
 * `formatCurrency` intentionally matches the name and signature used on the
 * metrics branch (PR #15) so the two copies of this file collapse into one on
 * merge rather than becoming competing helpers.
 */

export function formatCurrency(amount: number): string {
  return amount.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });
}

/** Wall-clock time of an ISO timestamp, e.g. "2:05 PM". */
export function formatClockTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
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
