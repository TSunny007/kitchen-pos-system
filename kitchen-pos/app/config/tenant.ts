/**
 * Tenant configuration — the seam between this codebase and the organisation
 * running it. No component should hardcode an org name, currency, or station
 * label; it goes here and gets imported.
 *
 * Two tiers, because "configurable" and "easy to deploy" pull against each
 * other. Tier 1 is read from the environment, for what differs between two
 * deploys of the same code; every one has a working default, so the app runs
 * on nothing but the Supabase credentials. Tier 2 is plain constants, for what
 * a fork changes once. New knobs start at tier 2 — promoting one to an env var
 * later is non-breaking, demoting one is not. The reasoning is in the root
 * README under "The tradeoff we're making".
 *
 * Note for editors: Next.js inlines `process.env.NEXT_PUBLIC_*` at build time
 * only where it appears as a literal static reference, so these reads can't be
 * refactored into a loop or a dynamic lookup.
 */

/** Trims and falls back — an env var set to "" or whitespace counts as unset. */
function env(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

/**
 * Locale and currency are validated here, at the config boundary, so every
 * consumer — the formatters, the `lang` attribute — sees a value that is
 * already good.
 *
 * This is load-bearing, not defensive habit: `Intl` throws a RangeError on a
 * malformed locale or an unknown currency code, and this module is imported
 * transitively by every page. An unguarded throw wouldn't mis-render a price,
 * it would stop the module evaluating and render the whole app blank. `en_US`
 * — the POSIX spelling, and the likeliest typo — is exactly such a value.
 */
function validated(value: string, fallback: string, probe: (v: string) => unknown, name: string): string {
  try {
    probe(value);
    return value;
  } catch {
    console.warn(`[tenant] ${name}="${value}" is not valid; falling back to "${fallback}".`);
    return fallback;
  }
}

// --- Tier 1: environment ---------------------------------------------------

/** Organisation display name, woven into page titles and headers. */
const orgName = env(process.env.NEXT_PUBLIC_ORG_NAME, "Kitchen");

/** BCP 47 tag driving number, currency, and time formatting. */
const locale = validated(
  env(process.env.NEXT_PUBLIC_LOCALE, "en-US"),
  "en-US",
  (v) => new Intl.NumberFormat(v),
  "NEXT_PUBLIC_LOCALE",
);

/** ISO 4217 code, e.g. USD, EUR, GBP, JPY. */
const currency = validated(
  env(process.env.NEXT_PUBLIC_CURRENCY, "USD"),
  "USD",
  (v) => new Intl.NumberFormat(locale, { style: "currency", currency: v }),
  "NEXT_PUBLIC_CURRENCY",
);

// --- Tier 2: constants a fork edits ----------------------------------------

/** `title` names the station on the landing page; `heading` tops its own screen. */
function station(title: string, description: string) {
  return { title, description, heading: `${orgName} ${title}` };
}

export const tenant = {
  orgName,
  locale,
  currency,

  /** Browser tab title. */
  appName: `${orgName} POS`,
  appDescription: "Point of sale and kitchen display for food service",

  /**
   * The two workstations the app presents. Renaming one is the most common
   * wording change a new deployment makes ("Front Counter", "Pass", "Bar"), so
   * the in-station header is derived from the title rather than repeating it —
   * one edit here changes both the landing card and the header.
   */
  stations: {
    terminal: station("Order Terminal", "Take customer orders and manage the queue"),
    kitchen: station("Kitchen Display", "View and manage order preparation"),
  },
};
