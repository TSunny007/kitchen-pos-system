/**
 * Hand-off to the Square Point of Sale app, and reading what it hands back.
 *
 * A web page can't drive a card reader, so the terminal opens Square's own app
 * with the amount filled in; the customer taps and tips there, and the app
 * navigates back to CALLBACK_PATH. Nothing that comes back in that URL is
 * trusted — it's passed to the square-verify-payment Edge Function, which asks
 * Square's API what actually happened.
 * https://developer.squareup.com/docs/pos-api/build-mobile-web
 *
 * Off entirely unless `tenant.squareApplicationId` is set.
 */

import { tenant } from "../config/tenant";

export const squareEnabled = tenant.squareApplicationId !== "";

/**
 * Must match a Web Callback URL registered for the app in the Square Developer
 * Dashboard (Point of Sale API → Web), origin included, exactly.
 */
export const CALLBACK_PATH = "/terminal/square-callback";

/**
 * Decimal amount to integer minor units, using the currency's own exponent.
 * The Edge Function has an identical copy (supabase/functions/.../verify.ts):
 * it runs on Deno and can't import from the app, and the two must agree for
 * the amount check there to pass.
 */
export function toMinorUnits(amount: number, currency: string): number {
  const digits =
    new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
      .maximumFractionDigits ?? 2;
  return Math.round(amount * 10 ** digits);
}

function isAndroid(userAgent: string): boolean {
  return /android/i.test(userAgent);
}

/**
 * The URL that opens the Square app to charge `amount` for an order. iOS and
 * Android take entirely different formats; our order id rides along in the
 * field each one echoes back (`state` / `REQUEST_METADATA`).
 *
 * Card tenders only: a cash sale through the Square app produces a transaction
 * id that the Orders API can't look up, so the payment couldn't be verified.
 * Cash is taken with the terminal's own "Paid in cash" instead.
 */
export function buildChargeUrl(opts: {
  orderId: number;
  amount: number;
  origin: string;
  userAgent: string;
}): string {
  const { orderId, amount, origin, userAgent } = opts;
  const callbackUrl = `${origin}${CALLBACK_PATH}`;
  const minor = toMinorUnits(amount, tenant.currency);
  const note = `Order #${orderId}`;

  if (isAndroid(userAgent)) {
    // Shown instead of an error page when the Square app isn't installed.
    const fallback = `${callbackUrl}?order=${orderId}&error=not_installed`;
    const extras = [
      "action=com.squareup.pos.action.CHARGE",
      "package=com.squareup",
      `S.browser_fallback_url=${encodeURIComponent(fallback)}`,
      `S.com.squareup.pos.WEB_CALLBACK_URI=${encodeURIComponent(callbackUrl)}`,
      `S.com.squareup.pos.CLIENT_ID=${tenant.squareApplicationId}`,
      "S.com.squareup.pos.API_VERSION=v2.1",
      `i.com.squareup.pos.TOTAL_AMOUNT=${minor}`,
      `S.com.squareup.pos.CURRENCY_CODE=${tenant.currency}`,
      "S.com.squareup.pos.TENDER_TYPES=com.squareup.pos.TENDER_CARD",
      `S.com.squareup.pos.NOTE=${encodeURIComponent(note)}`,
      `S.com.squareup.pos.REQUEST_METADATA=${orderId}`,
    ];
    return `intent:#Intent;${extras.join(";")};end`;
  }

  const data = {
    amount_money: { amount: minor, currency_code: tenant.currency },
    callback_url: callbackUrl,
    client_id: tenant.squareApplicationId,
    version: "1.3",
    notes: note,
    state: String(orderId),
    options: { supported_tender_types: ["CREDIT_CARD"], auto_return: true },
  };
  return `square-commerce-v1://payment/create?data=${encodeURIComponent(JSON.stringify(data))}`;
}

export type SquareCallback =
  | { kind: "success"; orderId: number; transactionId: string }
  | { kind: "error"; orderId: number | null; message: string }
  /** No new result from Square; just look at the order and offer actions. */
  | { kind: "resolve"; orderId: number };

function parseOrderId(value: string | null | undefined): number | null {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/**
 * Turn whatever the Square app (or a "Resolve" link, `?order=<id>`) put in the
 * callback URL into one shape. Null when the URL names no order at all.
 */
export function parseCallback(params: URLSearchParams): SquareCallback | null {
  // iOS: one JSON blob in `data`.
  const iosData = params.get("data");
  if (iosData) {
    let data: Record<string, string | undefined>;
    try {
      data = JSON.parse(iosData);
    } catch {
      return { kind: "error", orderId: null, message: "Square sent back a response this app couldn't read." };
    }
    const orderId = parseOrderId(data.state);
    if (data.status === "ok" && data.transaction_id && orderId) {
      return { kind: "success", orderId, transactionId: data.transaction_id };
    }
    return { kind: "error", orderId, message: describeError(data.error_code, !!data.client_transaction_id) };
  }

  // Android: separate query parameters.
  const prefix = "com.squareup.pos.";
  const androidOrderId = parseOrderId(params.get(`${prefix}REQUEST_METADATA`));
  const serverTx = params.get(`${prefix}SERVER_TRANSACTION_ID`);
  const androidError = params.get(`${prefix}ERROR_CODE`);
  if (serverTx && androidOrderId && !androidError) {
    return { kind: "success", orderId: androidOrderId, transactionId: serverTx };
  }
  if (androidError || params.has(`${prefix}CLIENT_TRANSACTION_ID`)) {
    return {
      kind: "error",
      orderId: androidOrderId,
      message: describeError(androidError ?? undefined, params.has(`${prefix}CLIENT_TRANSACTION_ID`)),
    };
  }

  // Our own links: Android's not-installed fallback, and "Resolve" from a card.
  const orderId = parseOrderId(params.get("order"));
  if (!orderId) return null;
  const error = params.get("error");
  if (error) return { kind: "error", orderId, message: describeError(error, false) };
  return { kind: "resolve", orderId };
}

/**
 * What to tell the cashier. Codes are Square's (iOS lowercase; Android upper,
 * sometimes as the full `com.squareup.pos.ERROR_*` constant) plus our own
 * `not_installed`.
 * https://developer.squareup.com/docs/pos-api/web-technical-reference
 */
export function describeError(code: string | undefined, hasClientTransaction: boolean): string {
  switch (code?.toLowerCase().replace(/^com\.squareup\.pos\.error_/, "")) {
    case "payment_canceled":
    case "transaction_canceled":
      return "The payment was cancelled in Square. Nothing was charged.";
    case "currency_code_mismatch":
    case "unsupported_currency_code":
      return `Square rejected the currency (${tenant.currency}). Set NEXT_PUBLIC_CURRENCY to your Square account's currency.`;
    case "not_logged_in":
    case "user_not_logged_in":
    case "no_employee_logged_in":
      return "Sign in to the Square Point of Sale app on this phone, then charge again.";
    case "unauthorized_client_id":
    case "user_not_active":
    case "user_not_activated":
      return "Square didn't accept this app. Check NEXT_PUBLIC_SQUARE_APPLICATION_ID and that the Square account is activated for card payments.";
    case "no_network_connection":
    case "no_network":
      return "The phone is offline, so Square couldn't take the payment.";
    case "transaction_already_in_progress":
      return "Square is already in the middle of a payment. Finish or cancel it in the Square app first.";
    case "not_installed":
      return "The Square Point of Sale app isn't installed on this phone.";
  }
  // A payment taken in offline mode has a client id but no server transaction
  // yet, and Square's API can't see it until the phone syncs.
  if (hasClientTransaction) {
    return "Square took this payment offline, so it can't be confirmed yet. Check the Square app's transactions once the phone is back online.";
  }
  return code ? `Square reported an error (${code}).` : "Square didn't report a result for this payment.";
}
