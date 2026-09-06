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

function reject(name: string, value: string, fallback: string): string {
  console.warn(`[tenant] ${name}="${value}" is not valid; falling back to "${fallback}".`);
  return fallback;
}

/**
 * Validating these at the config boundary is load-bearing, not defensive
 * habit: `Intl` throws a RangeError on a malformed locale or currency code,
 * and this module is imported transitively by every page — an unguarded throw
 * wouldn't mis-render a price, it would stop the module evaluating and render
 * the app blank.
 *
 * Constructing an `Intl` formatter is *not* a sufficient check on its own,
 * though, and that's the subtle part. `Intl` only rejects values it can't
 * parse: `new Intl.NumberFormat("english")` and `{ currency: "XYZ" }` both
 * succeed, then silently resolve to en-US and render "XYZ 4.50". So the tag is
 * checked against what the runtime actually supports, and the code against the
 * real ISO 4217 list.
 */
function validLocale(value: string, fallback: string): string {
  try {
    // Throws on a malformed tag ("en_US"), returns [] on a well-formed tag the
    // runtime has no data for ("xx-YY", "english").
    if (Intl.NumberFormat.supportedLocalesOf(value).length > 0) return value;
  } catch {
    /* fall through */
  }
  return reject("NEXT_PUBLIC_LOCALE", value, fallback);
}

function validCurrency(value: string, inLocale: string, fallback: string): string {
  const code = value.toUpperCase();
  try {
    // Baseline 2023; guard so an older engine degrades to the parse check
    // alone rather than throwing on a missing method.
    if (typeof Intl.supportedValuesOf === "function") {
      return Intl.supportedValuesOf("currency").includes(code)
        ? code
        : reject("NEXT_PUBLIC_CURRENCY", value, fallback);
    }
    new Intl.NumberFormat(inLocale, { style: "currency", currency: code });
    return code;
  } catch {
    return reject("NEXT_PUBLIC_CURRENCY", value, fallback);
  }
}

// --- Tier 1: environment ---------------------------------------------------

/**
 * Organisation display name. Empty when unset, so headings read "Kitchen
 * Display" rather than "Kitchen Kitchen Display" on a zero-config deploy.
 */
const orgName = env(process.env.NEXT_PUBLIC_ORG_NAME, "");

/** BCP 47 tag driving number, currency, and time formatting. */
const locale = validLocale(env(process.env.NEXT_PUBLIC_LOCALE, "en-US"), "en-US");

/** ISO 4217 code, e.g. USD, EUR, GBP, JPY. */
const currency = validCurrency(env(process.env.NEXT_PUBLIC_CURRENCY, "USD"), locale, "USD");

// --- Tier 2: constants a fork edits ----------------------------------------

/** `title` names the station on the landing page; `heading` tops its own screen. */
function station(title: string, description: string) {
  return { title, description, heading: orgName ? `${orgName} ${title}` : title };
}

export const tenant = {
  orgName,
  locale,
  currency,

  /** Browser tab title. Falls back to a generic name when no org is configured. */
  appName: orgName ? `${orgName} POS` : "Kitchen POS",
  appDescription: "Point of sale and kitchen display for food service",

  /**
   * The language the UI strings are actually written in, for `<html lang>`.
   *
   * Deliberately NOT `locale`: that one exists so a Paris café can get "4,50 €"
   * and a 24-hour clock, but every label in this app is still English. Claiming
   * `lang="fr-FR"` over English text makes screen readers read it with a French
   * voice and prompts browsers to offer a translation. Change this only if you
   * translate the interface.
   */
  documentLanguage: "en",

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
