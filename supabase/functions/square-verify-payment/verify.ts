/**
 * Confirm a Square Point of Sale transaction and record it against an order.
 *
 * The POS callback only tells us a transaction id, and a URL can be forged or
 * replayed, so nothing is trusted until Square's own API confirms it. The POS
 * transaction id is a Square *order* id; its tenders point at the Payments,
 * which carry the amount, the tip, and the total.
 * https://developer.squareup.com/docs/pos-api/payments-integration
 *
 * Kept free of Deno and Supabase imports so the logic can be tested with any
 * runtime and fake dependencies; index.ts wires in the real ones.
 */

export interface VerifyInput {
  orderId: unknown;
  transactionId?: unknown;
}

export interface OrderRow {
  id: number;
  status: string;
  subtotal: number | string;
  payment_status: string;
  payment_reference: string | null;
}

export interface PaymentRow {
  order_id: number;
  provider: "square";
  provider_payment_id: string;
  provider_order_id: string;
  base_amount_minor: number;
  tip_amount_minor: number;
  total_amount_minor: number;
  currency: string;
  status: string;
}

export interface SquareResponse {
  status: number;
  // deno-lint-ignore no-explicit-any
  body: any;
}

export interface Deps {
  /** GET a Square API path, e.g. "/v2/orders/abc". */
  square(path: string): Promise<SquareResponse>;
  getOrder(id: number): Promise<OrderRow | null>;
  saveReference(orderId: number, reference: string): Promise<void>;
  /** Existing payment rows for these Square payment ids, any order. */
  findPayments(paymentIds: string[]): Promise<{ provider_payment_id: string; order_id: number }[]>;
  /** Insert, ignoring rows whose payment id is already recorded. */
  insertPayments(rows: PaymentRow[]): Promise<void>;
  markPaid(orderId: number): Promise<void>;
}

export type VerifyResult =
  | { ok: true; alreadyRecorded: boolean; payments: PaymentRow[] }
  | { ok: false; httpStatus: number; code: string; message: string };

function fail(httpStatus: number, code: string, message: string): VerifyResult {
  return { ok: false, httpStatus, code, message };
}

// Square ids are URL-safe base62-ish strings; anything else is not one of
// theirs and shouldn't be interpolated into a request path.
const SQUARE_ID = /^[A-Za-z0-9_-]{1,255}$/;

/** Decimal amount to integer minor units, using the currency's own exponent. */
export function toMinorUnits(amount: number, currency: string): number {
  const digits =
    new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
      .maximumFractionDigits ?? 2;
  return Math.round(amount * 10 ** digits);
}

export async function verifyPayment(deps: Deps, input: VerifyInput): Promise<VerifyResult> {
  const orderId = input.orderId;
  if (typeof orderId !== "number" || !Number.isSafeInteger(orderId) || orderId <= 0) {
    return fail(400, "invalid_request", "order_id must be a positive integer.");
  }
  const transactionId = input.transactionId;
  if (transactionId !== undefined && (typeof transactionId !== "string" || !SQUARE_ID.test(transactionId))) {
    return fail(400, "invalid_request", "transaction_id is not a valid Square id.");
  }

  const order = await deps.getOrder(orderId);
  if (!order) return fail(404, "order_not_found", `Order #${orderId} doesn't exist.`);
  if (order.payment_status === "paid") return { ok: true, alreadyRecorded: true, payments: [] };
  if (order.status === "cancelled") return fail(409, "order_voided", `Order #${orderId} was voided.`);
  if (order.payment_status !== "awaiting") {
    return fail(409, "not_awaiting_payment", `Order #${orderId} isn't waiting for a card payment.`);
  }

  const reference = transactionId ?? order.payment_reference;
  if (!reference) {
    return fail(
      409,
      "no_reference",
      "Square never reported a transaction for this order, so there's nothing to check. " +
        "Look in the Square app's transaction history, then mark it paid in cash, charge again, or void it.",
    );
  }
  // Saved before talking to Square, so a failure below can be retried from
  // the terminal without the original callback URL.
  if (reference !== order.payment_reference) await deps.saveReference(orderId, reference);

  const squareOrder = await deps.square(`/v2/orders/${encodeURIComponent(reference)}`);
  if (squareOrder.status === 404) {
    return fail(
      404,
      "square_not_found",
      "Square has no record of this transaction yet. If the phone was offline, try again once it's back online.",
    );
  }
  if (squareOrder.status === 401 || squareOrder.status === 403) {
    return fail(502, "square_unauthorized", "Square rejected the access token. Check SQUARE_ACCESS_TOKEN and SQUARE_ENVIRONMENT.");
  }
  if (squareOrder.status >= 400) {
    return fail(502, "square_error", `Square returned HTTP ${squareOrder.status} looking up the transaction.`);
  }

  const paymentIds: string[] = (squareOrder.body?.order?.tenders ?? [])
    .map((t: { payment_id?: string }) => t.payment_id)
    .filter((id: unknown): id is string => typeof id === "string" && SQUARE_ID.test(id));
  if (paymentIds.length === 0) {
    return fail(409, "no_card_payment", "That Square transaction has no card payment attached.");
  }

  const rows: PaymentRow[] = [];
  for (const paymentId of paymentIds) {
    const res = await deps.square(`/v2/payments/${encodeURIComponent(paymentId)}`);
    if (res.status >= 400) {
      return fail(502, "square_error", `Square returned HTTP ${res.status} looking up payment ${paymentId}.`);
    }
    const p = res.body?.payment;
    if (p?.status !== "COMPLETED") {
      return fail(409, "payment_not_completed", `Square reports this payment as ${p?.status ?? "unknown"}, not completed.`);
    }
    rows.push({
      order_id: orderId,
      provider: "square",
      provider_payment_id: paymentId,
      provider_order_id: reference,
      base_amount_minor: p.amount_money?.amount ?? 0,
      tip_amount_minor: p.tip_money?.amount ?? 0,
      total_amount_minor: p.total_money?.amount ?? 0,
      currency: p.amount_money?.currency ?? "",
      status: p.status,
    });
  }

  const currency = rows[0].currency;
  if (!/^[A-Z]{3}$/.test(currency) || rows.some((r) => r.currency !== currency)) {
    return fail(409, "currency_mismatch", "Square reported payments in more than one currency.");
  }

  // The base amount (before tip) must match what we asked Square to charge.
  // This is also what stops someone replaying a cheap transaction id against
  // an expensive order.
  const expected = toMinorUnits(Number(order.subtotal), currency);
  const charged = rows.reduce((sum, r) => sum + r.base_amount_minor, 0);
  if (charged !== expected) {
    return fail(
      409,
      "amount_mismatch",
      `Square charged ${charged} but order #${orderId} is ${expected} (${currency} minor units). ` +
        "If the POS currency differs from your Square account's, set NEXT_PUBLIC_CURRENCY to match.",
    );
  }

  const existing = await deps.findPayments(paymentIds);
  if (existing.some((e) => e.order_id !== orderId)) {
    return fail(409, "payment_already_used", "That Square payment is already recorded against a different order.");
  }

  await deps.insertPayments(rows);
  await deps.markPaid(orderId);
  return { ok: true, alreadyRecorded: false, payments: rows };
}
